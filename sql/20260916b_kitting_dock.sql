-- ==============================================================================
-- 20260916b — ตารางจริงแทน in-memory: kitting (bill_of_materials) + dock (dock_appointments)
-- รันไฟล์นี้ใน Supabase SQL Editor (โปรเจกต์ nextjs-wms-core)
-- ยึดแพตเทิร์นเดิม: org_id default seed-org, RLS ENABLED แบบล็อก (server ใช้ service role key)
-- ==============================================================================

-- 1) สูตรชุดสินค้า Kitting (Bill of Materials) --------------------------------
CREATE TABLE IF NOT EXISTS bill_of_materials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  kit_sku             TEXT NOT NULL,
  kit_name            TEXT NOT NULL,
  version             TEXT DEFAULT '1.0',
  assembly_labor_cost NUMERIC(12,2) DEFAULT 0,
  status              TEXT DEFAULT 'ACTIVE',                 -- ACTIVE | OBSOLETE
  components          JSONB DEFAULT '[]'::jsonb,             -- [{componentSku,componentName,quantity,unit}]
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bom_org ON bill_of_materials(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bom_org_kitsku ON bill_of_materials(org_id, kit_sku);
ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;   -- ไม่มี policy = ปิด anon; server ใช้ service role

-- 2) คิวเทียบท่า Dock Appointments ------------------------------------------
CREATE TABLE IF NOT EXISTS dock_appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  branch_id           UUID REFERENCES branches(id),
  appointment_number  TEXT,
  bay_name            TEXT NOT NULL,
  appointment_type    TEXT NOT NULL DEFAULT 'INBOUND',       -- INBOUND | OUTBOUND
  supplier_or_carrier TEXT DEFAULT '',
  vehicle_plate       TEXT DEFAULT '',
  driver_name         TEXT DEFAULT '',
  driver_phone        TEXT DEFAULT '',
  scheduled_start     TIMESTAMPTZ,
  scheduled_end       TIMESTAMPTZ,
  pallets_count       INT DEFAULT 1,
  status              TEXT DEFAULT 'BOOKED',                 -- BOOKED | CHECKED_IN | AT_BAY | COMPLETED | CANCELLED
  notes               TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dock_apt_org    ON dock_appointments(org_id);
CREATE INDEX IF NOT EXISTS idx_dock_apt_start  ON dock_appointments(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_dock_apt_bay    ON dock_appointments(bay_name);
ALTER TABLE dock_appointments ENABLE ROW LEVEL SECURITY;

-- 3) รีโหลด schema cache (กัน PGRST205 หลังสร้างตารางใหม่) -----------------------
NOTIFY pgrst, 'reload schema';

SELECT 'bill_of_materials + dock_appointments migration completed!' AS status;
