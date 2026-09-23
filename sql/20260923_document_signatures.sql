-- Generic e-signatures for any printed document -------------------------------
-- One row per (document, signature slot). Lets operators/customers sign on the
-- phone straight on a document (delivery note, GRN, QC handover, return, …) to
-- cut paper — while the printed form still carries the pen line for anyone who
-- must sign on paper. Signatures are stored as trimmed JPEG data URLs.
create table if not exists document_signatures (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null default '00000000-0000-0000-0000-000000000001',
  doc_type    text not null,                 -- delivery-note | receipt | qc-handover | return | damage-report | cycle-count | purchase-order | picking-slip
  doc_id      text not null,                 -- the document's id / no
  role        text not null,                 -- receiver | sender | qc | picker | approver | supplier ...
  signer_name text default '',
  data_url    text not null,                 -- data:image/jpeg;base64,...
  signed_at   timestamptz not null default now(),
  unique (org_id, doc_type, doc_id, role)
);
create index if not exists idx_doc_sig_lookup on document_signatures (org_id, doc_type, doc_id);

alter table document_signatures enable row level security;

notify pgrst, 'reload schema';
