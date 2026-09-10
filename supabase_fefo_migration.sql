-- Migration: FEFO Batch/Lot and Expiration Date Tracking
-- Run this in your Supabase SQL Editor if columns are not present yet

ALTER TABLE products ADD COLUMN IF NOT EXISTS lot_no TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mfg_date DATE;

-- Outbound order lines lot assignment
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS lot_no TEXT;
ALTER TABLE outbound_order_lines ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Performance index for FEFO queries
CREATE INDEX IF NOT EXISTS idx_products_expiry_date ON products (expiry_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_products_lot_no ON products (lot_no);
