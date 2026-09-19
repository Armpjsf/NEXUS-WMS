-- Mixed-lot bins ----------------------------------------------------------------
-- A single (sku, bin) may now hold stock from several lots — one row per lot.
-- The uniqueness key becomes (org_id, sku, bin_code, lot_no). lot_no is made
-- NOT NULL DEFAULT '' ('' = unlotted) so NULLs don't defeat the unique index or
-- ON CONFLICT upserts. products.stock stays = Σ stock_locations.quantity.
--
-- Run order: apply this SQL, THEN run scripts/split-bins-by-lot.mjs --commit to
-- break each SKU's current bins into per-lot rows.

-- 1) lot_no -> NOT NULL DEFAULT ''
alter table stock_locations alter column lot_no set default '';
update stock_locations set lot_no = '' where lot_no is null;
alter table stock_locations alter column lot_no set not null;

-- 2) swap the unique constraint (drop whatever unique(s) exist, add 4-col key)
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'stock_locations'::regclass and contype = 'u'
  loop
    execute format('alter table stock_locations drop constraint %I', c);
  end loop;
end $$;
alter table stock_locations
  add constraint stock_locations_org_sku_bin_lot_key unique (org_id, sku, bin_code, lot_no);
create index if not exists idx_stock_locations_org_sku_lot on stock_locations (org_id, sku, lot_no);

-- 3) reconcile: products.stock = Σ bins, location = fullest BIN (summed over lots)
create or replace function wms__reconcile(p_org uuid, p_sku text)
returns numeric language plpgsql as $$
declare v_total numeric; v_primary text;
begin
  select coalesce(sum(quantity), 0) into v_total
    from stock_locations where org_id = p_org and sku = p_sku;
  select bin_code into v_primary from (
    select bin_code, sum(quantity) q
      from stock_locations
      where org_id = p_org and sku = p_sku and quantity > 0
      group by bin_code order by q desc limit 1
  ) t;
  update products set stock = v_total, location = coalesce(v_primary, 'Unassigned'), updated_at = now()
    where org_id = p_org and sku = p_sku;
  return v_total;
end $$;

-- 4) bin add — upsert on the 4-col key so the same bin can grow a new lot row
create or replace function wms_bin_add(p_org uuid, p_sku text, p_bin text, p_qty numeric, p_lot text default '')
returns numeric language plpgsql as $$
declare v_bin text := coalesce(nullif(trim(p_bin), ''), 'UNASSIGNED');
        v_lot text := coalesce(p_lot, '');
begin
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':' || p_sku));
  perform wms__ensure_seeded(p_org, p_sku);
  insert into stock_locations (org_id, sku, bin_code, quantity, lot_no)
    values (p_org, p_sku, v_bin, greatest(0, coalesce(p_qty, 0)), v_lot)
  on conflict (org_id, sku, bin_code, lot_no) do update
    set quantity = stock_locations.quantity + greatest(0, coalesce(p_qty, 0)),
        updated_at = now();
  return wms__reconcile(p_org, p_sku);
end $$;

-- 5) consume — FEFO across (bin, lot) rows; taken now carries lotNo
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
    select sl.id, sl.bin_code, sl.lot_no, sl.quantity
    from stock_locations sl
    left join product_lots pl
      on pl.org_id = sl.org_id and pl.sku = sl.sku and pl.lot_number = sl.lot_no
    where sl.org_id = p_org and sl.sku = p_sku and sl.quantity > 0
    order by
      (case when p_prefer is not null and sl.bin_code = p_prefer then 0 else 1 end),
      (case when pl.exp_date is not null and pl.exp_date <= now() then 1 else 0 end),
      pl.exp_date asc nulls last,
      pl.mfg_date asc nulls last,
      sl.created_at asc
    for update of sl
  loop
    exit when v_need <= 0;
    v_use := least(r.quantity, v_need);
    if v_use > 0 then
      update stock_locations set quantity = quantity - v_use, updated_at = now() where id = r.id;
      v_taken := v_taken || jsonb_build_object('binCode', r.bin_code, 'quantity', v_use, 'lotNo', r.lot_no);
      v_need := v_need - v_use;
    end if;
  end loop;

  return jsonb_build_object('taken', v_taken, 'shortfall', v_need, 'total', wms__reconcile(p_org, p_sku));
end $$;

-- 6) move — shift up to p_qty from a bin to another, FEFO across the source
-- bin's lots, preserving each lot on the destination side. Returns { moved, total }.
create or replace function wms_bin_move(p_org uuid, p_sku text, p_from text, p_to text, p_qty numeric)
returns jsonb language plpgsql as $$
declare
  v_from text := coalesce(nullif(trim(p_from), ''), 'UNASSIGNED');
  v_to   text := coalesce(nullif(trim(p_to), ''), 'UNASSIGNED');
  v_need numeric := greatest(0, coalesce(p_qty, 0));
  v_moved numeric := 0;
  v_use numeric;
  r record;
begin
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':' || p_sku));
  perform wms__ensure_seeded(p_org, p_sku);
  if v_from = v_to or v_need <= 0 then
    return jsonb_build_object('moved', 0, 'total', wms__reconcile(p_org, p_sku));
  end if;

  for r in
    select sl.id, sl.lot_no, sl.quantity
    from stock_locations sl
    left join product_lots pl
      on pl.org_id = sl.org_id and pl.sku = sl.sku and pl.lot_number = sl.lot_no
    where sl.org_id = p_org and sl.sku = p_sku and sl.bin_code = v_from and sl.quantity > 0
    order by pl.exp_date asc nulls last, pl.mfg_date asc nulls last, sl.created_at asc
    for update of sl
  loop
    exit when v_need <= 0;
    v_use := least(r.quantity, v_need);
    if v_use > 0 then
      update stock_locations set quantity = quantity - v_use, updated_at = now() where id = r.id;
      insert into stock_locations (org_id, sku, bin_code, quantity, lot_no)
        values (p_org, p_sku, v_to, v_use, r.lot_no)
      on conflict (org_id, sku, bin_code, lot_no) do update
        set quantity = stock_locations.quantity + v_use, updated_at = now();
      v_moved := v_moved + v_use;
      v_need := v_need - v_use;
    end if;
  end loop;

  return jsonb_build_object('moved', v_moved, 'total', wms__reconcile(p_org, p_sku));
end $$;

notify pgrst, 'reload schema';
