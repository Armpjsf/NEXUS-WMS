-- ============================================================================
-- 20260925 — Real cost, shared rate limiting, multi-org membership
-- ----------------------------------------------------------------------------
-- 1. products.cost_price + stock_transactions.unit_cost
--    The system never stored a cost: IN transactions recorded the SELLING
--    price, and the valuation report guessed cost = 68% of retail. Receipts
--    linked to a PO now record the PO unit cost and keep a moving-average
--    cost on the product; cost can also be set by hand / via import.
-- 2. rate_limits + wms_rate_hit()
--    Login / signup throttling shared by every serverless instance (the old
--    limiter lived in one instance's memory).
-- 3. org_memberships
--    One user can work in several organizations with a role per org; the
--    app_users.org_id row stays the user's home org.
--
-- Idempotent — safe to re-run. Run in Supabase SQL editor.
-- ============================================================================

-- 1) Cost ---------------------------------------------------------------------
alter table products           add column if not exists cost_price numeric;
alter table stock_transactions add column if not exists unit_cost  numeric;

create index if not exists idx_stock_tx_org_sku_created
  on stock_transactions (org_id, sku, created_at desc);

-- 2) Shared rate limiter ---------------------------------------------------------
create table if not exists rate_limits (
  bucket_key   text primary key,
  hits         int not null default 0,
  window_start timestamptz not null default now()
);
alter table rate_limits enable row level security;  -- service role only

-- Atomically count one hit. Returns the hit count inside the current window
-- (the window restarts once it is older than p_window_ms).
create or replace function wms_rate_hit(p_key text, p_window_ms int)
returns int
language sql
security definer
set search_path = public
as $$
  insert into rate_limits as r (bucket_key, hits, window_start)
  values (p_key, 1, now())
  on conflict (bucket_key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_ms / 1000.0)
                    then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_ms / 1000.0)
                    then now() else r.window_start end
  returning hits;
$$;
revoke all on function wms_rate_hit(text, int) from public, anon, authenticated;
grant execute on function wms_rate_hit(text, int) to service_role;

delete from rate_limits where window_start < now() - interval '1 day';

-- 3) Multi-org membership --------------------------------------------------------
create table if not exists org_memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,                 -- app_users.id
  org_id     uuid not null references organizations(id) on delete cascade,
  role       text not null default 'Staff',
  allowed_branches jsonb default '["*"]'::jsonb,
  added_by   text default '',
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);
create index if not exists idx_org_memberships_user on org_memberships (user_id);
create index if not exists idx_org_memberships_org  on org_memberships (org_id);
alter table org_memberships enable row level security;  -- service role only

notify pgrst, 'reload schema';
