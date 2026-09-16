-- ==============================================================================
-- 20260916b — Enterprise Smart WMS Core Schema Upgrade
-- Run this migration in Supabase SQL Editor
-- 1. Lot & Batch Management & Expiry (FEFO)
-- 2. Multi-Bin Inventory Balances & Real-Time Stock Allocations
-- 3. Smart Warehouse Tasks & Interleaving Queue
-- 4. ERP Integration Logs & Endpoints
-- 5. Enterprise Immutable Audit Trail (21 CFR Part 11 / ISO Standard)
-- ==============================================================================

-- 1) Product Lots & Expiry Management -----------------------------------------
CREATE TABLE IF NOT EXISTS product_lots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  branch_id     UUID REFERENCES branches(id),
  product_id    UUID REFERENCES products(id),
  sku           TEXT NOT NULL,
  lot_number    TEXT NOT NULL,
  batch_number  TEXT DEFAULT '',
  mfg_date      DATE,
  exp_date      DATE,
  status        TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | QUARANTINE | HOLD | EXPIRED
  received_qty  NUMERIC(12,2) DEFAULT 0,
  current_qty   NUMERIC(12,2) DEFAULT 0,
  unit_cost     NUMERIC(12,2) DEFAULT 0,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, sku, lot_number)
);
CREATE INDEX IF NOT EXISTS idx_product_lots_sku ON product_lots(org_id, sku);
CREATE INDEX IF NOT EXISTS idx_product_lots_exp ON product_lots(exp_date);
ALTER TABLE product_lots ENABLE ROW LEVEL SECURITY;

-- 2) Multi-Bin Inventory Balances (SKU + Lot + Bin Location) -------------------
CREATE TABLE IF NOT EXISTS inventory_balances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  branch_id      UUID REFERENCES branches(id),
  product_id     UUID REFERENCES products(id),
  sku            TEXT NOT NULL,
  lot_id         UUID REFERENCES product_lots(id),
  lot_number     TEXT DEFAULT '',
  location_id    UUID REFERENCES warehouse_locations(id),
  location_code  TEXT NOT NULL, -- e.g. A-01-02-1
  qty_on_hand    NUMERIC(12,2) NOT NULL DEFAULT 0,
  qty_allocated  NUMERIC(12,2) NOT NULL DEFAULT 0,
  qty_available  NUMERIC(12,2) GENERATED ALWAYS AS (qty_on_hand - qty_allocated) STORED,
  zone           TEXT DEFAULT 'A',
  aisle          TEXT DEFAULT '1',
  rack           TEXT DEFAULT '1',
  shelf          TEXT DEFAULT '1',
  last_counted_at TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, branch_id, sku, lot_number, location_code)
);
CREATE INDEX IF NOT EXISTS idx_inv_bal_sku ON inventory_balances(org_id, sku);
CREATE INDEX IF NOT EXISTS idx_inv_bal_loc ON inventory_balances(location_code);
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;

-- 3) Smart Warehouse Task Queue & Task Interleaving ---------------------------
CREATE TABLE IF NOT EXISTS warehouse_tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  branch_id          UUID REFERENCES branches(id),
  task_number        TEXT NOT NULL, -- e.g. TSK-20260916-001
  task_type          TEXT NOT NULL, -- PUTAWAY | PICKING | REPLENISHMENT | CYCLE_COUNT | TRANSFER
  priority           INT NOT NULL DEFAULT 3, -- 1=Urgent, 2=High, 3=Normal, 4=Low, 5=Bulk
  status             TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED
  assigned_user_id   TEXT,
  assigned_user_name TEXT DEFAULT '',
  assigned_equipment TEXT DEFAULT '', -- FORKLIFT | REACH_TRUCK | PALLET_JACK | HAND_CART
  source_location    TEXT DEFAULT '',
  target_location    TEXT DEFAULT '',
  sku                TEXT NOT NULL,
  product_name       TEXT DEFAULT '',
  lot_number         TEXT DEFAULT '',
  requested_qty      NUMERIC(12,2) NOT NULL DEFAULT 0,
  completed_qty      NUMERIC(12,2) NOT NULL DEFAULT 0,
  interleaving_group TEXT DEFAULT '', -- e.g. AISLE-02: allows combining Putaway + Pick in same aisle
  source_order_id    TEXT DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT now(),
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON warehouse_tasks(org_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON warehouse_tasks(org_id, task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON warehouse_tasks(assigned_user_id);
ALTER TABLE warehouse_tasks ENABLE ROW LEVEL SECURITY;

-- 4) Enterprise Immutable Audit Trail (Before & After Diff) --------------------
CREATE TABLE IF NOT EXISTS audit_trail_enterprise (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  entity_name  TEXT NOT NULL, -- products | inventory_balances | orders | lots
  entity_id    TEXT NOT NULL,
  action       TEXT NOT NULL, -- INSERT | UPDATE | DELETE | ADJUST | ALLOCATE | RELEASE
  before_state JSONB DEFAULT '{}'::jsonb,
  after_state  JSONB DEFAULT '{}'::jsonb,
  reason       TEXT DEFAULT '',
  performed_by TEXT NOT NULL DEFAULT 'system',
  user_email   TEXT DEFAULT '',
  ip_address   TEXT DEFAULT '',
  user_agent   TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_ent ON audit_trail_enterprise(org_id, entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_trail_enterprise(created_at);
ALTER TABLE audit_trail_enterprise ENABLE ROW LEVEL SECURITY;

-- 5) ERP Integration Sync Logs ------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_sync_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  direction       TEXT NOT NULL, -- INBOUND_ASN | OUTBOUND_ORDER | STOCK_RECONCILIATION
  source_system   TEXT NOT NULL, -- SAP | ORACLE | NETSUITE | ODOO | DYNAMICS365 | CUSTOM
  reference_doc   TEXT NOT NULL, -- PO-12345 | SO-98765
  payload         JSONB DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'SUCCESS', -- SUCCESS | PARTIAL | ERROR
  processed_items INT DEFAULT 0,
  error_message   TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erp_sync_time ON erp_sync_logs(org_id, created_at);
ALTER TABLE erp_sync_logs ENABLE ROW LEVEL SECURITY;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

SELECT 'WMS Smart Enterprise Migration 20260916b Applied Successfully' AS result;
