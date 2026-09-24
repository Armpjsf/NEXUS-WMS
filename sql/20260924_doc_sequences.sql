-- ============================================================================
-- 20260924 — Atomic document-number sequences
-- ----------------------------------------------------------------------------
-- Replaces the old "count rows + 1" and "random 3-4 digits" document numbers,
-- which could hand two concurrent requests the same number (ORD/PO/GRN/RMA)
-- or collide by chance (ADJ/ASN/APT/TSK/WCS/LPN).
--
-- lib/docNumber.ts calls wms_next_doc_seq(key, floor). The upsert below is a
-- single statement, so concurrent callers always get distinct values. `floor`
-- lets the app seed a counter from numbers that already exist today.
--
-- Idempotent — safe to run again. Run in Supabase SQL editor.
-- ============================================================================

create table if not exists doc_sequences (
  seq_key    text primary key,          -- e.g. 'ORD-260924-'
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table doc_sequences enable row level security;  -- service role only

create or replace function wms_next_doc_seq(p_key text, p_floor bigint default 0)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into doc_sequences as d (seq_key, last_value, updated_at)
  values (p_key, greatest(coalesce(p_floor, 0), 0) + 1, now())
  on conflict (seq_key) do update
    set last_value = greatest(d.last_value, coalesce(p_floor, 0)) + 1,
        updated_at = now()
  returning last_value;
$$;

revoke all on function wms_next_doc_seq(text, bigint) from public, anon, authenticated;
grant execute on function wms_next_doc_seq(text, bigint) to service_role;

-- Old counters are only useful for the current day; keep the table small.
delete from doc_sequences where updated_at < now() - interval '60 days';

-- ----------------------------------------------------------------------------
-- Safety net: unique indexes on document-number columns. Each is created only
-- when the table/column exists AND holds no duplicates today, so the script
-- never fails on legacy data. Duplicates found are reported with RAISE NOTICE
-- (fix them, then re-run to add the index).
-- ----------------------------------------------------------------------------
do $$
declare
  t record;
  dup_count int;
begin
  for t in
    select * from (values
      ('outbound_orders',            'order_no'),
      ('purchase_orders',            'po_number'),
      ('receipts',                   'receipt_no'),
      ('return_orders',              'rma_no'),
      ('stock_adjustment_requests',  'request_no'),
      ('asn_headers',                'asn_no'),
      ('dock_appointments',          'appointment_number'),
      ('warehouse_tasks',            'task_number'),
      ('wcs_missions',               'mission_code'),
      ('license_plate_numbers',      'lpn_number'),
      ('stock_transfers',            'transfer_no')
    ) as v(tbl, col)
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t.tbl and column_name = t.col
    ) then
      continue;
    end if;

    -- Already protected by a single-column UNIQUE constraint (schema default)?
    if exists (
      select 1 from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_attribute att on att.attrelid = rel.oid and att.attnum = con.conkey[1]
      where rel.relname = t.tbl and con.contype in ('u', 'p')
        and array_length(con.conkey, 1) = 1 and att.attname = t.col
    ) then
      continue;
    end if;

    execute format(
      'select count(*) from (select %1$I from %2$I where %1$I is not null and %1$I <> '''' group by %1$I having count(*) > 1) x',
      t.col, t.tbl) into dup_count;

    if dup_count > 0 then
      raise notice 'skip unique index on %.%: % duplicated values', t.tbl, t.col, dup_count;
    else
      execute format(
        'create unique index if not exists %I on %I (%I) where %I is not null and %I <> ''''',
        'uq_' || t.tbl || '_' || t.col, t.tbl, t.col, t.col, t.col);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ============================================================================
-- Tenant-scoped unique keys
-- ----------------------------------------------------------------------------
-- These columns were UNIQUE across ALL organizations, which (a) blocks a second
-- tenant from using the same SKU/bin/code (every onboarding seeds SKU-0001 and
-- A-01-01), and (b) let `upsert(onConflict: 'sku')` in product import take over
-- another tenant's row. Make them unique per org instead.
-- Document numbers (ORD/PO/GRN/RMA …) stay globally unique on purpose — the
-- TMS webhook looks orders up by order_no without a tenant.
-- ============================================================================
do $$
declare
  t record;
  c record;
  dup_count int;
begin
  for t in
    select * from (values
      ('products',            'sku'),
      ('warehouse_locations', 'bin_code'),
      ('customers',           'code'),
      ('carriers',            'code'),
      ('suppliers',           'code')
    ) as v(tbl, col)
  loop
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t.tbl and column_name = t.col)
       or not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t.tbl and column_name = 'org_id') then
      continue;
    end if;

    execute format(
      'select count(*) from (select org_id, %1$I from %2$I group by org_id, %1$I having count(*) > 1) x',
      t.col, t.tbl) into dup_count;
    if dup_count > 0 then
      raise notice 'skip %: % duplicated (org_id, %) pairs — clean up and re-run', t.tbl, dup_count, t.col;
      continue;
    end if;

    execute format('create unique index if not exists %I on %I (org_id, %I)',
                   'uq_' || t.tbl || '_org_' || t.col, t.tbl, t.col);

    -- Drop the old single-column UNIQUE constraint(s) on this column.
    for c in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join pg_attribute att on att.attrelid = rel.oid and att.attnum = con.conkey[1]
      where ns.nspname = 'public' and rel.relname = t.tbl
        and con.contype = 'u' and array_length(con.conkey, 1) = 1 and att.attname = t.col
    loop
      begin
        execute format('alter table %I drop constraint %I', t.tbl, c.conname);
        raise notice 'dropped global unique % on %.%', c.conname, t.tbl, t.col;
      exception when others then
        raise notice 'could not drop % on % (%): kept', c.conname, t.tbl, sqlerrm;
      end;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
