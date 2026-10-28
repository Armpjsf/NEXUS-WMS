import { NextResponse } from 'next/server';
import { syncOrderWithTms } from '@/lib/data/orders';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * On-demand manual sync with TMS (ePOD)
 * POST /api/orders/sync-tms
 * Body: { orderId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support batch sync
    if (Array.isArray(body.orderIds) && body.orderIds.length > 0) {
      const results = await Promise.all(
        body.orderIds.map((id: string) => syncOrderWithTms(id).catch(err => ({ ok: false, message: errorMessage(err) })))
      );
      const successCount = results.filter(r => r.ok).length;
      return NextResponse.json({
        success: true,
        count: results.length,
        successCount,
        message: `ซิงค์สถานะ TMS สำเร็จ ${successCount}/${results.length} รายการ`,
      });
    }

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
  } catch (err) {
    console.error('[API orders/sync-tms error]:', err);
    return NextResponse.json({ error: errorMessage(err) || 'Internal Server Error' }, { status: 500 });
  }
}
