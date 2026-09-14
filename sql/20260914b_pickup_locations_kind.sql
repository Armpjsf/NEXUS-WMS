-- ขยายคลังจุดให้ใช้ได้ทั้งจุดรับและจุดส่ง
-- kind: 'PICKUP' | 'DROP' | 'BOTH'  (ค่าเดิมทั้งหมด = PICKUP)
-- รันใน Supabase SQL editor ของโปรเจกต์ WMS (ต่อจาก 20260914_pickup_locations.sql)

ALTER TABLE pickup_locations
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'PICKUP',
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_pickup_loc_kind ON pickup_locations(kind);

NOTIFY pgrst, 'reload schema';
