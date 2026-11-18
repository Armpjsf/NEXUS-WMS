import {
  getOutboxEventsForTenant,
  requeueDeadLetterEvents,
  redactSensitiveError,
  type IntegrationOutboxInboxStore,
  type SupabaseOutboxInboxRepository,
  type OutboxDbClient,
} from '@/lib/integrationOutboxInbox';

export type DriftType = 'missing_in_target' | 'status_mismatch' | 'amount_mismatch' | 'unmapped_identity';

export interface ReconciliationDriftItem {
  id: string;
  driftType: DriftType;
  sourceStatus?: string | null;
  localStatus?: string | null;
  sourceAmountMinor?: number | null;
  localAmountMinor?: number | null;
  authoritative?: boolean;
}

export class IntegrationOpsError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = 'INTEGRATION_OPS_ERROR', status = 400) {
    super(message);
    this.name = 'IntegrationOpsError';
    this.code = code;
    this.status = status;
  }
}

const opsAuditTrail: Array<Record<string, unknown>> = [];
const unmappedItemsByTenant = new Map<string, Set<string>>();

function resolveTenantId(ctx: { tenantId?: string; orgId?: string }): string {
  const tid = String(ctx?.tenantId || ctx?.orgId || '').trim();
  if (!tid) throw new IntegrationOpsError('Tenant context is required', 'TENANT_REQUIRED', 401);
  return tid;
}

function assertOpsAdminPermission(ctx: { role?: string; userId?: string }, actorId?: string): void {
  const role = String(ctx?.role || '').toLowerCase();
  const allowed = role === 'admin' || role === 'super_admin' || role === 'super admin' || role === 'manager';
  if (!allowed && ctx?.role !== undefined) {
    throw new IntegrationOpsError('Forbidden: insufficient permission for integration ops action', 'FORBIDDEN', 403);
  }
  if (!String(actorId || ctx?.userId || '').trim()) {
    throw new IntegrationOpsError('actorId is required for audited integration ops action', 'ACTOR_REQUIRED', 400);
  }
}

export function recordUnmappedReviewItem(tenantId: string, itemId: string): void {
  const tid = String(tenantId || '').trim();
  if (!tid || !itemId) return;
  if (!unmappedItemsByTenant.has(tid)) unmappedItemsByTenant.set(tid, new Set());
  unmappedItemsByTenant.get(tid)!.add(String(itemId));
}

export function clearIntegrationOpsForTests(): void {
  opsAuditTrail.length = 0;
  unmappedItemsByTenant.clear();
}

export function getIntegrationOpsAuditLog(tenantId: string) {
  return opsAuditTrail.filter((e) => e.tenantId === tenantId);
}

export async function getIntegrationOperationsSummary(
  tenantContext: { tenantId?: string; orgId?: string },
  options: { store?: IntegrationOutboxInboxStore; database?: SupabaseOutboxInboxRepository | OutboxDbClient; unmappedCount?: number; configured?: boolean } = {},
) {
  const tenantId = resolveTenantId(tenantContext);
  const events = options.store
    ? getOutboxEventsForTenant(tenantId, options.store)
    : await getOutboxEventsForTenant(tenantId, options.database);

  let pendingOutboxCount = 0;
  let failedPermanentCount = 0;
  let deadLetterCount = 0;
  let lastSuccessfulSyncAt: string | null = null;
  const recentErrors: Array<Record<string, unknown>> = [];

  for (const ev of events) {
    if (ev.status === 'pending' || ev.status === 'processing') pendingOutboxCount++;
    else if (ev.status === 'failed_permanent') failedPermanentCount++;
    else if (ev.status === 'dead_letter') deadLetterCount++;

    if (ev.deliveredAt) {
      const iso = new Date(ev.deliveredAt).toISOString();
      if (!lastSuccessfulSyncAt || iso > lastSuccessfulSyncAt) {
        lastSuccessfulSyncAt = iso;
      }
    }

    if (ev.lastErrorRedacted) {
      recentErrors.push({
        eventId: ev.eventId,
        eventType: ev.eventType,
        status: ev.status,
        attemptCount: ev.attemptCount,
        error: redactSensitiveError(ev.lastErrorRedacted),
      });
    }
  }

  const unmappedCount = Number(options.unmappedCount ?? (unmappedItemsByTenant.get(tenantId)?.size || 0));
  const isConfigured =
    options.configured !== undefined
      ? Boolean(options.configured)
      : Boolean(process.env.TMS_API_URL && process.env.TMS_API_KEY) || events.length > 0;

  let connectionStatus: 'connected' | 'disconnected' | 'degraded' = 'connected';
  if (!isConfigured) {
    connectionStatus = 'disconnected';
  } else if (deadLetterCount > 0 || failedPermanentCount > 0 || unmappedCount > 0) {
    connectionStatus = 'degraded';
  }

  return {
    tenantId,
    connectionStatus,
    lastSuccessfulSyncAt,
    pendingOutboxCount,
    failedPermanentCount,
    deadLetterCount,
    unmappedCount,
    recentErrors: recentErrors.slice(-10),
  };
}

