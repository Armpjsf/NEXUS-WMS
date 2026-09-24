-- ==============================================================================
-- WMS 360 PRO (CORE ENTERPRISE) - SUPABASE DATABASE SCHEMA
-- PostgreSQL schema for Products, Warehouse Bins, Stock Transactions, Waves & Marketplaces
-- ==============================================================================

-- 0. TENANCY (multi-org / multi-branch) — P3
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    plan TEXT DEFAULT 'FREE',          -- FREE | PRO | ENTERPRISE
    branding_logo TEXT DEFAULT '',
    branding_color TEXT DEFAULT '#0ea5e9',
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'indigo',
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (org_id, code)
);

CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    username TEXT NOT NULL,
    email TEXT DEFAULT '',
    role TEXT DEFAULT 'Staff',
    status TEXT DEFAULT 'Active',
    password_hash TEXT DEFAULT '',
    allowed_branches TEXT[] DEFAULT ARRAY['*'],
    allowed_owners TEXT[] DEFAULT ARRAY['*'],
    last_login TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(lower(username));

-- Seed a default organization + HQ branch (single-tenant bootstrap)
INSERT INTO organizations (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'WMS 360', 'wms360', 'ENTERPRISE')
ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (org_id, code, name, color)
VALUES ('00000000-0000-0000-0000-000000000001', 'HQ', 'สำนักงานใหญ่ (HQ)', 'indigo')
ON CONFLICT (org_id, code) DO NOTHING;

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    stock NUMERIC DEFAULT 0,
    min_stock NUMERIC DEFAULT 5,
    unit TEXT DEFAULT 'pcs',
    price NUMERIC DEFAULT 0,
    location TEXT DEFAULT 'Unassigned',
    barcode TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE' | 'INACTIVE'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by SKU and Barcode
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_location ON products(location);

-- 2. WAREHOUSE LOCATIONS (ZONES, AISLES, RACKS, BINS)
CREATE TABLE IF NOT EXISTS warehouse_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bin_code TEXT UNIQUE NOT NULL, -- e.g. 'A-01-01'
    zone TEXT NOT NULL, -- e.g. 'A'
    aisle INT NOT NULL, -- e.g. 1
    rack INT NOT NULL, -- e.g. 1
    shelf INT DEFAULT 1,
    capacity_limit INT DEFAULT 100,
    status TEXT DEFAULT 'AVAILABLE', -- 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_bin ON warehouse_locations(bin_code);
CREATE INDEX IF NOT EXISTS idx_locations_zone ON warehouse_locations(zone);

-- 3. STOCK TRANSACTIONS (INBOUND, OUTBOUND, ADJUST, DAMAGE)
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'IN' | 'OUT' | 'ADJUST' | 'DAMAGE'
    sku TEXT NOT NULL,
    product_name TEXT,
    qty NUMERIC NOT NULL,
    unit_price NUMERIC DEFAULT 0,
    doc_ref TEXT,
    location TEXT,
    batch_no TEXT,
    expiry_date DATE,
    user_name TEXT DEFAULT 'Warehouse Staff',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_sku ON stock_transactions(sku);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON stock_transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON stock_transactions(created_at DESC);

-- 4. SMART PICKING WAVES
CREATE TABLE IF NOT EXISTS picking_waves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wave_number TEXT UNIQUE NOT NULL, -- e.g. 'WAVE-260820-001'
    status TEXT DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
    picker_name TEXT DEFAULT 'Picker 1',
    total_items INT DEFAULT 0,
    total_qty INT DEFAULT 0,
    picked_qty INT DEFAULT 0,
    items_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CYCLE COUNTS (BLIND / AUDIT)
CREATE TABLE IF NOT EXISTS cycle_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_date DATE DEFAULT CURRENT_DATE,
    note TEXT,
    total_counted INT DEFAULT 0,
    total_variance NUMERIC DEFAULT 0,
    items_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5.5 CYCLE COUNT LOGS (per-item counts, matches legacy CycleCount_Log)
