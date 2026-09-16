-- ==============================================================================
-- 20260916c — WMS Smart Enterprise Expansion Schema
-- Run this migration in Supabase SQL Editor
-- 1. License Plate Numbers (LPN) & Bulk Pallet Tracking
-- 2. Packing QA Sessions & Verification
-- 3. Carrier Shipping Gateway & AWB Logs
-- 4. Stock Adjustment Governance (Maker-Checker Approval)
-- 5. Warehouse Operator Work Logs & Productivity Metrics
-- ==============================================================================

-- 1) License Plate Numbers (LPN Pallet / Master Carton) -----------------------
CREATE TABLE IF NOT EXISTS license_plate_numbers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  branch_id      UUID REFERENCES branches(id),
  lpn_number     TEXT NOT NULL, -- e.g. LPN-2026-0001 or SSCC-18
  lpn_type       TEXT NOT NULL DEFAULT 'PALLET', -- PALLET | MASTER_CARTON | TOTE | CAGE
  location_code  TEXT NOT NULL DEFAULT 'RECEIVING-DOCK',
  status         TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | IN_TRANSIT | CONSUMED | ARCHIVED
  total_weight   NUMERIC(10,2) DEFAULT 0,
  max_weight     NUMERIC(10,2) DEFAULT 1000,
  notes          TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, lpn_number)
);
CREATE INDEX IF NOT EXISTS idx_lpn_number ON license_plate_numbers(org_id, lpn_number);
CREATE INDEX IF NOT EXISTS idx_lpn_loc ON license_plate_numbers(location_code);
ALTER TABLE license_plate_numbers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS lpn_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lpn_id         UUID NOT NULL REFERENCES license_plate_numbers(id) ON DELETE CASCADE,
  sku            TEXT NOT NULL,
  product_name   TEXT DEFAULT '',
  lot_number     TEXT DEFAULT '',
  quantity       NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit           TEXT DEFAULT 'pcs',
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lpn_items_lpn ON lpn_items(lpn_id);
ALTER TABLE lpn_items ENABLE ROW LEVEL SECURITY;

-- 2) Packing QA Sessions & Scan-to-Verify ------------------------------------
CREATE TABLE IF NOT EXISTS packing_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  order_id         TEXT NOT NULL,
  order_no         TEXT NOT NULL,
  packed_by        TEXT NOT NULL DEFAULT 'Operator',
  box_number       INT DEFAULT 1,
  box_type         TEXT DEFAULT 'STANDARD_CARTON',
  actual_weight_kg NUMERIC(8,3) DEFAULT 0,
  est_weight_kg    NUMERIC(8,3) DEFAULT 0,
  weight_status    TEXT DEFAULT 'MATCHED', -- MATCHED | OVERWEIGHT | UNDERWEIGHT | NOT_CHECKED
  status           TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS | COMPLETED | FAILED
  created_at       TIMESTAMPTZ DEFAULT now(),
  completed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pack_order ON packing_sessions(org_id, order_no);
ALTER TABLE packing_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS packing_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES packing_sessions(id) ON DELETE CASCADE,
  sku           TEXT NOT NULL,
  product_name  TEXT DEFAULT '',
  lot_number    TEXT DEFAULT '',
  requested_qty NUMERIC(10,2) NOT NULL,
  verified_qty  NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_verified   BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_pack_items_session ON packing_items(session_id);
ALTER TABLE packing_items ENABLE ROW LEVEL SECURITY;

-- 3) Carrier Shipping Gateway & AWB Tracking ---------------------------------
CREATE TABLE IF NOT EXISTS carrier_shipments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  order_id        TEXT NOT NULL,
  order_no        TEXT NOT NULL,
  carrier_code    TEXT NOT NULL, -- FLASH_EXPRESS | KERRY_EXPRESS | JT_EXPRESS | THAILAND_POST_EMS
  carrier_name    TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  awb_status      TEXT NOT NULL DEFAULT 'LABEL_GENERATED', -- LABEL_GENERATED | PICKED_UP | IN_TRANSIT | DELIVERED | EXCEPTION
  shipping_fee    NUMERIC(10,2) DEFAULT 0,
  recipient_name  TEXT DEFAULT '',
  recipient_phone TEXT DEFAULT '',
  recipient_addr  TEXT DEFAULT '',
  label_payload   JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_carrier_tracking ON carrier_shipments(tracking_number);
ALTER TABLE carrier_shipments ENABLE ROW LEVEL SECURITY;

-- 4) Inventory Adjustment Governance (Maker-Checker) -------------------------
CREATE TABLE IF NOT EXISTS stock_adjustment_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  branch_id        UUID REFERENCES branches(id),
  request_no       TEXT NOT NULL, -- e.g. ADJ-2026-001
  sku              TEXT NOT NULL,
  product_name     TEXT DEFAULT '',
  location_code    TEXT NOT NULL DEFAULT 'Unassigned',
  lot_number       TEXT DEFAULT '',
  system_qty       NUMERIC(12,2) NOT NULL DEFAULT 0,
  counted_qty      NUMERIC(12,2) NOT NULL DEFAULT 0,
  diff_qty         NUMERIC(12,2) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  unit_cost        NUMERIC(12,2) DEFAULT 0,
  total_diff_cost  NUMERIC(12,2) DEFAULT 0,
  reason_code      TEXT NOT NULL, -- DAMAGE | EXPIRED | COUNT_MISMATCH | LOST | FOUND | RETURN_SCRAP
  notes            TEXT DEFAULT '',
  requested_by     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL | APPROVED | REJECTED
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adj_status ON stock_adjustment_requests(org_id, status);
ALTER TABLE stock_adjustment_requests ENABLE ROW LEVEL SECURITY;

-- 5) Warehouse Operator Productivity & Work Logs ------------------------------
CREATE TABLE IF NOT EXISTS operator_work_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  user_id          TEXT NOT NULL,
  user_name        TEXT NOT NULL,
  task_type        TEXT NOT NULL, -- PICKING | PUTAWAY | REPLENISHMENT | PACKING | CYCLE_COUNT
  units_processed  INT NOT NULL DEFAULT 1,
  start_time       TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time         TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INT NOT NULL DEFAULT 0,
  pick_rate_pph    NUMERIC(8,2) DEFAULT 0, -- Units processed per hour
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_logs_user ON operator_work_logs(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_time ON operator_work_logs(created_at);
ALTER TABLE operator_work_logs ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
SELECT 'WMS Smart Enterprise Expansion Migration 20260916c Applied Successfully' AS result;