export async function retryDeadLetterEvents(
  tenantContext: { tenantId?: string; orgId?: string; role?: string; userId?: string },
  params: { eventIds?: string[]; actorId: string },
  options: { store?: IntegrationOutboxInboxStore; database?: SupabaseOutboxInboxRepository | OutboxDbClient } = {},
) {
  const tenantId = resolveTenantId(tenantContext);
  const actor = String(params.actorId || tenantContext?.userId || '').trim();
  assertOpsAdminPermission(tenantContext, actor);

  const res = options.store
    ? requeueDeadLetterEvents({ tenantId, eventIds: params.eventIds, actorId: actor }, options.store)
    : await requeueDeadLetterEvents({ tenantId, eventIds: params.eventIds, actorId: actor }, options.database);

  opsAuditTrail.push({
    tenantId,
    action: 'retry_dead_letter',
    actorId: actor,
    eventIds: res.requeued,
    at: new Date().toISOString(),
  });

  return res;
}

export function runDryRunReconciliation(
  tenantContext: { tenantId?: string; orgId?: string },
  params: { sourceItems: Array<Record<string, any>>; localItems: Array<Record<string, any>> },
) {
  const tenantId = resolveTenantId(tenantContext);
  const localById = new Map<string, Record<string, any>>();
  for (const item of params.localItems || []) {
    if (item.tenantId && item.tenantId !== tenantId) continue;
    if (item.orgId && item.orgId !== tenantId) continue;
    const key = String(item.id || item.externalId || item.orderNo || '').trim();
    if (key) localById.set(key, item);
  }

  const drifts: ReconciliationDriftItem[] = [];
  for (const src of params.sourceItems || []) {
    if (src.tenantId && src.tenantId !== tenantId) continue;
    if (src.orgId && src.orgId !== tenantId) continue;
    const id = String(src.id || src.externalId || src.orderNo || '').trim();
    if (!id) continue;

    if (src.unmapped === true || (!src.mappedIdentity && src.requiresIdentityMapping)) {
      drifts.push({
        id,
        driftType: 'unmapped_identity',
        sourceStatus: src.status ?? null,
        localStatus: null,
        sourceAmountMinor: src.amountMinor ?? null,
        localAmountMinor: null,
        authoritative: Boolean(src.authoritative),
      });
      continue;
    }

    const local = localById.get(id);
    if (!local) {
      drifts.push({
        id,
        driftType: 'missing_in_target',
        sourceStatus: src.status ?? null,
        localStatus: null,
        sourceAmountMinor: src.amountMinor ?? null,
        localAmountMinor: null,
        authoritative: Boolean(src.authoritative),
      });
      continue;
    }

    if (src.status && local.status && String(src.status) !== String(local.status)) {
      drifts.push({
        id,
        driftType: 'status_mismatch',
        sourceStatus: src.status,
        localStatus: local.status,
        authoritative: Boolean(local.authoritative || src.authoritative),
      });
    }

    if (
      src.amountMinor !== undefined &&
      local.amountMinor !== undefined &&
      Number(src.amountMinor) !== Number(local.amountMinor)
    ) {
      drifts.push({
        id,
        driftType: 'amount_mismatch',
        sourceAmountMinor: Number(src.amountMinor),
        localAmountMinor: Number(local.amountMinor),
        authoritative: Boolean(local.authoritative || src.authoritative),
      });
    }
  }

  return {
    dryRun: true as const,
    tenantId,
    totalChecked: (params.sourceItems || []).length,
    driftCount: drifts.length,
    drifts,
  };
}

export async function applyReconciliationRepair(
  tenantContext: { tenantId?: string; orgId?: string; role?: string; userId?: string },
  params: {
    approvedIds: string[];
    actorId: string;
    drifts: ReconciliationDriftItem[];
    applyRepairFn?: (drift: ReconciliationDriftItem) => Promise<void> | void;
  },
) {
  const tenantId = resolveTenantId(tenantContext);
  const actor = String(params.actorId || tenantContext?.userId || '').trim();
  assertOpsAdminPermission(tenantContext, actor);

  const approvedSet = new Set((params.approvedIds || []).map((x) => String(x).trim()).filter(Boolean));
  if (approvedSet.size === 0) {
    throw new IntegrationOpsError('Explicit approvedIds are required before repairing drift', 'APPROVAL_REQUIRED', 400);
  }

  const repaired: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const drift of params.drifts || []) {
    if (!approvedSet.has(String(drift.id))) {
      skipped.push({ id: drift.id, reason: 'not_approved' });
      continue;
    }
    if (drift.authoritative) {
      skipped.push({ id: drift.id, reason: 'authoritative_record_protected' });
      continue;
    }
    if (typeof params.applyRepairFn === 'function') {
      await params.applyRepairFn(drift);
    }
    repaired.push(drift.id);
  }

  opsAuditTrail.push({
    tenantId,
    action: 'reconciliation_repair',
    actorId: actor,
    repaired,
    skipped,
    at: new Date().toISOString(),
  });

  return {
    dryRun: false as const,
    tenantId,
    repaired,
    skipped,
    actorId: actor,
  };
}
