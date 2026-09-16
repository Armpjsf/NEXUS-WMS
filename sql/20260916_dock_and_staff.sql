-- ==============================================================================
-- 20260916 — ตารางที่ยังขาด: ลานเทียบ (dock_bays) + ประสิทธิภาพพนักงาน (staff_performance)
-- รันไฟล์นี้ใน Supabase SQL Editor (โปรเจกต์ nextjs-wms-core)
-- ยึดแพตเทิร์นเดิม: org_id default seed-org, RLS ENABLED แบบล็อก (server ใช้ service role key)
-- ==============================================================================

-- 1) ลานจอดเทียบ / เบย์โหลด (Dock Bay Matrix บนแดชบอร์ด) -----------------------
CREATE TABLE IF NOT EXISTS dock_bays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  branch_id     UUID REFERENCES branches(id),
  name          TEXT NOT NULL,                       -- เช่น BAY-01
  bay_type      TEXT NOT NULL DEFAULT 'INBOUND',     -- INBOUND | OUTBOUND
  status        TEXT NOT NULL DEFAULT 'AVAILABLE',   -- ACTIVE | WAITING | AVAILABLE
  vehicle       TEXT DEFAULT '',                     -- ทะเบียน/ประเภทรถที่เทียบอยู่
  pallets_done  INT  DEFAULT 0,
  pallets_total INT  DEFAULT 0,
  progress      INT  DEFAULT 0,                      -- 0-100 (%)
  eta           TEXT DEFAULT '',                     -- ข้อความ ETA เช่น "12 นาที" / "เสร็จสิ้น"
  sort_order    INT  DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dock_bays_org    ON dock_bays(org_id);
CREATE INDEX IF NOT EXISTS idx_dock_bays_branch ON dock_bays(branch_id);
ALTER TABLE dock_bays ENABLE ROW LEVEL SECURITY;   -- ไม่มี policy = ปิด anon; server ใช้ service role

-- 2) สถิติประสิทธิภาพพนักงานรายบุคคล (หน้า ops/analytics/staff) ------------------
--    เก็บเป็น snapshot ต่อวันต่อคน (เติมด้วยงานสรุป/คีย์มือ หรือ aggregate จาก stock_transactions ภายหลัง)
CREATE TABLE IF NOT EXISTS staff_performance (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  branch_id                UUID REFERENCES branches(id),
  user_id                  TEXT REFERENCES app_users(id),   -- app_users.id เป็น TEXT (ไม่ใช่ UUID)
  staff_name               TEXT NOT NULL,
  role                     TEXT DEFAULT '',
  branch_label             TEXT DEFAULT '',          -- ชื่อสาขาแบบข้อความ (โชว์บนการ์ด)
  avatar                   TEXT DEFAULT '👤',
  snapshot_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  total_picks              INT  DEFAULT 0,
  picks_per_hour           NUMERIC(6,1) DEFAULT 0,
  packed_orders            INT  DEFAULT 0,
  cycle_counts_completed   INT  DEFAULT 0,
  accuracy_rate            NUMERIC(5,2) DEFAULT 0,   -- %
  avg_turnaround_minutes   NUMERIC(6,1) DEFAULT 0,
  status                   TEXT DEFAULT 'ACTIVE',    -- ACTIVE | BREAK | OFFLINE
  score                    INT  DEFAULT 0,
  badge                    TEXT DEFAULT '',
  created_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, user_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_staff_perf_org    ON staff_performance(org_id);
CREATE INDEX IF NOT EXISTS idx_staff_perf_date   ON staff_performance(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_staff_perf_branch ON staff_performance(branch_id);
ALTER TABLE staff_performance ENABLE ROW LEVEL SECURITY;

-- 3) รีโหลด schema cache (กัน PGRST205 หลังสร้างตารางใหม่) -----------------------
NOTIFY pgrst, 'reload schema';

SELECT 'dock_bays + staff_performance migration completed!' AS status;
