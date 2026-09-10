// WMS -> TMS (ePOD) integration.
//
// When a WMS order ships we create a delivery job in the TMS via its existing
// public "Enterprise Integration API" (POST /api/external/v1/jobs). We do NOT
// touch the TMS codebase — we only call an endpoint it already exposes.
//
// SAFETY: every function here is fault-isolated and feature-flagged. It only
// runs when both TMS_API_URL and TMS_API_KEY are configured, and it never
// throws — a TMS outage, timeout, or misconfig must never break the WMS ship
// flow. Failures are logged and swallowed.

import type { OutboundOrder } from './data/orders';

export function isTmsEnabled(): boolean {
  return Boolean(process.env.TMS_API_URL && process.env.TMS_API_KEY);
}

// Resolve which TMS branch (Jobs_Main.Branch_ID) a shipped order belongs to.
// Priority: the order's own WMS branch code (multi-branch, one shared WMS) →
// translated via TMS_BRANCH_MAP when WMS and TMS use different codes → else the
// code as-is (they usually match, e.g. 'URT') → else the TMS_BRANCH_ID default.
// So adding a new branch just needs the same code created in both systems — no
// env change per branch.
function resolveTmsBranch(order: OutboundOrder): string | undefined {
  const code = (order.branchCode || '').trim();
  if (code) {
    try {
      if (process.env.TMS_BRANCH_MAP) {
        const map = JSON.parse(process.env.TMS_BRANCH_MAP) as Record<string, string>;
        if (map && map[code]) return map[code];
      }
    } catch {
      /* malformed TMS_BRANCH_MAP — fall through to identity */
    }
    return code;
  }
  return process.env.TMS_BRANCH_ID || undefined;
}

export interface TmsResult {
  ok: boolean;
  jobId?: string;
  trackingUrl?: string;
  skipped?: boolean;
  error?: string;
}

export interface TmsJobStatusResult {
  ok: boolean;
  job?: {
    jobId: string;
    status: string;
    isCompleted: boolean;
    planDate?: string;
    deliveryDate?: string;
    actualDeliveryTime?: string;
    driverName?: string;
    vehiclePlate?: string;
    signatureUrl?: string | null;
    photoProofUrl?: string | null;
    photoUrls: string[];
    receiverName?: string | null;
    trackingUrl?: string;
    wmsOrderNo?: string;
  };
  error?: string;
}

export function getTmsTrackingUrl(jobId: string): string {
  const base = (process.env.TMS_APP_URL || 'https://tms-e-pod.vercel.app').replace(/\/+$/, '');
  return `${base}/track/${encodeURIComponent(jobId)}`;
}

/**
 * Checks if the carrier name represents the internal company delivery fleet (Own Fleet / TMS ePOD).
 * Matches: 'รถขนส่งบริษัท', 'รถคลังจัดส่งเอง', 'Company Fleet', 'FLEET', 'OWN_FLEET', 'จัดส่งเอง'.
 */
export function isCompanyFleetCarrier(carrier?: string | null): boolean {
  if (!carrier) return false;
  const c = carrier.trim().toLowerCase();
  return (
    c.includes('บริษัท') ||
    c.includes('จัดส่งเอง') ||
    c.includes('fleet') ||
    c === 'own_fleet'
  );
}

