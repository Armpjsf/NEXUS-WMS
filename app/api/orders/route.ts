import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { listOrders, getOrder, createOrder, updateOrder } from '@/lib/data/orders';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const order = await getOrder(id);
      if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(order);
    }
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '200', 10);
    const orders = await listOrders({ status, limit });
    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('API orders GET error:', error);
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
    const order = await createOrder({ ...body, createdBy: session?.user?.name || session?.user?.email || 'System' });
    if (!order) return NextResponse.json({ error: 'สร้างออเดอร์ไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('API orders POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const order = await updateOrder(id, patch);
    if (!order) return NextResponse.json({ error: 'อัปเดตออเดอร์ไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('API orders PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
