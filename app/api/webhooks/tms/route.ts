import { NextResponse } from 'next/server';
import { closeOrderFromTmsPod } from '@/lib/data/orders';
import { getServiceSupabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/apiAuth';
import { isManagementRole } from '@/lib/rbac';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * Webhook endpoint for TMS (ePOD) to notify WMS of delivery updates and POD completions.
 * POST /api/webhooks/tms
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const secretHeader = request.headers.get('x-wms-secret') || '';
    const expectedSecret = process.env.TMS_WEBHOOK_SECRET || 'nexus_wms_tms_secret_2026';

    if (expectedSecret) {
      const cleanBearer = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      if (cleanBearer !== expectedSecret && secretHeader !== expectedSecret) {
        const user = await getSessionUser();
        if (!user || !isManagementRole(user.role)) {
          console.warn('[WMS Webhook] Unauthorized attempt from TMS');
          return NextResponse.json({ error: 'Unauthorized: Invalid webhook secret' }, { status: 401 });
        }
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
      has_incidents,
      incidents,
    } = payload;

    if (!job_id && !wms_order_no) {
      return NextResponse.json({ error: 'Missing job_id or wms_order_no' }, { status: 400 });
    }

    const safeJobId = job_id ? String(job_id).replace(/[^a-zA-Z0-9._-]/g, '') : '';
    if (!wms_order_no && !safeJobId) {
      return NextResponse.json({ error: 'Invalid job_id' }, { status: 400 });
    }

    console.log(`[WMS Webhook] Received ${event} for TMS Job ${safeJobId} (WMS: ${wms_order_no || 'n/a'}) - Status: ${status} (Incidents: ${has_incidents ? 'YES' : 'NO'})`);

    // If job is completed/delivered with POD proofs -> Auto close the order(s)
    if (is_completed || event === 'job.completed' || ['Completed', 'Delivered'].includes(status)) {
      const orderNumbers = wms_order_no
        ? String(wms_order_no).split(',').map(s => s.trim()).filter(Boolean)
        : [];

      if (orderNumbers.length > 1) {
        // Multi-drop consolidated trip completion
        for (const orderNo of orderNumbers) {
          await closeOrderFromTmsPod({
            orderNo,
            tmsJobId: safeJobId || undefined,
            signatureUrl: signature_url,
            photoUrls: Array.isArray(photo_urls) ? photo_urls : [],
            deliveryDate: delivery_date,
            receiverName: receiver_name,
            driverName: driver_name,
            vehiclePlate: vehicle_plate,
            notes: notes || undefined,
            hasIncidents: Boolean(has_incidents || (Array.isArray(incidents) && incidents.length > 0)),
            incidents: Array.isArray(incidents) ? incidents : undefined,
          });
        }
        return NextResponse.json({
          success: true,
          action: 'TRIP_DELIVERED',
          orders_count: orderNumbers.length,
          message: `Consolidated trip ${safeJobId} completed for ${orderNumbers.length} orders`,
        });
      }

      const closeRes = await closeOrderFromTmsPod({
        orderNo: wms_order_no || undefined,
        tmsJobId: safeJobId || undefined,
        signatureUrl: signature_url,
        photoUrls: Array.isArray(photo_urls) ? photo_urls : [],
        deliveryDate: delivery_date,
        receiverName: receiver_name,
        driverName: driver_name,
        vehiclePlate: vehicle_plate,
        notes: notes || undefined,
        hasIncidents: Boolean(has_incidents || (Array.isArray(incidents) && incidents.length > 0)),
        incidents: Array.isArray(incidents) ? incidents : undefined,
      });

      if (!closeRes.ok) {
        console.warn('[WMS Webhook] Auto-close failed:', closeRes.error);
        return NextResponse.json({ success: false, error: closeRes.error }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        action: 'ORDER_DELIVERED',
        order_no: closeRes.order?.orderNo,
        has_incidents: closeRes.order?.podNote?.includes('⚠️'),
        message: 'Order updated to DELIVERED with Proof of Delivery',
      });
    }

    // Intermediate status update (e.g. In Transit, Picked Up, Damage Reported)
    const admin = getServiceSupabase();
    // org-scope-ok: TMS webhook (TMS_WEBHOOK_SECRET) addresses orders by global-unique order_no / tms_job_id
    const patchData: Record<string, any> = {
      tms_status: status,
      tms_synced_at: new Date().toISOString(),
    };
    if (driver_name) patchData.driver_name = driver_name;
    if (vehicle_plate) patchData.vehicle_plate = vehicle_plate;
    if (has_incidents && Array.isArray(incidents) && incidents.length > 0) {
      const incSummaries = incidents
        .map((i: any) => `${i.category || 'ปัญหาขนส่ง'}${i.description ? `: ${i.description}` : ''}`)
        .join(' | ');
      patchData.pod_note = `⚠️ ตรวจพบปัญหาขนส่งระหว่างทาง: ${incSummaries}`;
    }

    let query = admin.from('outbound_orders').update(patchData);

    if (wms_order_no) {
      query = query.eq('order_no', wms_order_no);
    } else {
      query = query.or(`tms_job_id.eq.${safeJobId},tracking_no.eq.${safeJobId}`);
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
  } catch (err) {
    console.error('[WMS Webhook Error]:', err);
    return NextResponse.json({ error: errorMessage(err) || 'Internal Server Error' }, { status: 500 });
  }
}