// Create a TMS delivery job for a shipped WMS order. Never throws.
export async function createTmsDeliveryJob(order: OutboundOrder): Promise<TmsResult> {
  if (!isTmsEnabled()) return { ok: false, skipped: true, error: 'disabled' };

  // Only dispatch to TMS for internal company fleet shipments.
  // 3PL shipments (Flash, Kerry, J&T, EMS, etc.) are handled by their respective courier networks.
  if (!isCompanyFleetCarrier(order.carrier)) {
    console.log(`[tms] order ${order.orderNo} carrier '${order.carrier || 'none'}' is not company fleet — skipping TMS job`);
    return { ok: false, skipped: true, error: 'not-company-fleet' };
  }

  // TMS requires a delivery address; skip quietly if the order has none.
  if (!order.shipAddress || !order.shipAddress.trim()) {
    console.warn(`[tms] order ${order.orderNo} has no ship address — skipping TMS job`);
    return { ok: false, skipped: true, error: 'no-address' };
  }

  try {
    const url = process.env.TMS_API_URL as string;
    const pickup = (process.env.TMS_PICKUP_ADDRESS || 'คลังสินค้า NEXUS WMS').trim();

    const itemsSummary = (order.items || []).map((i) => `${i.name} x${i.qty}`).join(', ');
    const details =
      `[WMS ${order.orderNo}] ${itemsSummary}` +
      (order.carrier ? ` | ${order.carrier} ${order.trackingNo || ''}`.trimEnd() : '');

    const payload: Record<string, unknown> = {
      customer_id: order.customerName || order.orderNo,
      customer_name: order.customerName || '',
      customer_phone: order.phone || '',
      pickup_address: pickup,
      delivery_address: order.shipAddress.trim(),
      items: details,
      vehicle_type: '',
      wms_order_no: order.orderNo,
      tracking_no: order.trackingNo || '',
      notes: `ออเดอร์ WMS: ${order.orderNo}${order.customerName ? ` (${order.customerName})` : ''}`,
    };

    // Scope the TMS job to the order's branch (e.g. 'URT', 'SKN').
    const branch = resolveTmsBranch(order);
    if (branch) {
      payload.branch_id = branch;
    }

    // Hard 8s timeout so a slow TMS never stalls the ship request.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TMS_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`[tms] create job failed for ${order.orderNo}: HTTP ${res.status} ${txt}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data: any = await res.json().catch(() => ({}));
    const jobId = data?.job_id != null ? String(data.job_id) : undefined;
    const trackingUrl = data?.tracking_url || (jobId ? getTmsTrackingUrl(jobId) : undefined);

    return { ok: true, jobId, trackingUrl };
  } catch (e: any) {
    console.error(`[tms] create job error for ${order.orderNo}:`, e?.message || e);
    return { ok: false, error: e?.message || 'error' };
  }
}

// Query real-time status and POD proof from TMS for a job or order. Never throws.
export async function fetchTmsJobStatus(target: { jobId?: string; orderNo?: string }): Promise<TmsJobStatusResult> {
  if (!isTmsEnabled()) return { ok: false, error: 'disabled' };
  if (!target.jobId && !target.orderNo) return { ok: false, error: 'missing target' };

  try {
    const baseUrl = process.env.TMS_API_URL as string;
    const url = new URL(baseUrl);
    if (target.jobId) url.searchParams.set('job_id', target.jobId);
    else if (target.orderNo) url.searchParams.set('wms_order_no', target.orderNo);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.TMS_API_KEY}`,
      },
      signal: controller.signal,
      cache: 'no-store',
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`[tms] fetch status failed: HTTP ${res.status} ${txt}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    if (!data.success || !data.job) {
      return { ok: false, error: data.error || 'Job not found' };
    }

    const j = data.job;
    return {
      ok: true,
      job: {
        jobId: String(j.job_id),
        status: j.status || 'New',
        isCompleted: Boolean(j.is_completed),
        planDate: j.plan_date,
        deliveryDate: j.delivery_date,
        actualDeliveryTime: j.actual_delivery_time,
        driverName: j.driver_name || undefined,
        vehiclePlate: j.vehicle_plate || undefined,
        signatureUrl: j.signature_url || null,
        photoProofUrl: j.photo_proof_url || null,
        photoUrls: Array.isArray(j.photo_urls) ? j.photo_urls : [],
        receiverName: j.receiver_name || null,
        trackingUrl: j.tracking_url || getTmsTrackingUrl(String(j.job_id)),
        wmsOrderNo: j.wms_order_no,
      },
    };
  } catch (e: any) {
    console.error('[tms] fetch status error:', e?.message || e);
    return { ok: false, error: e?.message || 'error' };
  }
}

