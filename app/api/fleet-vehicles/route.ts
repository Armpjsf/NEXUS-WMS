import { NextResponse } from 'next/server';
import { getVehicles, createVehicle, updateVehicle, deleteVehicle } from '@/lib/data/fleet';
import { requireManagement } from '@/lib/apiAuth';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// GET is open to any signed-in user (the dispatch screen needs the list);
// writes are management-only.
export async function GET(request: Request) {
  try {
    const activeOnly = new URL(request.url).searchParams.get('active') === '1';

    // If TMS is enabled, fetch live fleet from TMS with real-time availability
    const { isTmsEnabled, fetchTmsFleet } = await import('@/lib/tms');
    if (isTmsEnabled()) {
      try {
        const tmsRes = await fetchTmsFleet();
        if (tmsRes.ok && Array.isArray(tmsRes.fleet) && tmsRes.fleet.length > 0) {
          const liveVehicles = tmsRes.fleet.map(d => ({
            id: `tms-${d.driver_id}`,
            plate: d.vehicle_plate || 'ไม่ระบุทะเบียน',
            driverName: d.driver_name,
            vehicleType: d.vehicle_type || '4-Wheel',
            active: d.is_available,
            isLiveTms: true,
            statusLabel: d.current_status || (d.is_available ? 'ว่าง / พร้อมวิ่ง' : 'กำลังวิ่งงาน'),
          }));
          return NextResponse.json({ vehicles: liveVehicles, source: 'TMS' });
        }
      } catch (tmsErr) {
        console.warn('[fleet-vehicles] TMS live fetch fallback to local:', tmsErr);
      }
    }

    // Standalone fallback: WMS internal fleet_vehicles table
    const vehicles = await getVehicles(activeOnly);
    return NextResponse.json({ vehicles, source: 'LOCAL' });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireManagement();
  if (guard.error) return guard.error;
  try {
    const body = await request.json();
    if (!body.plate || !String(body.plate).trim()) {
      return NextResponse.json({ error: 'กรุณาระบุทะเบียนรถ' }, { status: 400 });
    }
    const v = await createVehicle(body);
    if (!v) return NextResponse.json({ error: 'เพิ่มรถไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, vehicle: v });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const guard = await requireManagement();
  if (guard.error) return guard.error;
  try {
    const { id, ...patch } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const v = await updateVehicle(id, patch);
    if (!v) return NextResponse.json({ error: 'อัปเดตไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, vehicle: v });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireManagement();
  if (guard.error) return guard.error;
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const ok = await deleteVehicle(id);
    return NextResponse.json({ success: ok });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
