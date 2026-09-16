-- ==============================================================================
-- 20260916d — Next-Gen WMS Smart Enterprise Expansion
-- Tables for:
-- 1) 3PL Multi-Tenant Clients & Automated Billing Invoices
-- 2) Bill of Materials (BOM) & Kitting / Assembly
-- 3) Dock Appointment Scheduling & Yard Management
-- 4) Cold-Chain IoT Sensor Telemetry
-- 5) Pluggable Notification Queue (LINE / Webhook / Staging)
-- ==============================================================================

-- 1) 3PL Clients & Billing Invoices -------------------------------------------
CREATE TABLE IF NOT EXISTS third_party_clients (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  client_code                 TEXT NOT NULL,
  client_name                 TEXT NOT NULL,
  contact_person              TEXT DEFAULT '',
  email                       TEXT DEFAULT '',
  phone                       TEXT DEFAULT '',
  storage_rate_per_cbm_day    NUMERIC(10,2) DEFAULT 15.00,  -- ฿ per CBM per day
  storage_rate_per_pallet_day NUMERIC(10,2) DEFAULT 25.00,  -- ฿ per Pallet per day
  pick_fee_base               NUMERIC(10,2) DEFAULT 12.00,  -- ฿ per order base
  pick_fee_per_item           NUMERIC(10,2) DEFAULT 3.50,   -- ฿ per item picked
  pack_material_fee           NUMERIC(10,2) DEFAULT 10.00,  -- ฿ per box
  status                      TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | SUSPENDED
  created_at                  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_3pl_clients_org ON third_party_clients(org_id);
ALTER TABLE third_party_clients ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS billing_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  client_id           UUID REFERENCES third_party_clients(id),
  invoice_number      TEXT NOT NULL,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  storage_amount      NUMERIC(12,2) DEFAULT 0,
  fulfillment_amount  NUMERIC(12,2) DEFAULT 0,
  materials_amount    NUMERIC(12,2) DEFAULT 0,
  tax_amount          NUMERIC(12,2) DEFAULT 0,
  grand_total         NUMERIC(12,2) DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT | ISSUED | PAID | CANCELLED
  invoice_pdf_url     TEXT DEFAULT '',
  notes               TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_inv_org ON billing_invoices(org_id);
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;

-- 2) Bill of Materials (BOM) & Kitting ----------------------------------------
CREATE TABLE IF NOT EXISTS bill_of_materials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  kit_sku             TEXT NOT NULL,
  kit_name            TEXT NOT NULL,
  version             TEXT DEFAULT '1.0',
  assembly_labor_cost NUMERIC(10,2) DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | OBSOLETE
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bom_org ON bill_of_materials(org_id);
ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS bom_components (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id              UUID NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
  component_sku       TEXT NOT NULL,
  component_name      TEXT NOT NULL,
  quantity            NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit                TEXT DEFAULT 'ชิ้น'
);
CREATE INDEX IF NOT EXISTS idx_bom_components ON bom_components(bom_id);
ALTER TABLE bom_components ENABLE ROW LEVEL SECURITY;

-- 3) Dock Appointment Scheduling ---------------------------------------------
CREATE TABLE IF NOT EXISTS dock_appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  appointment_number  TEXT NOT NULL,
  bay_name            TEXT NOT NULL, -- e.g. BAY-01, BAY-02
  appointment_type    TEXT NOT NULL DEFAULT 'INBOUND', -- INBOUND | OUTBOUND
  supplier_or_carrier TEXT NOT NULL,
  vehicle_plate       TEXT DEFAULT '',
  driver_name         TEXT DEFAULT '',
  driver_phone        TEXT DEFAULT '',
  scheduled_start     TIMESTAMPTZ NOT NULL,
  scheduled_end       TIMESTAMPTZ NOT NULL,
  pallets_count       INT DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'BOOKED', -- BOOKED | CHECKED_IN | AT_BAY | COMPLETED | CANCELLED
  notes               TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dock_app_org ON dock_appointments(org_id);
CREATE INDEX IF NOT EXISTS idx_dock_app_time ON dock_appointments(scheduled_start);
ALTER TABLE dock_appointments ENABLE ROW LEVEL SECURITY;

-- 4) Cold-Chain IoT Sensor Telemetry -----------------------------------------
CREATE TABLE IF NOT EXISTS iot_sensor_telemetry (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  sensor_id           TEXT NOT NULL,
  zone_name           TEXT NOT NULL,
  temperature         NUMERIC(5,2) NOT NULL,
  humidity            NUMERIC(5,2) NOT NULL,
  battery_pct         INT DEFAULT 100,
  min_temp_limit      NUMERIC(5,2) DEFAULT -22.0,
  max_temp_limit      NUMERIC(5,2) DEFAULT -18.0,
  alert_triggered     BOOLEAN DEFAULT false,
  alert_message       TEXT DEFAULT '',
  recorded_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_iot_org ON iot_sensor_telemetry(org_id);
CREATE INDEX IF NOT EXISTS idx_iot_recorded ON iot_sensor_telemetry(recorded_at);
ALTER TABLE iot_sensor_telemetry ENABLE ROW LEVEL SECURITY;

-- 5) Pluggable Notification Queue --------------------------------------------
CREATE TABLE IF NOT EXISTS notification_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id),
  channel             TEXT NOT NULL DEFAULT 'MOCK_STAGING', -- LINE_NOTIFY | LINE_OA | WEBHOOK | EMAIL | MOCK_STAGING
  event_type          TEXT NOT NULL, -- LOW_STOCK | MAKER_CHECKER_PENDING | ORDER_PACKED | IOT_TEMP_ALERT
  recipient           TEXT DEFAULT '',
  title               TEXT NOT NULL,
  message             TEXT NOT NULL,
  payload             JSONB DEFAULT '{}'::jsonb,
  status              TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED | SENT | FAILED | SIMULATED
  error_message       TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_noti_org ON notification_queue(org_id);
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
