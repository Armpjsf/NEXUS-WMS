import { NextResponse } from 'next/server';
import { getOrderPublic } from '@/lib/data/orders';

export const dynamic = 'force-dynamic';

// Public, read-only data for the shareable QC handover slip. Reachable without a
// session (whitelisted in proxy.ts under /api/public). Returns only what the
// slip renders; access is gated by knowing the order's unguessable UUID.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const order = await getOrderPublic(id);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    return NextResponse.json({
      order: {
        id: order.id,
        orderNo: order.orderNo,
        customerName: order.customerName,
        phone: order.phone,
        shipAddress: order.shipAddress,
        items: order.items,
        totalQty: order.totalQty,
        createdAt: order.createdAt,
        pickedAt: order.pickedAt,
        destinations: order.destinations,
        qcSignatures: order.qcSignatures,
        pickupName: order.pickupName,
        pickupAddress: order.pickupAddress,
      },
    });
  } catch (error: any) {
    console.error('API public qc-handover error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
