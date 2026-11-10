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
    // Editing an order's master details (customer/address/carrier/freight/mode/items)
    // is a management-only correction; status/POD/item flow stays open to staff.
    const EDIT_FIELDS = ['customerName', 'phone', 'shipAddress', 'refNo', 'freightCost', 'deliveryMode', 'items'];
    if (EDIT_FIELDS.some(f => f in patch)) {
      const { requireManagement } = await import('@/lib/apiAuth');
      const guard = await requireManagement();
      if (guard.error) return guard.error;
    }

    if (patch.items !== undefined) {
      if (!Array.isArray(patch.items) || patch.items.length === 0) {
        return NextResponse.json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' }, { status: 400 });
      }
      for (const it of patch.items) {
        if (!it.sku || !String(it.sku).trim()) {
          return NextResponse.json({ error: 'รหัสสินค้า (SKU) ต้องไม่เป็นค่าว่าง' }, { status: 400 });
        }
        if (Number(it.qty) <= 0 || isNaN(Number(it.qty))) {
          return NextResponse.json({ error: `จำนวนสินค้าของ ${it.sku} ต้องมากกว่า 0` }, { status: 400 });
        }
      }
      const existingOrder = await getOrder(id);
      if (!existingOrder) return NextResponse.json({ error: 'ไม่พบออเดอร์' }, { status: 404 });
      if (['SHIPPED', 'DELIVERED'].includes(existingOrder.status)) {
        return NextResponse.json({ error: 'ไม่สามารถแก้ไขรายการสินค้าได้ เนื่องจากตัดสต็อก/จัดส่งแล้ว' }, { status: 400 });
      }
    }
    const order = await updateOrder(id, patch);
    if (!order) return NextResponse.json({ error: 'อัปเดตออเดอร์ไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    await captureError(error, { where: 'PATCH /api/orders' });
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
