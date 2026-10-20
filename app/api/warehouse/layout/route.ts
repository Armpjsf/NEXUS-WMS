import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { requireManagement } from '@/lib/apiAuth';
import {
  RackConfig,
  WarehouseLayout,
  listLayoutBins,
  validateLayout,
} from '@/lib/warehouseLayout';

export type { RackConfig, WarehouseLayout as WarehouseLayoutPayload } from '@/lib/warehouseLayout';

export const dynamic = 'force-dynamic';

// Layouts saved before branches were wired in live under this id.
const LEGACY_BRANCH = 'MAIN';

type Admin = ReturnType<typeof getServiceSupabase>;

function rowToRack(r: any): RackConfig {
  return {
    rackCode: r.rack_code,
    zoneCode: r.zone_code,
    posX: Number(r.pos_x || 0),
    posZ: Number(r.pos_z || 0),
    rotationY: Number(r.rotation_y || 0),
    bays: Number(r.bays || 5),
    levels: Number(r.levels || 4),
    bayWidth: Number(r.bay_width || 2.8),
    levelHeight: Number(r.level_height || 1.8),
    rackDepth: Number(r.rack_depth || 1.2),
    color: r.color || '#facc15',
    type: (r.rack_type || 'RACK') as RackConfig['type'],
    palletMode: (r.pallet_mode || 'PALLET') as RackConfig['palletMode'],
    binTemplate: r.bin_template || undefined,
    binOverrides: r.bin_overrides && typeof r.bin_overrides === 'object' ? r.bin_overrides : undefined,
  };
}

function rackToRow(orgId: string, branchId: string, r: RackConfig, idx: number, legacy: boolean) {
  const row: Record<string, any> = {
    org_id: orgId,
    branch_id: branchId,
    rack_code: String(r.rackCode).trim(),
    zone_code: String(r.zoneCode || 'A').trim(),
    pos_x: Number(r.posX) || 0,
    pos_z: Number(r.posZ) || 0,
    rotation_y: Number(r.rotationY) || 0,
    bays: Math.max(1, Math.floor(Number(r.bays) || 1)),
    levels: Math.max(1, Math.floor(Number(r.levels) || 1)),
    bay_width: Number(r.bayWidth) || 2.8,
    level_height: Number(r.levelHeight) || 1.8,
    rack_depth: Number(r.rackDepth) || 1.2,
    rack_type: r.type || 'RACK',
    color: r.color || '#facc15',
  };
  // Columns from 20261021_warehouse_bins_from_layout.sql
  if (!legacy) {
    row.pallet_mode = r.palletMode || 'PALLET';
    row.bin_template = r.binTemplate?.trim() || null;
    row.bin_overrides = r.binOverrides || {};
    row.sort_order = idx;
  }
  return row;
}

const isMissingColumn = (e: any) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /column/i.test(e.message || ''));

async function loadLayout(admin: Admin, orgId: string, branchId: string) {
  const [{ data: layout }, { data: rackRows }] = await Promise.all([
    admin.from('warehouse_layouts').select('*').eq('org_id', orgId).eq('branch_id', branchId).maybeSingle(),
    admin.from('warehouse_racks').select('*').eq('org_id', orgId).eq('branch_id', branchId),
  ]);
  const rows = (rackRows || []).slice().sort((a: any, b: any) =>
    (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.rack_code).localeCompare(String(b.rack_code)));
  return { layout, racks: rows.map(rowToRack) };
}

