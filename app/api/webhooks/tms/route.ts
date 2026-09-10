import { NextResponse } from 'next/server';
import { closeOrderFromTmsPod } from '@/lib/data/orders';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Webhook endpoint for TMS (ePOD) to notify WMS of delivery updates and POD completions.
 * POST /api/webhooks/tms
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const secretHeader = request.headers.get('x-wms-secret') || '';
    const expectedSecret = process.env.TMS_WEBHOOK_SECRET;

    // Validate secret if configured
    if (expectedSecret) {
      const cleanBearer = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      if (cleanBearer !== expectedSecret && secretHeader !== expectedSecret) {
        console.warn('[WMS Webhook] Unauthorized attempt from TMS');
        return NextResponse.json({ error: 'Unauthorized: Invalid webhook secret' }, { status: 401 });
      }
    }

    const payload = await request.json();
    const {
      event,
      job_id,
      wms_order_no,
      status,
      is_completed,
      delivery_date,
      signature_url,
      photo_urls,
      receiver_name,
      driver_name,
      vehicle_plate,
      notes,
    } = payload;

    if (!job_id && !wms_order_no) {
      return NextResponse.json({ error: 'Missing job_id or wms_order_no' }, { status: 400 });
    }

    console.log(`[WMS Webhook] Received ${event} for TMS Job ${job_id} (WMS: ${wms_order_no || 'n/a'}) - Status: ${status}`);

    // If job is completed/delivered with POD proofs -> Auto close the order
    if (is_completed || event === 'job.completed' || ['Completed', 'Delivered'].includes(status)) {
      const closeRes = await closeOrderFromTmsPod({
        orderNo: wms_order_no || undefined,
        tmsJobId: job_id ? String(job_id) : undefined,
        signatureUrl: signature_url,
        photoUrls: Array.isArray(photo_urls) ? photo_urls : [],
        deliveryDate: delivery_date,
        receiverName: receiver_name,
        driverName: driver_name,
        vehiclePlate: vehicle_plate,
        notes: notes || undefined,
      });

      if (!closeRes.ok) {
        console.warn('[WMS Webhook] Auto-close failed:', closeRes.error);
        return NextResponse.json({ success: false, error: closeRes.error }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        action: 'ORDER_DELIVERED',
        order_no: closeRes.order?.orderNo,
        message: 'Order updated to DELIVERED with Proof of Delivery',
      });
    }

    // Intermediate status update (e.g. In Transit, Picked Up)
    const admin = getServiceSupabase();
    let query = admin.from('outbound_orders').update({
      tms_status: status,
      tms_synced_at: new Date().toISOString(),
    });

    if (wms_order_no) {
      query = query.eq('order_no', wms_order_no);
    } else {
      query = query.or(`tms_job_id.eq.${job_id},tracking_no.eq.${job_id}`);
    }

    const { error: upErr } = await query;
    if (upErr) {
      console.warn('[WMS Webhook] Intermediate status update warning:', upErr.message);
    }

    return NextResponse.json({
      success: true,
      action: 'STATUS_UPDATED',
      tms_status: status,
    });
  } catch (err: any) {
    console.error('[WMS Webhook Error]:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
