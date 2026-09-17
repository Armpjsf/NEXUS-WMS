-- Multi-bin stock: per-(SKU, bin) quantity ledger.
-- products.stock stays the authoritative TOTAL and is always kept equal to the
-- sum of this table's rows for that SKU (reconciled by lib/stockLocations.ts).
-- products.location stays the "primary" bin (the bin holding the most qty) for
-- backward compatibility with every screen that still reads a single location.

create table if not exists stock_locations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  sku         text not null,
  bin_code    text not null,
  quantity    numeric not null default 0,
  lot_no      text,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (org_id, sku, bin_code)
);

create index if not exists idx_stock_locations_org_sku on stock_locations (org_id, sku);
create index if not exists idx_stock_locations_org_bin on stock_locations (org_id, bin_code);

-- Seed from the current single-location model so existing stock is not lost.
-- Every product with stock (or an assigned location) gets one starting bin row.
insert into stock_locations (org_id, sku, bin_code, quantity)
select p.org_id,
       p.sku,
       coalesce(nullif(trim(p.location), ''), 'UNASSIGNED') as bin_code,
       coalesce(p.stock, 0) as quantity
from products p
where p.sku is not null
on conflict (org_id, sku, bin_code) do nothing;

-- PostgREST: refresh schema cache so the new table is queryable immediately.
notify pgrst, 'reload schema';
