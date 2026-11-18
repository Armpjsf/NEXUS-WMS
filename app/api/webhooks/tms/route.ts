import { NextResponse } from 'next/server';
import { applyTmsPodToWmsOrders, type ApplyTmsPodResult } from '@/lib/data/orders';
import { getSessionUser } from '@/lib/apiAuth';
import { isManagementRole } from '@/lib/rbac';
import { AtomicEffectSchemaError, errorMessage } from '@/lib/errors';
import {
  verifyWebhookSignature,
  receiveAndApplyInboxEvent,
} from '@/lib/integrationOutboxInbox';

export const dynamic = 'force-dynamic';

function resolveSecretsByKeyId(): Record<string, string> {
  const out: Record<string, string> = {};
  const jsonStr = (process.env.TMS_WEBHOOK_SECRETS_JSON || '').trim();
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim()) out[k] = v.trim();
        }
      }
    } catch {
      // ignore malformed JSON
    }
  }
  const fallbackSecret = (process.env.TMS_WEBHOOK_SECRET || '').trim();
  const defaultKeyId = (process.env.NEXUS_SIGNING_KEY_ID || 'key-v1').trim();
  if (fallbackSecret && !out[defaultKeyId]) {
    out[defaultKeyId] = fallbackSecret;
  }
  return out;
}

