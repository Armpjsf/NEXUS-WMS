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
import { errorMessage } from '@/lib/errors';
import { validateIntegrationUrl } from '@/lib/urlSecurity';
import { getEntitlements, isOperationAllowedInState } from '@/lib/entitlements';
import {
  enqueueOutboxEvent,
  signWebhookPayload,
} from '@/lib/integrationOutboxInbox';
import type { ExternalOrderJobLink } from '@/lib/contracts/integrationContracts';

export function getTmsApiUrl(): string {
  return (process.env.TMS_API_URL || '').trim();
}

export function getTmsApiKey(): string {
  return (process.env.TMS_API_KEY || '').trim();
}

export function isTmsEnabled(): boolean {
  if (process.env.TMS_DISABLED === 'true') return false;
  const urlCheck = validateIntegrationUrl(getTmsApiUrl());
  return urlCheck.valid && getTmsApiKey().length > 0;
}

export async function isTmsEnabledForTenant(orgId?: string): Promise<boolean> {
  if (!isTmsEnabled()) return false;
  try {
    const ent = await getEntitlements(orgId);
    return ent.modules.includes('tms') && isOperationAllowedInState(ent.state, 'integration');
  } catch {
    return false;
  }
}

function getDefaultBranchCode(): string {
  return (process.env.TMS_BRANCH_ID || process.env.NEXT_PUBLIC_DEFAULT_BRANCH_CODE || '').trim();
}

// Resolve which TMS branch (Jobs_Main.Branch_ID) a shipped order belongs to.
// Priority: the order's own WMS branch code (multi-branch, one shared WMS) →
// translated via TMS_BRANCH_MAP when WMS and TMS use different codes → else the
// code as-is → else the configured TMS_BRANCH_ID default.
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
  return getDefaultBranchCode() || undefined;
}

export type TmsDispatchState = 'pending' | 'accepted' | 'failed' | 'disconnected';

export interface TmsResult {
  ok: boolean;
  jobId?: string;
  trackingUrl?: string;
  skipped?: boolean;
  error?: string;
  reconciled?: boolean;
  dispatchState?: TmsDispatchState;
  queuedOutboxEventId?: string;
  externalEntityLinks?: ExternalOrderJobLink[];
}

function getConnectionIdForTenant(orgId?: string): string {
  const configured = (process.env.NEXUS_CONNECTION_ID || '').trim();
  if (configured) return configured;
  return `conn-wms-tms-${(orgId || 'default').trim() || 'default'}`;
}