export async function GET(req: NextRequest) {
  try {
    const orgId = await getCurrentOrgId();
    const branchId = new URL(req.url).searchParams.get('branchId') || LEGACY_BRANCH;
    const admin = getServiceSupabase();

    let { layout, racks } = await loadLayout(admin, orgId, branchId);
    let legacyFrom: string | null = null;

    // A branch that has never been saved shows the old "MAIN" layout (if any)
    // so nothing drawn before branch support disappears. Saving moves it.
    if (!layout && racks.length === 0 && branchId !== LEGACY_BRANCH) {
      const legacy = await loadLayout(admin, orgId, LEGACY_BRANCH);
      if (legacy.layout || legacy.racks.length > 0) {
        ({ layout, racks } = legacy);
        legacyFrom = LEGACY_BRANCH;
      }
    }

    const data: WarehouseLayout & { saved: boolean; legacyFrom: string | null } = {
      branchId,
      name: layout?.name || `คลังสินค้าสาขา ${branchId}`,
      widthM: Number(layout?.width_m || 60),
      lengthM: Number(layout?.length_m || 80),
      heightM: Number(layout?.height_m || 12),
      racks,
      saved: !!layout || racks.length > 0,
      legacyFrom,
    };
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * Write the layout's bins into warehouse_locations (the bin master the product
 * location pickers read). Bins dropped from this branch's layout are
 * deactivated, not deleted. Returns a warning instead of throwing when the
 * 20261021 columns aren't there yet.
 */
async function syncBins(admin: Admin, orgId: string, branchId: string, racks: RackConfig[]): Promise<{ count: number; deactivated: number; warning?: string }> {
  const bins = listLayoutBins(racks);
  const rackIndex = new Map(racks.map((r, i) => [r.rackCode, i + 1]));
  const now = new Date().toISOString();
  const rows = bins.map(b => ({
    org_id: orgId,
    bin_code: b.binCode,
    zone: b.zoneCode,
    aisle: rackIndex.get(b.rackCode) || 1,
    rack: b.bay,
    shelf: b.level,
    branch_id: branchId,
    rack_code: b.rackCode,
    bay: b.bay,
    level: b.level,
    source: 'LAYOUT',
    active: true,
    updated_at: now,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from('warehouse_locations').upsert(rows.slice(i, i + 500), { onConflict: 'org_id,bin_code' });
    if (error) {
      if (isMissingColumn(error)) {
        return { count: 0, deactivated: 0, warning: 'ยังไม่ได้รัน SQL 20261021_warehouse_bins_from_layout.sql — ผังบันทึกแล้ว แต่ยังไม่ได้สร้างโลเคชันให้เลือกในสินค้า' };
      }
      return { count: 0, deactivated: 0, warning: `สร้างโลเคชันไม่สำเร็จ: ${error.message}` };
    }
  }

  const keep = new Set(bins.map(b => b.binCode));
  const { data: existing } = await admin
    .from('warehouse_locations')
    .select('bin_code')
    .eq('org_id', orgId)
    .eq('branch_id', branchId)
    .eq('source', 'LAYOUT')
    .eq('active', true);
  const stale = (existing || []).map((r: any) => r.bin_code).filter((c: string) => !keep.has(c));
  for (let i = 0; i < stale.length; i += 200) {
    await admin.from('warehouse_locations').update({ active: false, updated_at: now })
      .eq('org_id', orgId).in('bin_code', stale.slice(i, i + 200));
  }
  return { count: rows.length, deactivated: stale.length };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireManagement();
    if (auth.error) return auth.error;
    const orgId = auth.user.orgId || (await getCurrentOrgId());

    const body: Partial<WarehouseLayout> = await req.json();
    const branchId = String(body.branchId || LEGACY_BRANCH).trim() || LEGACY_BRANCH;
    const racks: RackConfig[] = Array.isArray(body.racks) ? body.racks : [];

    const problems = validateLayout(racks);
    if (problems.length) {
      return NextResponse.json({ success: false, error: problems.join(' • ') }, { status: 400 });
    }

    const admin = getServiceSupabase();

    const { error: layoutErr } = await admin.from('warehouse_layouts').upsert(
      {
        org_id: orgId,
        branch_id: branchId,
        name: String(body.name || `คลังสินค้าสาขา ${branchId}`),
        width_m: Number(body.widthM) || 60,
        length_m: Number(body.lengthM) || 80,
        height_m: Number(body.heightM) || 12,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,branch_id' },
    );
    if (layoutErr) {
      return NextResponse.json({ success: false, error: `บันทึกผังไม่สำเร็จ: ${layoutErr.message}` }, { status: 500 });
    }

    // Replace the branch's racks. Keep the previous rows so a failed insert
    // can be put back instead of leaving the branch with no racks.
    const { data: previous } = await admin.from('warehouse_racks').select('*').eq('org_id', orgId).eq('branch_id', branchId);
    const { error: delErr } = await admin.from('warehouse_racks').delete().eq('org_id', orgId).eq('branch_id', branchId);
    if (delErr) {
      return NextResponse.json({ success: false, error: `บันทึกแร็กไม่สำเร็จ: ${delErr.message}` }, { status: 500 });
    }

    let legacyColumns = false;
    if (racks.length > 0) {
      let { error } = await admin.from('warehouse_racks').insert(racks.map((r, i) => rackToRow(orgId, branchId, r, i, false)));
      if (error && isMissingColumn(error)) {
        legacyColumns = true;
        ({ error } = await admin.from('warehouse_racks').insert(racks.map((r, i) => rackToRow(orgId, branchId, r, i, true))));
      }
      if (error) {
        if (previous && previous.length > 0) {
          await admin.from('warehouse_racks').insert(previous.map(({ id, created_at, ...rest }: any) => rest));
        }
        return NextResponse.json({ success: false, error: `บันทึกแร็กไม่สำเร็จ: ${error.message}` }, { status: 500 });
      }
    }

    const sync = legacyColumns
      ? { count: 0, deactivated: 0, warning: 'ยังไม่ได้รัน SQL 20261021_warehouse_bins_from_layout.sql — รูปแบบรหัสโลเคชัน/ช่องพิเศษยังไม่ถูกเก็บ' }
      : await syncBins(admin, orgId, branchId, racks);

    return NextResponse.json({
      success: true,
      message: `บันทึกผังคลังสาขา ${branchId} แล้ว • ${racks.length} แร็ก • ${sync.count.toLocaleString()} โลเคชัน`,
      bins: sync.count,
      deactivated: sync.deactivated,
      warning: sync.warning,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
