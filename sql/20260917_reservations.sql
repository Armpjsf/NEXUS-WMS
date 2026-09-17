-- A1: Stock reservation / ATP on the multi-bin model.
-- available(sku) = products.stock  −  Σ qty_reserved of ACTIVE reservations.
-- Reserving at order creation stops two orders from selling the same unit;
-- the reservation is CONSUMED when the order ships (stock is deducted then) and
-- RELEASED if the order is cancelled.

create table if not exists stock_reservations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  order_id       text not null,
  order_no       text,
  sku            text not null,
  qty_requested  numeric not null default 0,
  qty_reserved   numeric not null default 0,   -- may be < requested when backordered
  status         text not null default 'ACTIVE', -- ACTIVE | CONSUMED | RELEASED
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_stock_res_org_sku_status on stock_reservations (org_id, sku, status);
create index if not exists idx_stock_res_order on stock_reservations (org_id, order_id);

notify pgrst, 'reload schema';
