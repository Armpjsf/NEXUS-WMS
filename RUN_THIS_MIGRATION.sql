-- ==============================================================================
-- NEXUS WMS: MASTER DATABASE MIGRATION (รันไฟล์นี้ใน Supabase SQL Editor ครั้งเดียวจบ)
-- รองรับ: WMS ↔ TMS Integration, FEFO Lot/Expiry, สาขา URT, และ Stock Transfers
-- ==============================================================================

-- 1. เพิ่มคอลัมน์ TMS Integration & Branch Code ในตารางออเดอร์ (outbound_orders)
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS branch_code TEXT DEFAULT 'URT';
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT '4-Wheel';
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS tms_job_id TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS tms_status TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS tms_synced_at TIMESTAMPTZ;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS destinations_json JSONB;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS qc_signatures JSONB;

CREATE INDEX IF NOT EXISTS idx_ob_orders_tms_job ON outbound_orders(tms_job_id);
CREATE INDEX IF NOT EXISTS idx_ob_orders_branch ON outbound_orders(branch_code);

-- 2. เพิ่มคอลัมน์ Batch/Lot No. และ วันหมดอายุ FEFO ในตารางสินค้า (products)
ALTER TABLE products ADD COLUMN IF NOT EXISTS lot_no TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mfg_date DATE;

CREATE INDEX IF NOT EXISTS idx_products_expiry_date ON products(expiry_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_products_lot_no ON products(lot_no);

-- 3. ตารางสาขา (branches) และตั้งค่าสาขา URT (สุราษฎร์ธานี) พร้อมชื่อคลังสินค้า
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  warehouse_name TEXT,
  pickup_address TEXT,
  color TEXT DEFAULT 'teal',
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, code)
);

-- เพิ่มคอลัมน์ในกรณีตาราง branches มีอยู่แล้ว
ALTER TABLE branches ADD COLUMN IF NOT EXISTS warehouse_name TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS pickup_address TEXT;

-- เพิ่มสาขา URT สำหรับ Tenant ปัจจุบัน
INSERT INTO branches (org_id, code, name, warehouse_name, color, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'URT', 'สาขาสุราษฎร์ธานี (URT)', 'คลังสินค้า สุราษฎร์ธานี', 'teal', 'ACTIVE')
ON CONFLICT (org_id, code) DO UPDATE
SET name = 'สาขาสุราษฎร์ธานี (URT)', warehouse_name = COALESCE(branches.warehouse_name, 'คลังสินค้า สุราษฎร์ธานี'), status = 'ACTIVE';

-- 4. ตารางใบโอนย้ายสต็อกข้ามสาขา (stock_transfers)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  transfer_no TEXT NOT NULL,
  from_branch_id TEXT NOT NULL DEFAULT 'URT',
  to_branch_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_qty INTEGER DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_org ON stock_transfers(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_no ON stock_transfers(transfer_no);

-- ==============================================================================
-- ตรวจสอบผลลัพธ์
-- ==============================================================================
SELECT 'Migration completed successfully!' AS status;
