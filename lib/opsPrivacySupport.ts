import { createHash, randomBytes } from 'node:crypto';

export const MAX_SUPPORT_TTL_MINUTES = 60;
export const MIN_SUPPORT_REASON_LENGTH = 10;

const SENSITIVE_AUDIT_KEYS_RE =
  /^(password|password_hash|passwordHash|secret|webhook_secret|webhookSecret|api_key|apiKey|token|access_token|refresh_token|salary|base_salary|net_pay|bank_account|bankAccountNo|national_id|tax_id)$/i;

export class OpsSupportError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = 'OPS_SUPPORT_ERROR', status = 403) {
    super(message);
    this.name = 'OpsSupportError';
    this.code = code;
    this.status = status;
  }
}

interface SupportTokenRecord {
  tokenHash: string;
  tenantId: string;
  supportActorId: string;
  reason: string;
  ttlMinutes: number;
  correlationId: string;
  expiresAtMs: number;
  expiresAt: string;
  revoked: boolean;
}

export interface ImmutableAuditEntry {
  tenantId: string;
  actorId: string;
  action: string;
  supportAccess: boolean;
  reason?: string;
  correlationId?: string;
  expiresAt?: string;
  recordedAt: string;
  [key: string]: unknown;
}

const supportTokens = new Map<string, SupportTokenRecord>();
const immutableAuditLog: ImmutableAuditEntry[] = [];

export function clearOpsPrivacySupportForTests(): void {
  supportTokens.clear();
  immutableAuditLog.length = 0;
}

export function getImmutableAuditLog(tenantId?: string): ImmutableAuditEntry[] {
  const list = tenantId
    ? immutableAuditLog.filter((e) => e.tenantId === tenantId)
    : immutableAuditLog;
  return list.map((e) => ({ ...e }));
}

export function redactAuditEvent<T>(event: T): T {
  if (Array.isArray(event)) {
    return event.map((item) => redactAuditEvent(item)) as unknown as T;
  }
  if (event && typeof event === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(event as Record<string, unknown>)) {
      if (SENSITIVE_AUDIT_KEYS_RE.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactAuditEvent(v);
      }
    }
    return out as T;
  }
  return event;
}

function recordImmutableAudit(entry: Omit<ImmutableAuditEntry, 'recordedAt'> & { recordedAt?: string }): ImmutableAuditEntry {
  const frozen = Object.freeze(
    redactAuditEvent({
      ...entry,
      recordedAt: entry.recordedAt || new Date().toISOString(),
    }) as ImmutableAuditEntry,
  );
  immutableAuditLog.push(frozen);
  return frozen;
}

