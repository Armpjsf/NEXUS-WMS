-- ==============================================================================
-- NEXUS WMS ↔ TMS (ePOD) 2-WAY INTEGRATION SCHEMA MIGRATION
-- Run this in your Supabase SQL Editor (WMS Database)
-- ==============================================================================

-- 1. Add branch and TMS tracking columns to outbound_orders
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS tms_job_id TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS tms_status TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS tms_synced_at TIMESTAMPTZ;

-- 2. Indexes for high-performance lookup
CREATE INDEX IF NOT EXISTS idx_ob_orders_tms_job ON outbound_orders(tms_job_id);
CREATE INDEX IF NOT EXISTS idx_ob_orders_branch ON outbound_orders(branch_code);
