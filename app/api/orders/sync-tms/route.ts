import { NextResponse } from 'next/server';
import { syncOrderWithTms } from '@/lib/data/orders';

export const dynamic = 'force-dynamic';

/**
 * On-demand manual sync with TMS (ePOD)
 * POST /api/orders/sync-tms
 * Body: { orderId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = body.orderId || body.id;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const res = await syncOrderWithTms(orderId);
    if (!res.ok) {
      return NextResponse.json({ error: res.message || 'ซิงค์ข้อมูลไม่สำเร็จ' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: res.order,
      message: res.message || 'ซิงค์ข้อมูลจาก TMS สำเร็จ',
    });
  } catch (err: any) {
    console.error('[API orders/sync-tms error]:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