export function grantSupportAccessToken(params: {
  tenantId: string;
  supportActorId: string;
  reason: string;
  ttlMinutes?: number;
  nowMs?: number;
}) {
  const scopedTenant = String(params.tenantId || '').trim();
  const actor = String(params.supportActorId || '').trim();
  const cleanReason = String(params.reason || '').trim();
  const ttl = Number(params.ttlMinutes ?? 30);
  const nowMs = params.nowMs ?? Date.now();

  if (!scopedTenant || !actor) {
    throw new OpsSupportError('tenantId and supportActorId are required', 'INVALID_SUPPORT_REQUEST', 400);
  }
  if (cleanReason.length < MIN_SUPPORT_REASON_LENGTH) {
    throw new OpsSupportError(
      `Support access reason must be at least ${MIN_SUPPORT_REASON_LENGTH} characters`,
      'SUPPORT_REASON_REQUIRED',
      400,
    );
  }
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > MAX_SUPPORT_TTL_MINUTES) {
    throw new OpsSupportError(
      `Support access ttlMinutes must be between 1 and ${MAX_SUPPORT_TTL_MINUTES}`,
      'SUPPORT_TTL_OUT_OF_BOUNDS',
      400,
    );
  }

  const token = `sup_${randomBytes(18).toString('hex')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const correlationId = `corr_${randomBytes(8).toString('hex')}`;
  const expiresAtMs = nowMs + ttl * 60 * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();

  supportTokens.set(tokenHash, {
    tokenHash,
    tenantId: scopedTenant,
    supportActorId: actor,
    reason: cleanReason,
    ttlMinutes: ttl,
    correlationId,
    expiresAtMs,
    expiresAt,
    revoked: false,
  });

  recordImmutableAudit({
    tenantId: scopedTenant,
    actorId: actor,
    action: 'SUPPORT_ACCESS_GRANTED',
    supportAccess: true,
    reason: cleanReason,
    correlationId,
    expiresAt,
  });

  return {
    token,
    tenantId: scopedTenant,
    supportActorId: actor,
    reason: cleanReason,
    ttlMinutes: ttl,
    correlationId,
    expiresAt,
    expiresAtMs,
  };
}

export function verifySupportAccess(
  token: string,
  options: { tenantId: string; action?: string; nowMs?: number },
) {
  const rawToken = String(token || '').trim();
  const expectedTenant = String(options?.tenantId || '').trim();
  const nowMs = options?.nowMs ?? Date.now();

  if (!rawToken || !expectedTenant) {
    throw new OpsSupportError('Support token and tenantId are required', 'SUPPORT_TOKEN_MISSING', 401);
  }

  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const record = supportTokens.get(tokenHash);
  if (!record) {
    throw new OpsSupportError('Invalid support access token', 'SUPPORT_TOKEN_INVALID', 403);
  }
  if (record.revoked) {
    throw new OpsSupportError('Support access token has been revoked', 'SUPPORT_TOKEN_REVOKED', 403);
  }
  if (record.tenantId !== expectedTenant) {
    throw new OpsSupportError('Support access token is not valid for this tenant', 'SUPPORT_TENANT_MISMATCH', 403);
  }
  if (nowMs >= record.expiresAtMs) {
    throw new OpsSupportError('Support access token has expired', 'SUPPORT_TOKEN_EXPIRED', 403);
  }

  const auditEvent = recordImmutableAudit({
    tenantId: record.tenantId,
    actorId: record.supportActorId,
    action: options.action || 'SUPPORT_READ',
    supportAccess: true,
    reason: record.reason,
    correlationId: record.correlationId,
    expiresAt: record.expiresAt,
  });

  return {
    authorized: true,
    tenantId: record.tenantId,
    supportActorId: record.supportActorId,
    supportAccess: true,
    reason: record.reason,
    correlationId: record.correlationId,
    auditEvent,
  };
}

export function revokeSupportAccessToken(token: string, actorId = 'platform_admin'): boolean {
  const tokenHash = createHash('sha256').update(String(token || '').trim()).digest('hex');
  const record = supportTokens.get(tokenHash);
  if (!record) return false;
  record.revoked = true;
  recordImmutableAudit({
    tenantId: record.tenantId,
    actorId,
    action: 'SUPPORT_ACCESS_REVOKED',
    supportAccess: true,
    reason: record.reason,
    correlationId: record.correlationId,
  });
  return true;
}

export interface TenantExitStore {
  businessRecords?: Array<Record<string, unknown>>;
  documentSnapshots?: Array<Record<string, unknown>>;
  statutoryDocuments?: Array<Record<string, unknown>>;
  integrationCredentials?: Array<Record<string, unknown>>;
  pushSubscriptions?: Array<Record<string, unknown>>;
  tenantLifecycle?: Record<string, unknown>;
}

export function initiateTenantExitExport(params: {
  tenantId: string;
  actorId: string;
  reason?: string;
  retentionYears?: number;
  store?: TenantExitStore;
}) {
  const scopedTenant = String(params.tenantId || '').trim();
  const actor = String(params.actorId || '').trim();
  const reason = params.reason || 'Customer contract termination';
  const retentionYears = params.retentionYears ?? 7;

  if (!scopedTenant || !actor) {
    throw new OpsSupportError('tenantId and actorId are required for tenant exit', 'INVALID_EXIT_REQUEST', 400);
  }

  const target = params.store || {};
  const matchesTenant = (row: Record<string, unknown>) =>
    row.tenantId === scopedTenant || row.orgId === scopedTenant;

  const businessRecords = (target.businessRecords || []).filter(matchesTenant);
  const documentSnapshots = (target.documentSnapshots || []).filter(matchesTenant);
  const statutoryDocuments = (target.statutoryDocuments || []).filter(matchesTenant);

  let revokedCredentialsCount = 0;
  for (const cred of target.integrationCredentials || []) {
    if (matchesTenant(cred)) {
      cred.status = 'revoked';
      cred.revokedAt = new Date().toISOString();
      revokedCredentialsCount++;
    }
  }

  let disabledPushCount = 0;
  for (const sub of target.pushSubscriptions || []) {
    if (matchesTenant(sub)) {
      sub.active = false;
      sub.quarantined = true;
      disabledPushCount++;
    }
  }

  const retentionUntil = new Date(Date.now() + retentionYears * 365 * 24 * 60 * 60 * 1000).toISOString();
  for (const doc of statutoryDocuments) {
    doc.retentionLocked = true;
    doc.retentionUntil = retentionUntil;
  }

  if (target.tenantLifecycle) {
    target.tenantLifecycle.state = 'cancelled';
    target.tenantLifecycle.exitStatus = 'archived_pending_retention';
    target.tenantLifecycle.archivedAt = new Date().toISOString();
    target.tenantLifecycle.retentionUntil = retentionUntil;
  }

  const exportPayload = {
    format: 'nexus-tenant-exit-export-v1',
    tenantId: scopedTenant,
    exportedAt: new Date().toISOString(),
    businessRecords: redactAuditEvent(businessRecords),
    documentSnapshots,
    statutoryDocumentsCount: statutoryDocuments.length,
  };
  const manifestChecksum = createHash('sha256').update(JSON.stringify(exportPayload)).digest('hex');

  const correlationId = `exit_${randomBytes(8).toString('hex')}`;
  recordImmutableAudit({
    tenantId: scopedTenant,
    actorId: actor,
    action: 'TENANT_EXIT_EXPORT_INITIATED',
    supportAccess: false,
    reason,
    correlationId,
    revokedCredentialsCount,
    disabledPushCount,
    retainedStatutoryDocs: statutoryDocuments.length,
  });

  return {
    ok: true,
    tenantId: scopedTenant,
    lifecycleState: 'cancelled' as const,
    exitStatus: 'archived_pending_retention' as const,
    revokedCredentialsCount,
    disabledPushCount,
    retainedStatutoryDocumentsCount: statutoryDocuments.length,
    autoDeletedStatutoryDocuments: false,
    retentionUntil,
    manifestChecksum,
    exportPayload,
  };
}
