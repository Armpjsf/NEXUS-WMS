/**
 * WCS (Warehouse Control System) & Robotics API Gateway Engine
 * Standard Interface for AGV, AMR, AS/RS Pallet Shuttles & Sortation Conveyors
 * Supports Hikrobot, Geek+, HaiPick, Dematic, Swisslog & Modbus/PLC Controllers
 *
 * Persistent store: wcs_devices / wcs_missions (see sql/20260917_wcs.sql).
 * A completed PALLET_TRANSFER / PUTAWAY_RUN mission moves the real stock between
 * bins via the multi-bin engine so inventory follows the robot.
 */

import { getServiceSupabase } from '@/lib/supabase';
import { DEFAULT_ORG } from '@/lib/orgContext';
import { binMove } from '@/lib/stockLocations';

export interface RobotFleetDevice {
  id: string;
  code: string;
  name: string;
  type: 'AGV_PALLET_LIFT' | 'AMR_TOTE_RUNNER' | 'CONVEYOR_SORTER' | 'ASRS_SHUTTLE';
  status: 'IDLE' | 'NAVIGATING' | 'LIFTING' | 'CHARGING' | 'ERROR' | 'OFFLINE';
  batteryLevel: number;
  currentLocation: string;
  currentMissionCode?: string;
  ipAddress?: string;
  lastPing: string;
}

export interface WcsMission {
  id: string;
  missionCode: string;
  taskType: 'PALLET_TRANSFER' | 'BIN_TO_PERSON' | 'CONVEYOR_DIVERT' | 'PUTAWAY_RUN';
  priority: number;
  sourceBin: string;
  targetBin: string;
  sku?: string;
  productName?: string;
  lpn?: string;
  qty?: number;
  status: 'QUEUED' | 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  assignedRobotCode?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

// Task types whose completion physically relocates stock between bins.
const STOCK_MOVING_TASKS = new Set(['PALLET_TRANSFER', 'PUTAWAY_RUN']);

function mapDevice(r: any): RobotFleetDevice {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    status: r.status,
    batteryLevel: Number(r.battery_level ?? 0),
    currentLocation: r.current_location || '',
    currentMissionCode: r.current_mission_code || undefined,
    ipAddress: r.ip_address || undefined,
    lastPing: r.last_ping || new Date().toISOString(),
  };
}

function mapMission(r: any): WcsMission {
  return {
    id: r.id,
    missionCode: r.mission_code,
    taskType: r.task_type,
    priority: Number(r.priority ?? 2),
    sourceBin: r.source_bin || '',
    targetBin: r.target_bin || '',
    sku: r.sku || undefined,
    productName: r.product_name || undefined,
    lpn: r.lpn || undefined,
    qty: r.qty != null ? Number(r.qty) : undefined,
    status: r.status,
    assignedRobotCode: r.assigned_robot_code || undefined,
    createdAt: r.created_at,
    startedAt: r.started_at || undefined,
    completedAt: r.completed_at || undefined,
    errorMessage: r.error_message || undefined,
  };
}

export async function getFleetDevices(orgId: string): Promise<RobotFleetDevice[]> {
  const { data } = await getServiceSupabase()
    .from('wcs_devices').select('*').eq('org_id', orgId).order('code', { ascending: true });
  return (data || []).map(mapDevice);
}

export async function getMissionQueue(orgId: string, limit = 100): Promise<WcsMission[]> {
  const { data } = await getServiceSupabase()
    .from('wcs_missions').select('*').eq('org_id', orgId)
    .order('created_at', { ascending: false }).limit(limit);
  return (data || []).map(mapMission);
}