CREATE TABLE IF NOT EXISTS cycle_count_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL,
    location TEXT DEFAULT '-',
    due_date TEXT,
    count_date TEXT,
    inspector TEXT DEFAULT 'System',
    notes TEXT DEFAULT '',
    system_qty NUMERIC DEFAULT 0,
    actual_qty NUMERIC DEFAULT 0,
    variance NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Unknown', -- 'Match' | 'Discrepancy'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cclog_created ON cycle_count_logs(created_at DESC);

-- 6. MARKETPLACE ORDERS (SHOPEE, TIKTOK, LAZADA)
CREATE TABLE IF NOT EXISTS marketplace_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL, -- 'SHOPEE' | 'TIKTOK' | 'LAZADA' | 'CUSTOM'
    order_no TEXT NOT NULL,
    tracking_no TEXT,
    customer_name TEXT,
    phone TEXT,
    address TEXT,
    postal_code TEXT,
    sku TEXT NOT NULL,
    product_name TEXT,
    qty INT DEFAULT 1,
    price NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'READY_TO_PICK', -- 'READY_TO_PICK' | 'PICKED' | 'SHIPPED'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_orders_platform ON marketplace_orders(platform);
CREATE INDEX IF NOT EXISTS idx_mkt_orders_orderno ON marketplace_orders(order_no);

-- 6.4 PURCHASE ORDERS (system-owned, generic — not tied to any customer)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT UNIQUE NOT NULL, -- e.g. 'PO-260820-001'
    status TEXT DEFAULT 'DRAFT', -- 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
    supplier TEXT DEFAULT '',
    total_amount NUMERIC DEFAULT 0,
    total_items INT DEFAULT 0,
    items_json JSONB DEFAULT '[]'::jsonb, -- [{ sku, name, qty, price, total }]
    created_by TEXT DEFAULT 'System',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

-- 6.41 OUTBOUND ORDERS (เบิก→หยิบ→แพ็ก→จัดส่ง→POD) — spine ของ loop ขาออก
CREATE TABLE IF NOT EXISTS outbound_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no TEXT UNIQUE NOT NULL,       -- 'ORD-YYMMDD-NNN'
    channel TEXT DEFAULT 'MANUAL',       -- MANUAL | SHOPEE | TIKTOK | LAZADA | ...
    ref_no TEXT DEFAULT '',              -- เลขอ้างอิงต้นทาง (ออเดอร์ marketplace ฯลฯ)
    customer_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    ship_address TEXT DEFAULT '',
    status TEXT DEFAULT 'NEW',           -- NEW | PICKING | PICKED | PACKED | SHIPPED | DELIVERED | CANCELLED
    priority TEXT DEFAULT 'NORMAL',      -- LOW | NORMAL | HIGH | URGENT
    items_json JSONB DEFAULT '[]'::jsonb, -- [{ sku, name, qty, picked, packed, location, price }]
    total_qty INT DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    carrier TEXT DEFAULT '',
    tracking_no TEXT DEFAULT '',
    box_count INT DEFAULT 0,
    weight_kg NUMERIC DEFAULT 0,
    pod_signature TEXT DEFAULT '',       -- ลายเซ็น (data url / storage url)
    pod_photo TEXT DEFAULT '',           -- รูปหลักฐานส่ง
    pod_note TEXT DEFAULT '',
    created_by TEXT DEFAULT 'System',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    picked_at TIMESTAMPTZ,
    packed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ob_orders_status ON outbound_orders(status);
CREATE INDEX IF NOT EXISTS idx_ob_orders_created ON outbound_orders(created_at DESC);

