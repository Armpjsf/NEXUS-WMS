import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { requireManagement } from '@/lib/apiAuth';

export interface RackConfig {
  rackCode: string;
  zoneCode: string;
  posX: number;
  posZ: number;
  rotationY: number;
  bays: number;
  levels: number;
  bayWidth: number;
  levelHeight: number;
  rackDepth: number;
  color?: string;
  type?: 'RACK' | 'FLOOR_BLOCK' | 'CROSS_DOCK';
  palletMode?: 'PALLET' | 'NON_PALLET';
}

export interface WarehouseLayoutPayload {
  branchId: string;
  name: string;
  widthM: number;
  lengthM: number;
  heightM: number;
  racks: RackConfig[];
}

// Generate default procedural racks from existing zones & aisles if no custom layout is saved yet
function generateDefaultRacks(branchId: string): RackConfig[] {
  const racks: RackConfig[] = [];
  const zones = ['A', 'B', 'C', 'D'];
  const aislesPerZone = 3;
  const racksPerAisle = 4;

  let currentZ = -24;

  zones.forEach((zone, zIdx) => {
    for (let aisle = 1; aisle <= aislesPerZone; aisle++) {
      for (let r = 1; r <= racksPerAisle; r++) {
        // Double-deep layout: two racks back-to-back
        const isBack = r % 2 === 0;
        const posX = (r <= 2 ? -18 : 18) + (isBack ? 1.4 : -1.4);
        const rackCode = `${zone}-${String(aisle).padStart(2, '0')}-${String(r).padStart(2, '0')}`;

        racks.push({
          rackCode,
          zoneCode: zone,
          posX,
          posZ: currentZ + aisle * 14 + (r * 2),
          rotationY: 0,
          bays: 5,
          levels: 4,
          bayWidth: 2.8,
          levelHeight: 1.8,
          rackDepth: 1.2,
          color: zIdx === 0 ? '#57ec7f' : zIdx === 1 ? '#4cd7f6' : zIdx === 2 ? '#facc15' : '#ffb4ab',
          type: 'RACK',
        });
      }
    }
  });

  // Default Front Cross-Dock Staging Block
  racks.push({
    rackCode: 'XDOCK-01',
    zoneCode: 'XDOCK',
    posX: 12,
    posZ: 24,
    rotationY: 0,
    bays: 4,
    levels: 1,
    bayWidth: 2.4,
    levelHeight: 1.2,
    rackDepth: 2.0,
    color: '#facc15',
    type: 'CROSS_DOCK',
  });

  return racks;
}

export async function GET(req: NextRequest) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId') || 'MAIN';

    const admin = getServiceSupabase();

    // 1. Fetch layout definition
    const { data: layout } = await admin
      .from('warehouse_layouts')
      .select('*')
      .eq('org_id', orgId)
      .eq('branch_id', branchId)
      .maybeSingle();

    // 2. Fetch custom racks
    const { data: rackRows } = await admin
      .from('warehouse_racks')
      .select('*')
      .eq('org_id', orgId)
      .eq('branch_id', branchId)
      .order('rack_code', { ascending: true });

    let racks: RackConfig[] = [];

    if (rackRows && rackRows.length > 0) {
      racks = rackRows.map(r => ({
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
        type: (r.rack_type || 'RACK') as any,
      }));
    } else {
      // Procedural fallback
      racks = generateDefaultRacks(branchId);
    }

    return NextResponse.json({
      success: true,
      data: {
        branchId,
        name: layout?.name || `คลังสินค้าสาขา ${branchId}`,
        widthM: Number(layout?.width_m || 60),
        lengthM: Number(layout?.length_m || 80),
        heightM: Number(layout?.height_m || 12),
        racks,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireManagement();
    if (auth.error) return auth.error;
    const orgId = auth.user.orgId || (await getCurrentOrgId());

    const body: WarehouseLayoutPayload = await req.json();
    const { branchId = 'MAIN', name, widthM = 60, lengthM = 80, heightM = 12, racks = [] } = body;

    const admin = getServiceSupabase();

    // Upsert Layout
    await admin
      .from('warehouse_layouts')
      .upsert(
        {
          org_id: orgId,
          branch_id: branchId,
          name,
          width_m: widthM,
          length_m: lengthM,
          height_m: heightM,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,branch_id' }
      );

    // Upsert Racks
    if (racks.length > 0) {
      await admin.from('warehouse_racks').delete().eq('org_id', orgId).eq('branch_id', branchId);

      const rackInserts = racks.map(r => ({
        org_id: orgId,
        branch_id: branchId,
        rack_code: r.rackCode,
        zone_code: r.zoneCode,
        pos_x: r.posX,
        pos_z: r.posZ,
        rotation_y: r.rotationY,
        bays: r.bays,
        levels: r.levels,
        bay_width: r.bayWidth,
        level_height: r.levelHeight,
        rack_depth: r.rackDepth,
        rack_type: r.type || 'RACK',
        color: r.color || '#facc15',
      }));

      await admin.from('warehouse_racks').insert(rackInserts);
    }

    return NextResponse.json({ success: true, message: 'บันทึกผังคลังสินค้า 3D เรียบร้อยแล้ว' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
