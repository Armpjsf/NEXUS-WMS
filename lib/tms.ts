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
    // Scope the TMS job to the order's branch (e.g. 'URT', 'SKN'). Driver /
    // plate / vehicle stay empty on purpose — TMS fills those on assignment/bid.
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
    return { ok: true, jobId: data?.job_id != null ? String(data.job_id) : undefined };
  } catch (e: any) {
    // Includes AbortError (timeout) and network errors.
    console.error(`[tms] create job error for ${order.orderNo}:`, e?.message || e);
    return { ok: false, error: e?.message || 'error' };
  }
}