-- 6.42 RECEIPTS (รับเข้า + จัดเก็บ putaway) — spine ของ loop ขาเข้า
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_no TEXT UNIQUE NOT NULL,     -- 'GRN-YYMMDD-NNN'
    po_number TEXT DEFAULT '',           -- อ้าง purchase_orders.po_number (ถ้ามี)
    supplier TEXT DEFAULT '',
    status TEXT DEFAULT 'EXPECTED',      -- EXPECTED | RECEIVING | PUTAWAY | DONE | CANCELLED
    items_json JSONB DEFAULT '[]'::jsonb, -- [{ sku, name, expected_qty, received_qty, putaway_bin, done }]
    created_by TEXT DEFAULT 'System',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    received_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);

-- 6.43 RETURN ORDERS (RMA — คืนสินค้า)
CREATE TABLE IF NOT EXISTS return_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rma_no TEXT UNIQUE NOT NULL,         -- 'RMA-YYMMDD-NNN'
    order_no TEXT DEFAULT '',            -- อ้าง outbound_orders.order_no
    customer_name TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    status TEXT DEFAULT 'REQUESTED',     -- REQUESTED | APPROVED | RECEIVED | RESTOCKED | SCRAPPED | REJECTED
    disposition TEXT DEFAULT '',         -- RESTOCK | SCRAP
    items_json JSONB DEFAULT '[]'::jsonb, -- [{ sku, name, qty }]
    created_by TEXT DEFAULT 'System',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rma_status ON return_orders(status);

-- 6.5 DAMAGE RECORDS (own lifecycle: report -> approve -> send to HQ)
CREATE TABLE IF NOT EXISTS damage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE DEFAULT CURRENT_DATE,
    product_name TEXT NOT NULL,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'ชิ้น',
    reason TEXT,
    notes TEXT,
    reported_by TEXT DEFAULT 'System',
    status TEXT DEFAULT 'รอดำเนินการ', -- 'รอดำเนินการ' | 'อนุมัติ' | 'ปฏิเสธ'
    approved_by TEXT DEFAULT '',
    approved_date TEXT DEFAULT '',
    sent_to_hq TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_damage_created ON damage_records(created_at DESC);

-- 6.56 CUSTOMERS (Master data for buyers / delivery destinations)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,           -- e.g. 'CUST-001'
    name TEXT NOT NULL,
    tax_id TEXT DEFAULT '',
    branch_number TEXT DEFAULT '00000',  -- สาขา เช่น สำนักงานใหญ่
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    postal_code TEXT DEFAULT '',
    default_carrier TEXT DEFAULT '',
    contact_person TEXT DEFAULT '',
    payment_term TEXT DEFAULT 'CASH',    -- CASH | CREDIT_30 | CREDIT_60
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(lower(name));

-- 6.57 CARRIERS (Logistics service providers)
CREATE TABLE IF NOT EXISTS carriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,           -- e.g. 'FLASH', 'KERRY', 'JNT', 'EMS'
    name TEXT NOT NULL,
    tracking_url_template TEXT DEFAULT '', -- e.g. 'https://www.flashexpress.co.th/tracking/?se={trackingNo}'
    phone TEXT DEFAULT '',
    contact_name TEXT DEFAULT '',
    is_default BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_carriers_code ON carriers(code);

-- 6.58 SUPPLIERS (Vendors for Purchase Orders & Receiving)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,           -- e.g. 'SUPP-001'
    name TEXT NOT NULL,
    tax_id TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    contact_person TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);

-- Seed Default Carriers in Thailand
INSERT INTO carriers (code, name, tracking_url_template, phone, is_default)
VALUES
    ('FLASH', 'Flash Express', 'https://www.flashexpress.co.th/tracking/?se={trackingNo}', '1436', true),
    ('KERRY', 'Kerry Express / KEX', 'https://th.kerryexpress.com/th/track/?track={trackingNo}', '1217', false),
    ('JNT', 'J&T Express', 'https://www.jtexpress.co.th/service/track?bills={trackingNo}', '1470', false),
    ('EMS', 'ไปรษณีย์ไทย (Thailand Post EMS)', 'https://track.thailandpost.co.th/?trackNumber={trackingNo}', '1545', false),
    ('SPX', 'Shopee Xpress (SPX)', 'https://spx.co.th/m/track?tracking_number={trackingNo}', '02-017-8399', false),
    ('LEX', 'Lazada Express (LEX)', 'https://tracker.lel.asia/tracker?tradeOrderNumber={trackingNo}', '02-018-0000', false),
    ('LINEMAN', 'LINE MAN Messenger', '', '02-026-6555', false),
    ('LALAMOVE', 'Lalamove Delivery', '', '02-034-5252', false),
    ('OWN_FLEET', 'รถขนส่งของบริษัท (จัดส่งเอง)', '', '', false)
