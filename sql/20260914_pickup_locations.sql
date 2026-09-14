-- คลังจุดรับสินค้า (pickup points) พร้อมพิกัด — ใช้ตอนเช็คเกอร์สร้างงาน cross-dock
-- จุดรับต่างกันต่องาน แต่เก็บพิกัดไว้ต่อลูกค้า/จุด เพื่อเลือกซ้ำได้
-- รันใน Supabase SQL editor ของโปรเจกต์ WMS

CREATE TABLE IF NOT EXISTS pickup_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL, -- null = จุดกลาง ใช้ได้ทุกลูกค้า
    name TEXT NOT NULL,            -- ชื่อจุดรับ เช่น "คลังลูกค้า A ลาดกระบัง"
    address TEXT DEFAULT '',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    is_default BOOLEAN DEFAULT false, -- จุดเริ่มต้นของลูกค้ารายนี้
    status TEXT DEFAULT 'ACTIVE',      -- ACTIVE | INACTIVE
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pickup_loc_org ON pickup_locations(org_id);
CREATE INDEX IF NOT EXISTS idx_pickup_loc_customer ON pickup_locations(customer_id);

NOTIFY pgrst, 'reload schema';
