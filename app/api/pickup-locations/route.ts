import { NextResponse } from 'next/server';
import {
  getPickupLocations, createPickupLocation, updatePickupLocation, deletePickupLocation,
} from '@/lib/data/pickupLocations';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || undefined;
    const kind = (searchParams.get('kind') as any) || undefined;
    const locations = await getPickupLocations(customerId, kind);
    return NextResponse.json({ locations });
  } catch (error) {
    console.error('API pickup-locations GET error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อจุดรับ' }, { status: 400 });
    }
    const location = await createPickupLocation(body);
    if (!location) return NextResponse.json({ error: 'สร้างจุดรับไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, location });
  } catch (error) {
    console.error('API pickup-locations POST error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const location = await updatePickupLocation(id, patch);
    if (!location) return NextResponse.json({ error: 'อัปเดตจุดรับไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, location });
  } catch (error) {
    console.error('API pickup-locations PUT error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const result = await deletePickupLocation(id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API pickup-locations DELETE error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
