import { NextResponse } from 'next/server';
import { addItemsToOrder } from '@/lib/data/orders';

export const dynamic = 'force-dynamic';

// POST /api/orders/add-items — เพิ่มสินค้าเข้าออเดอร์ที่แพ็ก/ส่งงานแล้ว (ลูกค้าเพิ่มของ)
// body: { id, items: [{ sku, name, qty, price?, location?, drop? }] }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, items } = body || {};
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'ไม่มีรายการสินค้าที่จะเพิ่ม' }, { status: 400 });
    }

    const result = await addItemsToOrder(id, items);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, order: result.order, tms: result.tms });
  } catch (error: any) {
    console.error('API orders/add-items error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
