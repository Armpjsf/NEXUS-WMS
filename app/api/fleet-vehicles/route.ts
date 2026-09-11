import { NextResponse } from 'next/server';
import { getVehicles, createVehicle, updateVehicle, deleteVehicle } from '@/lib/data/fleet';
import { requireManagement } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET is open to any signed-in user (the dispatch screen needs the list);
// writes are management-only.
export async function GET(request: Request) {
  try {
    const activeOnly = new URL(request.url).searchParams.get('active') === '1';
    const vehicles = await getVehicles(activeOnly);
    return NextResponse.json({ vehicles });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