function buildDispatchHeaders(rawBody: string, eventId: string, connectionId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getTmsApiKey()}`,
    'Idempotency-Key': eventId,
    'X-Nexus-Event-Id': eventId,
    'X-Nexus-Connection-Id': connectionId,
  };
  const signingSecret = (process.env.NEXUS_SIGNING_SECRET || process.env.TMS_WEBHOOK_SECRET || '').trim();
  const keyId = (process.env.NEXUS_SIGNING_KEY_ID || 'key-v1').trim();
  if (signingSecret) {
    Object.assign(headers, signWebhookPayload(rawBody, signingSecret, keyId));
  }
  return headers;
}

/**
 * Reconciles a timed-out or network-interrupted WMS -> TMS dispatch by querying TMS status
 * before retrying job creation, preventing duplicate jobs or stock double-deduction.
 */
export async function reconcileTimedOutTmsDispatch(params: {
  targetJobId?: string;
  orderNo?: string;
  orgId?: string;
}): Promise<{
  reconciled: boolean;
  existsInTms: boolean;
  jobId?: string;
  trackingUrl?: string;
  status?: string;
  error?: string;
}> {
  if (!isTmsEnabled()) {
    return { reconciled: false, existsInTms: false, error: 'disabled' };
  }
  const res = await fetchTmsJobStatus({
    jobId: params.targetJobId,
    orderNo: params.orderNo,
  });
  if (res.ok && res.job) {
    return {
      reconciled: true,
      existsInTms: true,
      jobId: res.job.jobId,
      trackingUrl: res.job.trackingUrl,
      status: res.job.status,
    };
  }
  return {
    reconciled: false,
    existsInTms: false,
    error: res.error || 'not_found',
  };
}

export interface TmsIncidentItem {
  category: string;
  description: string | null;
  status: string;
  image_url: string | null;
  reported_at: string;
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
    hasIncidents?: boolean;
    incidents?: TmsIncidentItem[];
  };
  error?: string;
}

export function getTmsTrackingUrl(jobId: string): string {
  const base = (process.env.TMS_APP_URL || process.env.NEXT_PUBLIC_TMS_APP_URL || '').trim().replace(/\/+$/, '');
  if (!base) return '';
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
export async function createTmsDeliveryJob(order: OutboundOrder & { orgId?: string; requireScanDelivery?: boolean }): Promise<TmsResult> {
  if (!isTmsEnabled()) return { ok: false, skipped: true, error: 'disabled', dispatchState: 'disconnected' };
  const tenantOrgId = order.orgId || (order as any).org_id;
  if (!(await isTmsEnabledForTenant(tenantOrgId))) {
    return { ok: true, skipped: true, error: 'tms-module-not-subscribed', dispatchState: 'disconnected' };
  }

  // Only dispatch to TMS for internal company fleet shipments.
  // 3PL shipments (Flash, Kerry, J&T, EMS, etc.) are handled by their respective courier networks.
  if (!isCompanyFleetCarrier(order.carrier)) {
    console.log(`[tms] order ${order.orderNo} carrier '${order.carrier || 'none'}' is not company fleet — skipping TMS job`);
    return { ok: false, skipped: true, error: 'not-company-fleet', dispatchState: 'disconnected' };
  }

  // TMS requires a delivery address; use fallback if order has no explicit address so job creation is never blocked
  const effectiveAddress = (
    order.shipAddress?.trim() ||
    (order.destinations && order.destinations[0]?.address?.trim()) ||
    `จัดส่งลูกค้า ${order.customerName || order.orderNo} (ปลายทางตามเอกสารส่งมอบ)`
  );

  // Derive TMS Job ID directly from WMS Order Number (ORD-2026-8008 -> JOB-2026-8008)
  const targetJobId = order.orderNo.startsWith('ORD-')
    ? order.orderNo.replace(/^ORD-/, 'JOB-')
    : (order.orderNo.startsWith('JOB-') ? order.orderNo : `JOB-${order.orderNo}`);
  const orgKey = String(tenantOrgId || 'default').trim() || 'default';
  const connectionId = getConnectionIdForTenant(orgKey);
  const eventId = `wms-dispatch:${orgKey}:${order.id || order.orderNo}`;
  const externalEntityLinks: ExternalOrderJobLink[] =
    Array.isArray(order.destinations) && order.destinations.length > 0
      ? order.destinations.map((d, idx) => ({
          wms_order_id: order.id || order.orderNo,
          wms_order_no: order.orderNo,
          drop_index: Number(d.drop) || idx + 1,
          tms_job_id: targetJobId,
        }))
      : [
          {
            wms_order_id: order.id || order.orderNo,
            wms_order_no: order.orderNo,
            drop_index: 1,
            tms_job_id: targetJobId,
          },
        ];

  let payload: Record<string, unknown> = {};
  try {
    const url = getTmsApiUrl();

    // Prefer the pickup point the checker chose for this job (name + coords).
    // Fall back to branch/warehouse settings only when none was selected.
    let pickup = (order.pickupName || order.pickupAddress || '').trim();
    if (!pickup) pickup = (process.env.TMS_PICKUP_ADDRESS || '').trim();
    if (!pickup) {
      try {
        const branchCode = (order.branchCode || getDefaultBranchCode()).trim();
        if (branchCode) {
          const { getServiceSupabase } = await import('@/lib/supabase');
          // org-scope-ok: runs from the TMS push path without a session; falls back to env when ambiguous
          const { data: bRow } = await getServiceSupabase()
            .from('branches')
            .select('name, warehouse_name, pickup_address')
            .eq('code', branchCode)
            .maybeSingle();

          if (bRow?.warehouse_name) {
            pickup = bRow.warehouse_name.trim();
          } else if (bRow?.pickup_address) {
            pickup = bRow.pickup_address.trim();
          } else if (bRow?.name) {
            pickup = bRow.name.includes('คลัง') ? bRow.name : `คลังสินค้า ${bRow.name}`;
          }
        }
      } catch (err) {
        console.warn('[tms] could not query branch for pickup origin:', err);
      }
    }
    if (!pickup) {
      const bc = (order.branchCode || getDefaultBranchCode()).trim();
      pickup = bc ? `คลังสินค้าสาขา ${bc}` : 'คลังสินค้าหลัก';
    }

    const itemsSummary = (order.items || []).map((i) => `${i.name} x${i.qty}`).join(', ');
    const details =
      `[WMS ${order.orderNo}] ${itemsSummary}` +
      (order.carrier ? ` | ${order.carrier} ${order.trackingNo || ''}`.trimEnd() : '');

    const itemsList = (order.items || []).map((it) => ({
      code: it.sku || it.name,
      label: it.name,
      qty: it.qty,
      drop: it.drop || 1, // per-drop manifest so the driver app can reconcile at each stop
    }));

    const hasMultipleDrops = Array.isArray(order.destinations) && order.destinations.length > 1;
    const deliveryAddress = (
      hasMultipleDrops
        ? order.destinations!.map(d => `[ดรอป ${d.drop}] ${d.name} (${d.phone}): ${d.address}`).join(' | ')
        : (order.shipAddress || '')
    ).trim() || effectiveAddress;

    payload = {
      customer_id: order.customerName || order.orderNo,
      customer_name: order.customerName || '',
      customer_phone: order.phone || '',
      pickup_address: pickup,
      delivery_address: deliveryAddress,
      items: details,
      items_list: itemsList,
      parcel_barcode: order.trackingNo || order.orderNo,
      box_count: order.boxCount || 1,
      weight_kg: order.weightKg || null,
      cargo_type: itemsSummary.length > 60 ? `${itemsSummary.substring(0, 57)}...` : itemsSummary,
      vehicle_type: order.vehicleType || '4-Wheel',
      // Pre-assigned company vehicle/driver (checker picked the plate at the dock).
      ...(order.vehiclePlate ? { vehicle_plate: order.vehiclePlate } : {}),
      ...(order.driverName ? { driver_name: order.driverName } : {}),
      ...(typeof order.requireScanDelivery === 'boolean' ? { require_scan_delivery: order.requireScanDelivery } : {}),
      // Pickup coordinates (from the checker's chosen pickup point) so the TMS
      // job gets a real origin pin instead of only a text location.
      ...(order.pickupLat != null && order.pickupLon != null
        ? { pickup_lat: order.pickupLat, pickup_lon: order.pickupLon }
        : {}),
      // Delivery coordinates from the first drop that has them (main dest pin).
      ...(() => {
        const d = (order.destinations || []).find(x => x.lat != null && x.lng != null);
        return d ? { delivery_lat: d.lat, delivery_lon: d.lng } : {};
      })(),
      wms_order_id: order.id,
      wms_order_no: order.orderNo,
      job_id: targetJobId,
      tracking_no: order.trackingNo || targetJobId,
      notes: `ออเดอร์ WMS: ${order.orderNo}${order.customerName ? ` (${order.customerName})` : ''}`,
      external_entity_links: externalEntityLinks,
      ...(hasMultipleDrops ? {
        stops: order.destinations!.map((d, idx) => ({
          stop_number: d.drop,
          drop_index: Number(d.drop) || idx + 1,
          wms_order_id: order.id,
          wms_order_no: order.orderNo,
          recipient_name: d.name,
          phone: d.phone,
          address: d.address,
          notes: d.notes || '',
          ...(d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : {}),
        })),
      } : {}),
    };

    // Scope the TMS job to the order's branch (e.g. 'URT', 'SKN').
    const branch = resolveTmsBranch(order);
    if (branch) {
      payload.branch_id = branch;
    }

    const rawBody = JSON.stringify(payload);
    // Hard 8s timeout so a slow TMS never stalls the ship request.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'POST',
      headers: buildDispatchHeaders(rawBody, eventId, connectionId),
      body: rawBody,
      redirect: 'error',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`[tms] create job failed for ${order.orderNo}: HTTP ${res.status} ${txt}`);
      await enqueueOutboxEvent({
        eventId,
        tenantId: orgKey,
        connectionId,
        aggregateId: order.id || order.orderNo,
        aggregateVersion: 1,
        eventType: 'wms.dispatch.created',
        schemaVersion: '2.0.0',
        payload,
      });
      return {
        ok: false,
        error: `HTTP ${res.status}`,
        dispatchState: 'failed',
        queuedOutboxEventId: eventId,
        externalEntityLinks,
      };
    }

    const data: any = await res.json().catch(() => ({}));
    const jobId = data?.job_id != null ? String(data.job_id) : targetJobId;
    const trackingUrl = data?.tracking_url || (jobId ? getTmsTrackingUrl(jobId) : undefined);

    return {
      ok: true,
      jobId,
      trackingUrl,
      dispatchState: 'accepted',
      externalEntityLinks,
    };
  } catch (e) {
    const errMsg = errorMessage(e) || 'error';
    console.error(`[tms] create job error for ${order.orderNo}:`, errMsg);

    // Timeout / network failure reconciliation: check if TMS actually created the job
    const reconciled = await reconcileTimedOutTmsDispatch({
      targetJobId,
      orderNo: order.orderNo,
      orgId: orgKey,
    });
    if (reconciled.existsInTms && reconciled.jobId) {
      return {
        ok: true,
        jobId: reconciled.jobId,
        trackingUrl: reconciled.trackingUrl || getTmsTrackingUrl(reconciled.jobId),
        reconciled: true,
        dispatchState: 'accepted',
        externalEntityLinks,
      };
    }

    await enqueueOutboxEvent({
      eventId,
      tenantId: orgKey,
      connectionId,
      aggregateId: order.id || order.orderNo,
      aggregateVersion: 1,
      eventType: 'wms.dispatch.created',
      schemaVersion: '2.0.0',
      payload: Object.keys(payload).length ? payload : { job_id: targetJobId, wms_order_no: order.orderNo, external_entity_links: externalEntityLinks },
    });

    return {
      ok: false,
      error: errMsg,
      dispatchState: 'failed',
      queuedOutboxEventId: eventId,
      externalEntityLinks,
    };
  }
}

/**
 * Creates a single consolidated Multi-Drop Trip Job in TMS from multiple WMS orders.
 * Fault-tolerant: if TMS is disabled or fails, returns gracefully so WMS continues operating.
 */
export async function createTmsConsolidatedTripJob(params: {
  tripId: string;
  orgId?: string;
  driverName?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  pickupAddress?: string;
  branchCode?: string;
  requireScanDelivery?: boolean;
  orders: OutboundOrder[];
}): Promise<TmsResult> {
  if (!isTmsEnabled()) {
    return { ok: true, skipped: true, jobId: params.tripId, dispatchState: 'disconnected' };
  }
  const tenantOrgId = params.orgId || (params.orders[0] as any)?.orgId || (params.orders[0] as any)?.org_id;
  if (!(await isTmsEnabledForTenant(tenantOrgId))) {
    return { ok: true, skipped: true, jobId: params.tripId, error: 'tms-module-not-subscribed', dispatchState: 'disconnected' };
  }

  const orgKey = String(tenantOrgId || 'default').trim() || 'default';
  const connectionId = getConnectionIdForTenant(orgKey);
  const eventId = `wms-trip-dispatch:${orgKey}:${params.tripId}`;
  const externalEntityLinks: ExternalOrderJobLink[] = params.orders.map((o, idx) => ({
    wms_order_id: o.id,
    wms_order_no: o.orderNo,
    drop_index: idx + 1,
    tms_job_id: params.tripId,
  }));

  let payload: Record<string, unknown> = {};
  try {
    const url = getTmsApiUrl();
    const stops = params.orders.map((o, idx) => ({
      stop_number: idx + 1,
      drop_index: idx + 1,
      drop: idx + 1,
      wms_order_id: o.id,
      wms_order_no: o.orderNo,
      name: o.customerName || `ลูกค้าจุดที่ ${idx + 1}`,
      recipient_name: o.customerName || `ลูกค้าจุดที่ ${idx + 1}`,
      phone: o.phone || '',
      address: o.shipAddress || 'ไม่ระบุที่อยู่',
      notes: `[WMS: ${o.orderNo}] สินค้า ${o.items?.length || 0} รายการ (${o.totalQty} ชิ้น)`,
    }));

    const allItemsSummary = params.orders.map(o => `${o.orderNo} (${o.totalQty} ชิ้น)`).join(', ');
    const totalWeight = params.orders.reduce((sum, o) => sum + (Number(o.weightKg) || 0), 0);

    const branchCode = (params.branchCode || getDefaultBranchCode()).trim();
    payload = {
      job_id: params.tripId,
      trip_id: params.tripId,
      tracking_no: params.tripId,
      customer_id: 'Multi-Drop Consolidated Delivery',
      customer_name: `ทริปจัดส่งรวม ${params.orders.length} จุด`,
      pickup_address: params.pickupAddress || (branchCode ? `คลังสินค้าสาขา ${branchCode}` : 'คลังสินค้าหลัก'),
      delivery_address: stops.map(s => `[จุดที่ ${s.stop_number}] ${s.name}: ${s.address}`).join(' | '),
      cargo_type: `ทริปจัดส่งรวม ${params.orders.length} ออเดอร์ (${allItemsSummary.substring(0, 50)})`,
      vehicle_type: params.vehicleType || '4-Wheel',
      ...(params.vehiclePlate ? { vehicle_plate: params.vehiclePlate } : {}),
      ...(params.driverName ? { driver_name: params.driverName } : {}),
      ...(typeof params.requireScanDelivery === 'boolean' ? { require_scan_delivery: params.requireScanDelivery } : {}),
      ...(totalWeight > 0 ? { weight_kg: totalWeight } : {}),
      wms_order_no: params.orders.map(o => o.orderNo).join(','),
      notes: `ทริปจัดส่งรวม WMS: ${params.orders.map(o => `[WMS: ${o.orderNo}]`).join(' ')}`,
      stops,
      external_entity_links: externalEntityLinks,
      total_drop: stops.length,
      ...(branchCode ? { branch_id: branchCode } : {}),
    };

    const rawBody = JSON.stringify(payload);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'POST',
      headers: buildDispatchHeaders(rawBody, eventId, connectionId),
      body: rawBody,
      redirect: 'error',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`[tms] create consolidated trip job failed for ${params.tripId}: HTTP ${res.status} ${txt}`);
      await enqueueOutboxEvent({
        eventId,
        tenantId: orgKey,
        connectionId,
        aggregateId: params.tripId,
        aggregateVersion: 1,
        eventType: 'wms.trip_dispatch.created',
        schemaVersion: '2.0.0',
        payload,
      });
      return {
        ok: false,
        error: `HTTP ${res.status}`,
        dispatchState: 'failed',
        queuedOutboxEventId: eventId,
        externalEntityLinks,
      };
    }

    const data: any = await res.json().catch(() => ({}));
    const jobId = data?.job_id != null ? String(data.job_id) : params.tripId;
    return {
      ok: true,
      jobId,
      trackingUrl: data?.tracking_url || getTmsTrackingUrl(jobId),
      dispatchState: 'accepted',
      externalEntityLinks,
    };
  } catch (e) {
    const errMsg = errorMessage(e) || 'error';
    console.error(`[tms] create consolidated trip job error for ${params.tripId}:`, errMsg);

    const reconciled = await reconcileTimedOutTmsDispatch({
      targetJobId: params.tripId,
      orderNo: params.orders[0]?.orderNo,
      orgId: orgKey,
    });
    if (reconciled.existsInTms && reconciled.jobId) {
      return {
        ok: true,
        jobId: reconciled.jobId,
        trackingUrl: reconciled.trackingUrl || getTmsTrackingUrl(reconciled.jobId),
        reconciled: true,
        dispatchState: 'accepted',
        externalEntityLinks,
      };
    }

    await enqueueOutboxEvent({
      eventId,
      tenantId: orgKey,
      connectionId,
      aggregateId: params.tripId,
      aggregateVersion: 1,
      eventType: 'wms.trip_dispatch.created',
      schemaVersion: '2.0.0',
      payload: Object.keys(payload).length ? payload : { job_id: params.tripId, external_entity_links: externalEntityLinks },
    });

    return {
      ok: false,
      error: errMsg,
      dispatchState: 'failed',
      queuedOutboxEventId: eventId,
      externalEntityLinks,
    };
  }
}

// เพิ่มสินค้าเข้างาน TMS ที่สร้างไปแล้ว (ลูกค้าเพิ่มของหลังเช็คเกอร์สร้างงาน). Never throws.
export interface TmsAppendItem { code?: string; label?: string; qty?: number; drop?: number; }
export async function appendTmsJobItems(
  jobId: string,
  items: TmsAppendItem[],
  wmsOrderNo?: string
): Promise<{ ok: boolean; added?: number; error?: string; skipped?: boolean }> {
  if (!isTmsEnabled()) return { ok: false, skipped: true, error: 'disabled' };
  if (!jobId || !items?.length) return { ok: false, error: 'no-items' };
  try {
    const base = getTmsApiUrl().replace(/\/+$/, '');
    const url = `${base}/${encodeURIComponent(jobId)}/items`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getTmsApiKey()}`,
      },
      body: JSON.stringify({ items, wms_order_no: wmsOrderNo }),
      redirect: 'error',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`[tms] append items failed for ${jobId}: HTTP ${res.status} ${txt}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data: any = await res.json().catch(() => ({}));
    return { ok: true, added: Number(data?.items_added ?? items.length) };
  } catch (e) {
    console.error(`[tms] append items error for ${jobId}:`, errorMessage(e) || e);
    return { ok: false, error: errorMessage(e) || 'error' };
  }
}

// Query real-time status and POD proof from TMS for a job or order. Never throws.
export async function fetchTmsJobStatus(target: { jobId?: string; orderNo?: string }): Promise<TmsJobStatusResult> {
  if (!isTmsEnabled()) return { ok: false, error: 'disabled' };
  if (!target.jobId && !target.orderNo) return { ok: false, error: 'missing target' };

  try {
    const baseUrl = getTmsApiUrl();
    const url = new URL(baseUrl);
    if (target.jobId) url.searchParams.set('job_id', target.jobId);
    else if (target.orderNo) url.searchParams.set('wms_order_no', target.orderNo);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getTmsApiKey()}`,
      },
      redirect: 'error',
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
        hasIncidents: Boolean(j.has_incidents),
        incidents: Array.isArray(j.incidents) ? j.incidents : [],
      },
    };
  } catch (e) {
    console.error('[tms] fetch status error:', errorMessage(e) || e);
    return { ok: false, error: errorMessage(e) || 'error' };
  }
}

export interface TmsFleetDriver {
  driver_id: string;
  driver_name: string;
  phone?: string | null;
  vehicle_plate?: string | null;
  vehicle_type?: string;
  branch_id?: string | null;
  is_available: boolean;
  current_status?: string;
}

/**
 * Fetches live active fleet drivers and vehicles from TMS API.
 * Returns driver availability and assigned vehicle plates.
 */
export async function fetchTmsFleet(branchId?: string): Promise<{ ok: boolean; fleet?: TmsFleetDriver[]; error?: string }> {
  if (!isTmsEnabled()) return { ok: false, error: 'TMS disabled' };
  try {
    const base = getTmsApiUrl().replace(/\/jobs\/?$/, '/fleet');
    const url = branchId ? `${base}?branch_id=${encodeURIComponent(branchId)}` : base;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getTmsApiKey()}`,
      },
      redirect: 'error',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, fleet: data.fleet || [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

