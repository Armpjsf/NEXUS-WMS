import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { listOrders, getOrder, createOrder, updateOrder } from '@/lib/data/orders';
import { captureError } from '@/lib/observability';
import { errorMessage } from '@/lib/errors';

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
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined; // no param = all
    const orders = await listOrders({ status, limit });
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('API orders GET error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' }, { status: 400 });
    }
    const session = await getServerSession(authOptions);
    const order = await createOrder({ ...body, createdBy: session?.user?.name || session?.user?.email || 'System' });
    if (!order) return NextResponse.json({ error: 'สร้างออเดอร์ไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    await captureError(error, { where: 'POST /api/orders' });
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    // Editing an order's master details (customer/address/carrier/freight/mode)
    // is a management-only correction; status/POD/item flow stays open to staff.
    const EDIT_FIELDS = ['customerName', 'phone', 'shipAddress', 'refNo', 'freightCost', 'deliveryMode'];
    if (EDIT_FIELDS.some(f => f in patch)) {
      const { requireManagement } = await import('@/lib/apiAuth');
      const guard = await requireManagement();
      if (guard.error) return guard.error;
    }
    const order = await updateOrder(id, patch);
    if (!order) return NextResponse.json({ error: 'อัปเดตออเดอร์ไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    await captureError(error, { where: 'PATCH /api/orders' });
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