ON CONFLICT (code) DO NOTHING;

-- Seed Sample Customer & Supplier
INSERT INTO customers (code, name, phone, address, postal_code, default_carrier, contact_person)
VALUES
    ('CUST-001', 'บริษัท สยาม รีเทล จำกัด (สำนักงานใหญ่)', '02-123-4567', '99/1 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ', '10110', 'Flash Express', 'คุณสมชาย ใจดี'),
    ('CUST-002', 'ห้างหุ้นส่วนจำกัด บางกอก โลจิสติกส์', '089-987-6543', '123/45 ถ.บางนา-ตราด ต.บางแก้ว อ.บางพลี สมุทรปราการ', '10540', 'Kerry Express / KEX', 'คุณวรัญญา สดใส')
ON CONFLICT (code) DO NOTHING;

INSERT INTO suppliers (code, name, phone, email, address, contact_person)
VALUES
    ('SUPP-001', 'บริษัท แพคเกจจิ้ง ซัพพลาย ไทย จำกัด', '02-888-9999', 'sales@packagethai.com', '555 หมู่ 2 นิคมอุตสาหกรรมบางปู สมุทรปราการ', 'คุณกิตติศักดิ์'),
    ('SUPP-002', 'บริษัท วัตถุดิบคลังสินค้า จำกัด', '02-777-6666', 'contact@warehouse-mat.com', '88 ถ.พหลโยธิน ต.คลองหนึ่ง อ.คลองหลวง ปทุมธานี', 'คุณนภาลัย')
ON CONFLICT (code) DO NOTHING;

-- Extra product columns used by the UI (owner / movement classification)
ALTER TABLE products ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS movement_status TEXT;

-- 6.55 AUDIT LOG (who did what, system-wide)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ DEFAULT now(),
    user_id TEXT DEFAULT '',
    user_name TEXT DEFAULT '',
    action TEXT DEFAULT 'VIEW', -- CREATE | UPDATE | DELETE | VIEW | EXPORT
    module TEXT DEFAULT '',
    record_id TEXT DEFAULT '',
    description TEXT DEFAULT '',
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_log(module);

-- 6.6 DEVICE TOKENS (FCM push targets — system infra)
CREATE TABLE IF NOT EXISTS device_tokens (
    token TEXT PRIMARY KEY,
    platform TEXT DEFAULT 'unknown',
    last_active TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6.65 WEB PUSH SUBSCRIPTIONS (browser/PWA push, separate from native FCM tokens)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6.7 PER-USER CONFIG (key/value per user email)
CREATE TABLE IF NOT EXISTS user_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    config_key TEXT NOT NULL,
    config_value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_email, config_key)
);

-- 6.8 AUTOMATION RULES (system-owned)
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- 'STOCK_LEVEL' | 'TRANSACTION' | 'SCHEDULE'
    condition TEXT DEFAULT '{}', -- JSON string
    action TEXT DEFAULT '{}',    -- JSON string
    is_active BOOLEAN DEFAULT true,
    last_triggered TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. INITIAL SAMPLE WAREHOUSE BINS (ZONE A, B, C)