/**
 * Webhook endpoint for TMS (ePOD) to notify WMS of delivery updates, per-drop POD completions, and damage incidents.
 * POST /api/webhooks/tms
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const sigHeader = request.headers.get('x-nexus-signature');
    const tsHeader = request.headers.get('x-nexus-timestamp');
    const keyIdHeader = request.headers.get('x-nexus-key-id');
    const authHeader = request.headers.get('Authorization') || '';
    const secretHeader = request.headers.get('x-wms-secret') || '';
    const expectedSecret = (process.env.TMS_WEBHOOK_SECRET || '').trim();

    let authorized = false;
    let sessionOrgId: string | undefined;

    if (sigHeader || tsHeader || keyIdHeader) {
      const secretsByKeyId = resolveSecretsByKeyId();
      const sigResult = verifyWebhookSignature({
        rawBody,
        signatureHeader: sigHeader,
        timestampHeader: tsHeader,
        keyIdHeader,
        secretsByKeyId,
      });
      if (!sigResult.valid) {
        return NextResponse.json(
          { error: `Unauthorized: ${sigResult.reason || 'invalid_signature'}` },
          { status: sigResult.httpStatus || 401 },
        );
      }
      authorized = true;
    }

    if (!authorized && expectedSecret) {
      const cleanBearer = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
      if (cleanBearer === expectedSecret || secretHeader.trim() === expectedSecret) {
        authorized = true;
      }
    }

    if (!authorized) {
      const user = await getSessionUser();
      if (user && !user.revoked && user.orgId && isManagementRole(user.role)) {
        authorized = true;
        sessionOrgId = user.orgId;
      }
    }

    if (!authorized) {
      console.warn('[WMS Webhook] Unauthorized attempt from TMS');
      return NextResponse.json(
        { error: expectedSecret ? 'Unauthorized: Invalid webhook secret' : 'Unauthorized: Webhook secret not configured' },
        { status: 401 },
      );
    }

    let parsedBody: Record<string, any>;
    try {
      parsedBody = JSON.parse(rawBody || '{}');
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Support both v2 canonical envelope and flat v1/v2 payload
    const isEnvelope = Boolean(parsedBody.event_id && parsedBody.payload && typeof parsedBody.payload === 'object');
    const payload: Record<string, any> = isEnvelope ? parsedBody.payload : parsedBody;

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
      drops,
      external_entity_links,
      org_id: payloadOrgId,
    } = payload;

    const boundOrgId =
      sessionOrgId ||
      (request.headers.get('x-org-id') || '').trim() ||
      (typeof parsedBody.tenant_claim === 'string' ? parsedBody.tenant_claim.trim() : '') ||
      (typeof payloadOrgId === 'string' ? payloadOrgId.trim() : '') ||
      undefined;

    if (!job_id && !wms_order_no && !Array.isArray(drops)) {
      return NextResponse.json({ error: 'Missing job_id, wms_order_no, or drops' }, { status: 400 });
    }

    const safeJobId = job_id ? String(job_id).replace(/[^a-zA-Z0-9._-]/g, '') : '';
    if (!wms_order_no && !safeJobId && !Array.isArray(drops)) {
      return NextResponse.json({ error: 'Invalid job_id' }, { status: 400 });
    }

    const executeApply = async (inboxCtx?: {
      connectionId: string;
      tenantId: string;
      eventId: string;
      aggregateId: string;
      aggregateVersion: number;
      inboxId?: string | null;
      workerId?: string;
      fencingToken?: number | null;
      committedReceipts?: Record<string, unknown>;
      recordTargetReceipt?: (
        targetKey: string,
        result?: unknown,
        options?: { effectType?: string; markInboxComplete?: boolean },
      ) => Promise<Record<string, unknown> | null>;
    }) =>
      applyTmsPodToWmsOrders({
        orgId: boundOrgId,
        tmsJobId: safeJobId || undefined,
        wmsOrderNo: wms_order_no || undefined,
        status: status || (is_completed ? 'Delivered' : 'In Transit'),
        isCompleted: Boolean(is_completed || event === 'job.completed'),
        drops: Array.isArray(drops) ? drops : undefined,
        externalEntityLinks: Array.isArray(external_entity_links) ? external_entity_links : undefined,
        signatureUrl: signature_url,
        photoUrls: Array.isArray(photo_urls) ? photo_urls : [],
        deliveryDate: delivery_date,
        receiverName: receiver_name,
        driverName: driver_name,
        vehiclePlate: vehicle_plate,
        notes: notes || undefined,
        hasIncidents: Boolean(has_incidents || (Array.isArray(incidents) && incidents.length > 0)),
        incidents: Array.isArray(incidents) ? incidents : undefined,
        inboxContext: inboxCtx,
      });

    const eventId = parsedBody.event_id || request.headers.get('x-nexus-event-id') || request.headers.get('idempotency-key');
    const connectionId = parsedBody.connection_id || request.headers.get('x-nexus-connection-id') || `conn-tms-wms-${boundOrgId || 'default'}`;

    if (eventId) {
      const inboxRes = await receiveAndApplyInboxEvent<ApplyTmsPodResult>({
        connectionId: String(connectionId),
        tenantId: boundOrgId || 'default',
        eventId: String(eventId),
        aggregateId: String(parsedBody.aggregate_id || safeJobId || wms_order_no || 'trip'),
        aggregateVersion: Number(parsedBody.aggregate_version) || 1,
        eventType: String(parsedBody.event_type || event || 'tms.pod.updated'),
        schemaVersion: String(parsedBody.schema_version || '2.0.0'),
        payload,
        applyFn: async (inboxCtx) => executeApply(inboxCtx),
      });

      if (inboxRes.httpStatus !== 200) {
        return NextResponse.json(
          { success: false, status: inboxRes.status, error: inboxRes.error, ...(inboxRes.code ? { code: inboxRes.code } : {}) },
          { status: inboxRes.httpStatus },
        );
      }

      if (inboxRes.status === 'duplicate_ignored' || inboxRes.status === 'rejected_stale_version') {
        const cached = inboxRes.result;
        return NextResponse.json({
          success: true,
          idempotent: true,
          inboxStatus: inboxRes.status,
          applied: Array.isArray(cached?.applied) ? cached.applied : [],
          skippedIdempotent: Array.isArray(cached?.skippedIdempotent) ? cached.skippedIdempotent : [],
          failed: Array.isArray(cached?.failed) ? cached.failed : [],
          unmappedReviewQueue: Array.isArray(cached?.unmappedReviewQueue) ? cached.unmappedReviewQueue : [],
        });
      }

      const applyRes = inboxRes.result!;
      return NextResponse.json({
        success: applyRes.failed.length === 0,
        inboxStatus: inboxRes.status,
        ...applyRes,
      });
    }

    const applyRes = await executeApply();
    if (
      applyRes.applied.length === 0 &&
      applyRes.skippedIdempotent.length === 0 &&
      applyRes.failed.length === 0 &&
      applyRes.unmappedReviewQueue.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'No matching orders found in tenant scope (queued for unmapped review)',
          ...applyRes,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: applyRes.failed.length === 0,
      ...applyRes,
    });
  } catch (err) {
    if (err instanceof AtomicEffectSchemaError) {
      return NextResponse.json({ success: false, code: err.code, error: err.message }, { status: err.status });
    }
    console.error('[WMS Webhook Error]:', err);
    return NextResponse.json({ error: errorMessage(err) || 'Internal Server Error' }, { status: 500 });
  }
}
