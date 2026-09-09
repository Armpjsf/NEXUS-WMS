import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { listReturns, getReturn, createReturn, updateReturn } from '@/lib/data/returns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const rma = await getReturn(id);
      if (!rma) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(rma);
    }
    const status = searchParams.get('status') || undefined;
    const returns = await listReturns({ status });
    return NextResponse.json({ returns });
  } catch (error: any) {
    console.error('API returns GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' }, { status: 400 });
    }
    // @ts-ignore
    const session = await getServerSession(authOptions);
    const rma = await createReturn({ ...body, createdBy: session?.user?.name || session?.user?.email || 'System' });
    if (!rma) return NextResponse.json({ error: 'สร้างใบคืนไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, rma });
  } catch (error: any) {
    console.error('API returns POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const rma = await updateReturn(id, patch);
    if (!rma) return NextResponse.json({ error: 'อัปเดตไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, rma });
  } catch (error: any) {
    console.error('API returns PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
