-- Warehouse layout → real bin master (2D/3D map phase 1)
--
-- 1) warehouse_racks gets the per-rack settings the editor already had but
--    never saved (pallet_mode), plus the bin-naming template and per-bin
--    overrides so each branch can name bins exactly like the labels on its
--    real racks (e.g. "A-003", "M-001.2", a merged "A-001-2").
-- 2) warehouse_locations (the existing bin master that the product location
--    pickers read) learns which branch/rack/bay/level a bin belongs to, so
--    saving a layout writes its bins there. Bins removed from a layout are
--    deactivated (active = false), never deleted — stock may still sit there.
--
-- Idempotent: safe to re-run. Run by hand in the Supabase SQL Editor.

alter table warehouse_racks add column if not exists pallet_mode   varchar(16) not null default 'PALLET';
alter table warehouse_racks add column if not exists bin_template  varchar(64);
alter table warehouse_racks add column if not exists bin_overrides jsonb not null default '{}'::jsonb;
alter table warehouse_racks add column if not exists sort_order    integer not null default 0;

alter table warehouse_locations add column if not exists branch_id  varchar(100);
alter table warehouse_locations add column if not exists rack_code  varchar(50);
alter table warehouse_locations add column if not exists bay        integer;
alter table warehouse_locations add column if not exists level      integer;
alter table warehouse_locations add column if not exists source     varchar(16);   -- 'LAYOUT' = generated from the map
alter table warehouse_locations add column if not exists active     boolean not null default true;
alter table warehouse_locations add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_warehouse_locations_branch
  on warehouse_locations (org_id, branch_id, source);

-- Upserts from the layout save use (org_id, bin_code). 20260924_doc_sequences
-- already swaps the old global unique for a per-org one; make sure it exists.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where tablename = 'warehouse_locations'
      and indexdef ilike '%unique%' and indexdef ilike '%(org_id, bin_code)%'
  ) then
    create unique index uq_warehouse_locations_org_bin on warehouse_locations (org_id, bin_code);
  end if;
end $$;

notify pgrst, 'reload schema';
