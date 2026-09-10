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

export interface TmsResult {
  ok: boolean;
  jobId?: string;
  skipped?: boolean;
  error?: string;
}

// Create a TMS delivery job for a shipped WMS order. Never throws.
export async function createTmsDeliveryJob(order: OutboundOrder): Promise<TmsResult> {
  if (!isTmsEnabled()) return { ok: false, skipped: true, error: 'disabled' };

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
      pickup_address: pickup,
      delivery_address: order.shipAddress.trim(),
      items: details,
      vehicle_type: '',
      // plan_date omitted -> TMS defaults to today (todayTH)
    };
    // Optionally scope the TMS job to a branch (maps this warehouse to a TMS
    // Branch_ID, e.g. 'HQ'). Driver / plate / vehicle stay empty on purpose —
    // TMS fills those when the job is assigned/bid.
    if (process.env.TMS_BRANCH_ID) {
      payload.branch_id = process.env.TMS_BRANCH_ID;
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
    return { ok: true, jobId: data?.job_id != null ? String(data.job_id) : undefined };
  } catch (e: any) {
    // Includes AbortError (timeout) and network errors.
    console.error(`[tms] create job error for ${order.orderNo}:`, e?.message || e);
    return { ok: false, error: e?.message || 'error' };
  }
}