export async function dispatchWcsMission(orgId: string, data: {
  taskType: WcsMission['taskType'];
  sourceBin: string;
  targetBin: string;
  sku?: string;
  productName?: string;
  lpn?: string;
  qty?: number;
  priority?: number;
  robotCode?: string;
}): Promise<WcsMission> {
  const admin = getServiceSupabase();
  const missionCode = `WCS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  // Auto-assign an idle robot when none is explicitly selected.
  let assignedCode = data.robotCode;
  if (!assignedCode) {
    const { data: idle } = await admin
      .from('wcs_devices').select('code, type')
      .eq('org_id', orgId).eq('status', 'IDLE');
    const preferredType = data.taskType === 'BIN_TO_PERSON' ? 'AMR_TOTE_RUNNER' : 'AGV_PALLET_LIFT';
    const pick = (idle || []).find((d: any) => d.type === preferredType) || (idle || [])[0];
    assignedCode = pick?.code;
  }

  const now = new Date().toISOString();
  const mission = {
    id: `mis-${Date.now()}`,
    org_id: orgId,
    mission_code: missionCode,
    task_type: data.taskType,
    priority: data.priority || 2,
    source_bin: data.sourceBin,
    target_bin: data.targetBin,
    sku: data.sku || null,
    product_name: data.productName || null,
    lpn: data.lpn || null,
    qty: data.qty || 1,
    status: assignedCode ? 'DISPATCHED' : 'QUEUED',
    assigned_robot_code: assignedCode || null,
    created_at: now,
    started_at: assignedCode ? now : null,
  };
  await admin.from('wcs_missions').insert(mission);

  if (assignedCode) {
    await admin.from('wcs_devices')
      .update({ status: 'NAVIGATING', current_mission_code: missionCode, last_ping: now, updated_at: now })
      .eq('org_id', orgId).eq('code', assignedCode);
  }

  return mapMission(mission);
}

// Move the mission's stock between bins once, guarded by stock_moved so a
// duplicate/late webhook cannot double-apply.
async function applyMissionStockMove(admin: ReturnType<typeof getServiceSupabase>, m: any): Promise<void> {
  if (m.stock_moved) return;
  if (!STOCK_MOVING_TASKS.has(m.task_type)) return;
  if (!m.sku || !m.source_bin || !m.target_bin) return;
  try {
    await binMove(m.org_id, m.sku, m.source_bin, m.target_bin, Number(m.qty || 0) || 0);
    await admin.from('wcs_missions').update({ stock_moved: true }).eq('id', m.id);
  } catch (e) {
    console.warn(`WCS: stock move failed for mission ${m.mission_code}:`, e);
  }
}

export async function updateWcsMissionFromWebhook(payload: {
  missionCode: string;
  robotCode?: string;
  status: 'IN_TRANSIT' | 'COMPLETED' | 'FAILED';
  batteryLevel?: number;
  currentLocation?: string;
  errorMessage?: string;
}): Promise<{ success: boolean; mission?: WcsMission; error?: string }> {
  const admin = getServiceSupabase();
  // Look up by mission_code alone — external callers carry no org session.
  const { data: existing } = await admin
    .from('wcs_missions').select('*').eq('mission_code', payload.missionCode).maybeSingle();
  if (!existing) {
    return { success: false, error: `Mission code ${payload.missionCode} not found` };
  }

  const now = new Date().toISOString();
  await admin.from('wcs_missions').update({
    status: payload.status,
    completed_at: payload.status === 'COMPLETED' ? now : existing.completed_at,
    error_message: payload.errorMessage || null,
  }).eq('id', existing.id);

  if (payload.status === 'COMPLETED') {
    await applyMissionStockMove(admin, existing);
  }

  const robotCode = payload.robotCode || existing.assigned_robot_code;
  if (robotCode) {
    const { data: dev } = await admin
      .from('wcs_devices').select('battery_level').eq('org_id', existing.org_id).eq('code', robotCode).maybeSingle();
    const nextBattery = typeof payload.batteryLevel === 'number'
      ? payload.batteryLevel
      : Math.max(10, Number(dev?.battery_level ?? 100) - 2);
    await admin.from('wcs_devices').update({
      status: payload.status === 'COMPLETED' ? 'IDLE' : payload.status === 'FAILED' ? 'ERROR' : 'NAVIGATING',
      current_mission_code: payload.status === 'COMPLETED' ? null : robotCode ? existing.mission_code : null,
      battery_level: nextBattery,
      current_location: payload.currentLocation || (payload.status === 'COMPLETED' ? existing.target_bin : undefined),
      last_ping: now,
      updated_at: now,
    }).eq('org_id', existing.org_id).eq('code', robotCode);
  }

  const { data: updated } = await admin
    .from('wcs_missions').select('*').eq('id', existing.id).maybeSingle();
  return { success: true, mission: updated ? mapMission(updated) : undefined };
}

/** Advance in-flight missions one step (client demos without physical AGVs). */
export async function simulateFleetMovement(orgId: string): Promise<{ message: string; updatedMissions: number }> {
  const admin = getServiceSupabase();
  const now = new Date().toISOString();
  let updatedCount = 0;

  const { data: rows } = await admin
    .from('wcs_missions').select('*').eq('org_id', orgId).in('status', ['DISPATCHED', 'IN_TRANSIT']);

  for (const m of rows || []) {
    if (m.status === 'DISPATCHED') {
      await admin.from('wcs_missions').update({ status: 'IN_TRANSIT' }).eq('id', m.id);
      updatedCount++;
    } else if (m.status === 'IN_TRANSIT') {
      await admin.from('wcs_missions').update({ status: 'COMPLETED', completed_at: now }).eq('id', m.id);
      await applyMissionStockMove(admin, m);
      if (m.assigned_robot_code) {
        const { data: dev } = await admin
          .from('wcs_devices').select('battery_level').eq('org_id', orgId).eq('code', m.assigned_robot_code).maybeSingle();
        await admin.from('wcs_devices').update({
          status: 'IDLE',
          current_location: m.target_bin,
          current_mission_code: null,
          battery_level: Math.max(15, Number(dev?.battery_level ?? 100) - 3),
          last_ping: now,
          updated_at: now,
        }).eq('org_id', orgId).eq('code', m.assigned_robot_code);
      }
      updatedCount++;
    }
  }

  return {
    message: updatedCount > 0 ? 'Simulated next robot trajectory step successfully' : 'No active missions in progress',
    updatedMissions: updatedCount,
  };
}

export { DEFAULT_ORG };
