-- C5: Carrier rate-shopping.
-- Rate cards per carrier/zone/weight-band; the rate-shop API returns the
-- cheapest carrier for a given shipment weight + zone.

create table if not exists carrier_rates (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  carrier      text not null,
  zone         text not null default 'ALL',      -- destination zone / region
  min_weight   numeric not null default 0,        -- kg (inclusive)
  max_weight   numeric not null default 999999,   -- kg (inclusive)
  price        numeric not null default 0,        -- THB
  eta_days     int,                               -- estimated days
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_carrier_rates_org on carrier_rates (org_id, zone, active);

notify pgrst, 'reload schema';
