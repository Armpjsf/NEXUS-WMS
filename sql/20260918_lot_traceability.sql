-- C1: Lot traceability & recall.
-- Append-only movement log tying every lotted stock change to a document/party,
-- so a contaminated lot can be traced forward to the customers/orders that got
-- it. Only lotted movements are recorded (non-lot SKUs skip), keeping it lean.

create table if not exists lot_movements (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  sku          text not null,
  lot_number   text not null,
  qty          numeric not null default 0,
  direction    text not null,              -- IN | OUT | MOVE | ADJUST
  doc_ref      text,                        -- order no / receipt no / mission
  party        text,                        -- customer / supplier
  location     text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_lot_moves_org_lot on lot_movements (org_id, sku, lot_number);
create index if not exists idx_lot_moves_doc on lot_movements (org_id, doc_ref);
create index if not exists idx_lot_moves_created on lot_movements (org_id, created_at desc);

-- product_lots gains a recall flag (nullable — untouched lots stay as-is).
alter table product_lots add column if not exists recalled boolean not null default false;
alter table product_lots add column if not exists recalled_at timestamptz;

-- Recreate wms_bin_consume so its `taken` array carries the lot per bin, letting
-- the app log exactly which lots left for which order (FEFO order preserved).
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
    select sl.id, sl.bin_code, sl.quantity, sl.lot_no
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
      v_taken := v_taken || jsonb_build_object('binCode', r.bin_code, 'quantity', v_use, 'lotNo', r.lot_no);
      v_need := v_need - v_use;
    end if;
  end loop;

  return jsonb_build_object('taken', v_taken, 'shortfall', v_need, 'total', wms__reconcile(p_org, p_sku));
end $$;

notify pgrst, 'reload schema';
