-- A4: Unit-of-Measure / pack hierarchy.
-- Stock is ALWAYS stored in the product's BASE unit (products.unit,
-- products.stock, stock_locations.quantity). This table only defines alternate
-- units (inner pack / carton / pallet) and how many BASE units each contains,
-- so receiving/picking/ordering can be entered in any unit and converted to base.

create table if not exists product_uoms (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  sku         text not null,
  uom_code    text not null,           -- e.g. CARTON, PALLET, INNER
  uom_name    text,                    -- e.g. ลัง, พาเลท, แพ็ค
  factor      numeric not null default 1, -- BASE units per 1 of this uom (carton=24)
  barcode     text,                    -- optional: scan a carton barcode -> this uom
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, sku, uom_code)
);

create index if not exists idx_product_uoms_org_sku on product_uoms (org_id, sku);
create index if not exists idx_product_uoms_barcode on product_uoms (org_id, barcode);

notify pgrst, 'reload schema';
