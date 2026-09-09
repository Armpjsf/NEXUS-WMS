import { NextResponse } from 'next/server';
import { getCarriers, getCarrierById, createCarrier, updateCarrier, deleteCarrier } from '@/lib/data/carriers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const carrier = await getCarrierById(id);
      if (!carrier) return NextResponse.json({ error: 'Carrier not found' }, { status: 404 });
      return NextResponse.json(carrier);
    }

    const carriers = await getCarriers();
    return NextResponse.json({ carriers });
  } catch (error: any) {
    console.error('API carriers GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อผู้ให้บริการขนส่ง' }, { status: 400 });
    }

    const carrier = await createCarrier(body);
    if (!carrier) return NextResponse.json({ error: 'เพิ่มผู้ให้บริการขนส่งไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, carrier });
  } catch (error: any) {
    console.error('API carriers POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: 'Missing carrier id' }, { status: 400 });

    const carrier = await updateCarrier(id, patch);
    if (!carrier) return NextResponse.json({ error: 'อัปเดตผู้ให้บริการขนส่งไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, carrier });
  } catch (error: any) {
    console.error('API carriers PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing carrier id' }, { status: 400 });

    const ok = await deleteCarrier(id);
    if (!ok) return NextResponse.json({ error: 'ลบผู้ให้บริการขนส่งไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API carriers DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