INSERT INTO warehouse_locations (bin_code, zone, aisle, rack, shelf)
VALUES
    ('A-01-01', 'A', 1, 1, 1), ('A-01-02', 'A', 1, 2, 1), ('A-01-03', 'A', 1, 3, 1), ('A-01-04', 'A', 1, 4, 1),
    ('A-02-01', 'A', 2, 1, 1), ('A-02-02', 'A', 2, 2, 1), ('A-02-03', 'A', 2, 3, 1), ('A-02-04', 'A', 2, 4, 1),
    ('B-01-01', 'B', 1, 1, 1), ('B-01-02', 'B', 1, 2, 1), ('B-01-03', 'B', 1, 3, 1), ('B-01-04', 'B', 1, 4, 1),
    ('B-02-01', 'B', 2, 1, 1), ('B-02-02', 'B', 2, 2, 1), ('B-02-03', 'B', 2, 3, 1), ('B-02-04', 'B', 2, 4, 1),
    ('C-01-01', 'C', 1, 1, 1), ('C-01-02', 'C', 1, 2, 1), ('C-01-03', 'C', 1, 3, 1), ('C-01-04', 'C', 1, 4, 1),
    ('C-02-01', 'C', 2, 1, 1), ('C-02-02', 'C', 2, 2, 1), ('C-02-03', 'C', 2, 3, 1), ('C-02-04', 'C', 2, 4, 1)
ON CONFLICT (bin_code) DO NOTHING;

-- 8. INITIAL SAMPLE PRODUCTS
INSERT INTO products (sku, name, category, stock, min_stock, unit, price, location, barcode)
VALUES
    ('SKU-BOX-01', 'กล่องไปรษณีย์ ฝาชน เบอร์ A', 'Packaging', 150, 20, 'pcs', 45, 'A-01-01', '8850001001'),
    ('SKU-TAPE-02', 'เทปกาวใสปิดกล่อง 2 นิ้ว 100 หลา', 'Packaging', 80, 15, 'rolls', 35, 'A-01-02', '8850001002'),
    ('SKU-BUBBLE-03', 'พลาสติกกันกระแทก Air Bubble 65cm x 100m', 'Protection', 25, 5, 'rolls', 280, 'B-01-01', '8850001003'),
    ('SKU-BAG-04', 'ซองพลาสติกไปรษณีย์กันน้ำ A3', 'Packaging', 300, 50, 'pcs', 12, 'A-02-01', '8850001004'),
    ('SKU-STRAP-05', 'สายรัดพลาสติก PP Band 15mm', 'Heavy Goods', 10, 2, 'rolls', 520, 'C-01-01', '8850001005')
ON CONFLICT (sku) DO NOTHING;

-- Enable Row Level Security (RLS) - Optional for Public Read/Write
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE picking_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_count_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- 9. STORAGE BUCKET for product images (public read; uploads done server-side via service role)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pod-images', 'pod-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images" ON storage.objects
    FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Public read pod images" ON storage.objects;
CREATE POLICY "Public read pod images" ON storage.objects
    FOR SELECT USING (bucket_id = 'pod-images');

-- ==============================================================================
-- P3: MULTI-TENANCY (org_id) + LOCKED-DOWN RLS
-- ==============================================================================
-- Every data row belongs to an organization. Column DEFAULT tags all inserts
-- with the seed org automatically, so existing app code needs no change; the
-- app layer scopes by org when more than one org exists.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','warehouse_locations','stock_transactions','picking_waves',
    'cycle_counts','cycle_count_logs','marketplace_orders','damage_records',
    'purchase_orders','outbound_orders','receipts','return_orders',
    'device_tokens','user_config','automation_rules','audit_log','push_subscriptions',
    'customers','carriers','suppliers'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT ''00000000-0000-0000-0000-000000000001'' REFERENCES organizations(id)', t);
  END LOOP;
END $$;

-- Lock RLS: DROP every permissive "Allow public read-write%" policy across all
-- tenant tables. RLS stays ENABLED, so with no permissive policy the public
-- anon/authenticated roles get ZERO direct table access. The server always
-- talks to Supabase with the SERVICE ROLE key, which bypasses RLS — so the app
-- keeps working while the public anon key can no longer read/write any table.
-- (Storage buckets keep their separate public-READ policies for <img> loading.)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'Allow public read-write%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;
