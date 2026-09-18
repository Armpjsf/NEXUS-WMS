-- C4: EDI / ASN (Advanced Shipping Notice).
-- Supplier notifies of incoming goods before arrival; the ASN is later
-- converted into a normal receipt (createReceipt) so receiving is unchanged.

create table if not exists asn_headers (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  asn_no       text not null,
  supplier     text,
  po_number    text,
  eta          date,
  status       text not null default 'PENDING',   -- PENDING | RECEIVED | CANCELLED
  receipt_id   text,                               -- linked receipt once converted
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, asn_no)
);

create table if not exists asn_lines (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  asn_id       uuid not null references asn_headers(id) on delete cascade,
  sku          text not null,
  name         text,
  expected_qty numeric not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_asn_headers_org on asn_headers (org_id, status, created_at desc);
create index if not exists idx_asn_lines_asn on asn_lines (asn_id);

notify pgrst, 'reload schema';
