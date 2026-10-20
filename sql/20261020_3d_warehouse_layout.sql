-- Migration: Dynamic 3D Warehouse Map & Branch Layouts
-- Schema for procedural 3D racking and branch layouts

CREATE TABLE IF NOT EXISTS warehouse_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  branch_id VARCHAR(100) NOT NULL DEFAULT 'MAIN',
  name VARCHAR(255) NOT NULL DEFAULT 'ผังคลังหลัก',
  width_m NUMERIC NOT NULL DEFAULT 50,
  length_m NUMERIC NOT NULL DEFAULT 80,
  height_m NUMERIC NOT NULL DEFAULT 12,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_warehouse_layout_branch UNIQUE (org_id, branch_id)
);

CREATE TABLE IF NOT EXISTS warehouse_racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  branch_id VARCHAR(100) NOT NULL DEFAULT 'MAIN',
  zone_code VARCHAR(50) NOT NULL DEFAULT 'A',
  rack_code VARCHAR(50) NOT NULL,
  pos_x NUMERIC NOT NULL DEFAULT 0,
  pos_z NUMERIC NOT NULL DEFAULT 0,
  rotation_y NUMERIC NOT NULL DEFAULT 0,
  bays INTEGER NOT NULL DEFAULT 6,
  levels INTEGER NOT NULL DEFAULT 4,
  bay_width NUMERIC NOT NULL DEFAULT 2.8,
  level_height NUMERIC NOT NULL DEFAULT 1.8,
  rack_depth NUMERIC NOT NULL DEFAULT 1.2,
  color VARCHAR(50) DEFAULT '#facc15',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_warehouse_racks UNIQUE (org_id, branch_id, rack_code)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_racks_branch ON warehouse_racks(org_id, branch_id);
