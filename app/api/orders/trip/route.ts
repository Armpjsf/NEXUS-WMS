import { NextResponse } from 'next/server';
import { createDeliveryTrip } from '@/lib/data/orders';
import { errorMessage } from '@/lib/errors';
import { requireManagement } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * Creates a consolidated multi-drop delivery trip / manifest from multiple orders.
 * POST /api/orders/trip
 * Body: { orderIds: string[], driverName?: string, vehiclePlate?: string, vehicleType?: string, dockBay?: string, sendToTms?: boolean }
 */
export async function POST(request: Request) {
  try {
    const guard = await requireManagement();
    if (guard.error) return guard.error;

    const body = await request.json();
    const res = await createDeliveryTrip(body);

    if (!res.ok) {
      return NextResponse.json({ error: res.error || 'สร้างทริปจัดส่งไม่สำเร็จ' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tripId: res.tripId,
      orderCount: res.orderCount,
      trackingUrl: res.trackingUrl,
      message: `จัดทริป ${res.tripId} สำเร็จ รวม ${res.orderCount} ออเดอร์`,
    });
  } catch (err) {
    console.error('[API orders/trip error]:', err);
    return NextResponse.json({ error: errorMessage(err) || 'Internal Server Error' }, { status: 500 });
  }
}
