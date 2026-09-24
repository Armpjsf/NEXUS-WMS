-- ==============================================================================
-- NEXUS WMS: Fleet vehicles + assigned-vehicle/driver on orders (cross-dock)
-- รันใน Supabase (WMS) SQL Editor ครั้งเดียว
-- ==============================================================================

-- 1) ตารางรถบริษัท (ให้เช็คเกอร์เลือกทะเบียนตอนส่งของขึ้นรถ)
CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  plate TEXT NOT NULL,
  driver_name TEXT DEFAULT '',
  vehicle_type TEXT DEFAULT '4-Wheel',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_org ON fleet_vehicles(org_id);
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;

-- 2) เก็บรถ/คนขับที่เลือก ลงในออเดอร์ (ต่อ TMS)
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS driver_name TEXT;

-- 3) รีโหลด schema cache (กัน PGRST205 หลังสร้างตาราง/คอลัมน์ใหม่)
NOTIFY pgrst, 'reload schema';

SELECT 'Fleet + multi-drop migration completed!' AS status;
