-- A3: Atomic stock operations (concurrency-safe).
-- Each function serializes work per (org, sku) with a transaction-scoped
-- advisory lock and row locks, so concurrent picks / reservations can't lose
-- updates, go negative, or over-reserve. The app calls these via supabase.rpc()
-- and falls back to its JS implementation only if the function is absent.
--
-- All four keep the invariant: products.stock = Σ stock_locations.quantity,
-- and products.location = the fullest bin.

-- Seed a SKU's bins from the legacy single-location model if it has none yet.
create or replace function wms__ensure_seeded(p_org uuid, p_sku text)
returns void language plpgsql as $$
begin
  if not exists (select 1 from stock_locations where org_id = p_org and sku = p_sku) then
    insert into stock_locations (org_id, sku, bin_code, quantity)
    select p_org, p_sku, coalesce(nullif(trim(location), ''), 'UNASSIGNED'), coalesce(stock, 0)
    from products where org_id = p_org and sku = p_sku;
  end if;
end $$;

-- Recompute products.stock (= Σ bins) and products.location (= fullest bin).
create or replace function wms__reconcile(p_org uuid, p_sku text)
returns numeric language plpgsql as $$
declare v_total numeric; v_primary text;
begin
  select coalesce(sum(quantity), 0) into v_total
    from stock_locations where org_id = p_org and sku = p_sku;
  select bin_code into v_primary
    from stock_locations where org_id = p_org and sku = p_sku and quantity > 0
    order by quantity desc limit 1;
  update products set stock = v_total, location = coalesce(v_primary, 'Unassigned'), updated_at = now()
    where org_id = p_org and sku = p_sku;
  return v_total;
end $$;

-- Add qty to a bin (atomic upsert + reconcile).
create or replace function wms_bin_add(p_org uuid, p_sku text, p_bin text, p_qty numeric, p_lot text default null)
returns numeric language plpgsql as $$
declare v_bin text := coalesce(nullif(trim(p_bin), ''), 'UNASSIGNED');
begin
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':' || p_sku));
  perform wms__ensure_seeded(p_org, p_sku);
  insert into stock_locations (org_id, sku, bin_code, quantity, lot_no)
    values (p_org, p_sku, v_bin, greatest(0, coalesce(p_qty, 0)), p_lot)
  on conflict (org_id, sku, bin_code) do update
    set quantity = stock_locations.quantity + greatest(0, coalesce(p_qty, 0)),
        lot_no = coalesce(excluded.lot_no, stock_locations.lot_no),
        updated_at = now();
  return wms__reconcile(p_org, p_sku);
end $$;

-- Consume qty across bins, FEFO (earliest expiry first; preferBin wins; expired
-- last; FIFO tiebreak). Atomic. Returns { taken:[{binCode,quantity}], shortfall, total }.
create or replace function wms_bin_consume(p_org uuid, p_sku text, p_qty numeric, p_prefer text default null)
returns jsonb language plpgsql as $$
declare
  v_need numeric := greatest(0, coalesce(p_qty, 0));
  v_taken jsonb := '[]'::jsonb;
  v_use numeric;
  r record;
begin
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':' || p_sku));
  perform wms__ensure_seeded(p_org, p_sku);

  for r in
    select sl.id, sl.bin_code, sl.quantity
    from stock_locations sl
    left join product_lots pl
      on pl.org_id = sl.org_id and pl.sku = sl.sku and pl.lot_number = sl.lot_no
    where sl.org_id = p_org and sl.sku = p_sku and sl.quantity > 0
    order by
      (case when p_prefer is not null and sl.bin_code = p_prefer then 0 else 1 end),
      (case when pl.exp_date is not null and pl.exp_date <= now() then 1 else 0 end),
      pl.exp_date asc nulls last,
      sl.created_at asc
    for update of sl
  loop
    exit when v_need <= 0;
    v_use := least(r.quantity, v_need);
    if v_use > 0 then
      update stock_locations set quantity = quantity - v_use, updated_at = now() where id = r.id;
      v_taken := v_taken || jsonb_build_object('binCode', r.bin_code, 'quantity', v_use);
      v_need := v_need - v_use;
    end if;
  end loop;

  return jsonb_build_object('taken', v_taken, 'shortfall', v_need, 'total', wms__reconcile(p_org, p_sku));
end $$;

-- Move qty between two bins (atomic). Returns { moved, total }.
create or replace function wms_bin_move(p_org uuid, p_sku text, p_from text, p_to text, p_qty numeric)
returns jsonb language plpgsql as $$
declare
  v_from text := coalesce(nullif(trim(p_from), ''), 'UNASSIGNED');
  v_to   text := coalesce(nullif(trim(p_to), ''), 'UNASSIGNED');
  v_avail numeric; v_move numeric;
begin
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':' || p_sku));
  perform wms__ensure_seeded(p_org, p_sku);
  if v_from = v_to or coalesce(p_qty, 0) <= 0 then
    return jsonb_build_object('moved', 0, 'total', wms__reconcile(p_org, p_sku));
  end if;

  select quantity into v_avail
    from stock_locations where org_id = p_org and sku = p_sku and bin_code = v_from for update;
  v_move := least(coalesce(v_avail, 0), p_qty);
  if v_move > 0 then
    update stock_locations set quantity = quantity - v_move, updated_at = now()
      where org_id = p_org and sku = p_sku and bin_code = v_from;
    insert into stock_locations (org_id, sku, bin_code, quantity)
      values (p_org, p_sku, v_to, v_move)
    on conflict (org_id, sku, bin_code) do update
      set quantity = stock_locations.quantity + v_move, updated_at = now();
  end if;

  return jsonb_build_object('moved', v_move, 'total', wms__reconcile(p_org, p_sku));
end $$;

-- Atomic reservation / ATP. Locks the product row so two concurrent orders
-- can't reserve the same units. Returns { reserved, backorder, offCatalog }.
create or replace function wms_reserve(p_org uuid, p_order_id text, p_order_no text, p_sku text, p_qty numeric)
returns jsonb language plpgsql as $$
declare v_stock numeric; v_reserved numeric; v_avail numeric; v_take numeric;
begin
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':' || p_sku));
  select stock into v_stock from products where org_id = p_org and sku = p_sku for update;
  if v_stock is null then
    return jsonb_build_object('offCatalog', true, 'reserved', 0, 'backorder', 0);
  end if;
  select coalesce(sum(qty_reserved), 0) into v_reserved
    from stock_reservations where org_id = p_org and sku = p_sku and status = 'ACTIVE';
  v_avail := v_stock - v_reserved;
  v_take := greatest(0, least(v_avail, coalesce(p_qty, 0)));
  insert into stock_reservations (org_id, order_id, order_no, sku, qty_requested, qty_reserved, status)
    values (p_org, p_order_id, p_order_no, p_sku, coalesce(p_qty, 0), v_take, 'ACTIVE');
  return jsonb_build_object('reserved', v_take, 'backorder', coalesce(p_qty, 0) - v_take, 'offCatalog', false);
end $$;

notify pgrst, 'reload schema';
