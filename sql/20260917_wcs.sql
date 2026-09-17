-- WCS / AGV Robotics — persistent fleet & mission store.
-- Replaces the in-memory demo registry in lib/wcsEngine.ts so robot state and
-- missions survive redeploys and stay consistent across serverless instances.

create table if not exists wcs_devices (
  id                   text primary key,
  org_id               uuid not null,
  code                 text not null,
  name                 text not null,
  type                 text not null default 'AGV_PALLET_LIFT',
  status               text not null default 'IDLE',
  battery_level        numeric not null default 100,
  current_location     text,
  current_mission_code text,
  ip_address           text,
  last_ping            timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists wcs_missions (
  id                   text primary key,
  org_id               uuid not null,
  mission_code         text not null,
  task_type            text not null,
  priority             int  not null default 2,
  source_bin           text,
  target_bin           text,
  sku                  text,
  product_name         text,
  lpn                  text,
  qty                  numeric default 1,
  status               text not null default 'QUEUED',
  assigned_robot_code  text,
  error_message        text,
  stock_moved          boolean not null default false,
  created_at           timestamptz not null default now(),
  started_at           timestamptz,
  completed_at         timestamptz,
  unique (org_id, mission_code)
);

create index if not exists idx_wcs_missions_org_created on wcs_missions (org_id, created_at desc);
create index if not exists idx_wcs_missions_code on wcs_missions (mission_code);
create index if not exists idx_wcs_devices_org on wcs_devices (org_id);

-- Starter fleet (demo) — delete these rows once real robots are registered.
insert into wcs_devices (id, org_id, code, name, type, status, battery_level, current_location, ip_address)
values
  ('dev-01','00000000-0000-0000-0000-000000000001','AGV-01','Hikrobot Pallet Lifter Alpha','AGV_PALLET_LIFT','IDLE',94,'DOCK-01','192.168.10.101'),
  ('dev-02','00000000-0000-0000-0000-000000000001','AMR-02','Geek+ Tote Runner Bravo','AMR_TOTE_RUNNER','IDLE',78,'AISLE-B-02','192.168.10.102'),
  ('dev-03','00000000-0000-0000-0000-000000000001','AGV-03','HaiPick Narrow-Aisle Shuttle','ASRS_SHUTTLE','CHARGING',42,'CHARGE-STN-1','192.168.10.103'),
  ('dev-04','00000000-0000-0000-0000-000000000001','CONV-01','High-Speed Sortation Conveyor A','CONVEYOR_SORTER','IDLE',100,'PACK-LINE-01','192.168.10.201')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
