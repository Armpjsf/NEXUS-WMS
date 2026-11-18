import { getServiceSupabase } from '@/lib/supabase';
import { requireTenantContext, type TrustedTenantContext } from '@/lib/tenantContext';
import { getPlanLimits, type PlanLimits } from '@/lib/planLimits';

export type ModuleName = 'hr' | 'wms' | 'tms';
export type PackageCombination =
  | 'HR_ONLY'
  | 'WMS_ONLY'
  | 'TMS_ONLY'
  | 'HR_WMS'
  | 'HR_TMS'
  | 'WMS_TMS'
  | 'FULL_SUITE';
export type LifecycleState = 'trial' | 'active' | 'grace' | 'suspended' | 'cancelled';
export type OperationType = 'read' | 'create' | 'write' | 'drain_in_flight' | 'export' | 'integration' | 'reconcile';

export const MODULES: readonly ModuleName[] = ['hr', 'wms', 'tms'];

export const PACKAGE_COMBINATIONS: Record<PackageCombination, ModuleName[]> = {
  HR_ONLY: ['hr'],
  WMS_ONLY: ['wms'],
  TMS_ONLY: ['tms'],
  HR_WMS: ['hr', 'wms'],
  HR_TMS: ['hr', 'tms'],
  WMS_TMS: ['wms', 'tms'],
  FULL_SUITE: ['hr', 'wms', 'tms'],
};

export const LIFECYCLE_STATES: readonly LifecycleState[] = [
  'trial',
  'active',
  'grace',
  'suspended',
  'cancelled',
];

export const DEFAULT_MAX_CACHE_TTL_MS = 5 * 60 * 1000;

export class EntitlementError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = 'MODULE_NOT_SUBSCRIBED', status = 403) {
    super(message);
    this.name = 'EntitlementError';
    this.code = code;
    this.status = status;
  }
}

export interface TenantEntitlement {
  tenantId: string;
  packageCode: PackageCombination | 'CUSTOM';
  modules: ModuleName[];
  state: LifecycleState;
  endsAt: string | null;
  graceDays: number;
  features: Record<string, boolean>;
  quotas: Record<string, number>;
  verifiedAt: number;
  maxCacheTtlMs: number;
}

export interface EntitlementInput {
  packageCode?: PackageCombination | 'CUSTOM';
  modules?: ModuleName[];
  state?: LifecycleState;
  endsAt?: string | null;
  graceDays?: number;
  features?: Record<string, boolean>;
  quotas?: Record<string, number>;
  verifiedAt?: number;
  maxCacheTtlMs?: number;
}

const testEntitlements = new Map<string, TenantEntitlement>();
const entitlementCache = new Map<string, TenantEntitlement>();
const quotaLocks = new Map<string, Promise<void>>();
const quotaReservations = new Map<string, number>();
const recordedUsageEvents = new Map<string, {
  tenantId: string;
  module: ModuleName;
  resource: string;
  eventId: string;
  delta: number;
  recordedAt: string;
}>();

function resolveTenantId(contextOrTenantId?: string | { tenantId?: string; orgId?: string }): string {
  if (typeof contextOrTenantId === 'string' && contextOrTenantId.trim()) {
    return contextOrTenantId.trim();
  }
  if (contextOrTenantId && typeof contextOrTenantId === 'object') {
    const candidate = contextOrTenantId.tenantId || contextOrTenantId.orgId;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return process.env.WMS_DEFAULT_ORG_ID?.trim() || 'default-tenant';
}

function normalizeModules(input?: ModuleName[], packageCode?: PackageCombination): ModuleName[] {
  if (Array.isArray(input) && input.length > 0) {
    return [...new Set(input.map((m) => String(m).toLowerCase() as ModuleName).filter((m) => MODULES.includes(m)))];
  }
  if (packageCode && PACKAGE_COMBINATIONS[packageCode]) {
    return [...PACKAGE_COMBINATIONS[packageCode]];
  }
  return [...PACKAGE_COMBINATIONS.FULL_SUITE];
}

function inferPackageCode(modules: ModuleName[]): PackageCombination | 'CUSTOM' {
  const sorted = [...new Set(modules)].sort().join(',');
  for (const [code, list] of Object.entries(PACKAGE_COMBINATIONS) as Array<[PackageCombination, ModuleName[]]>) {
    if ([...list].sort().join(',') === sorted) return code;
  }
  return 'CUSTOM';
}

function evaluateLifecycleState(
  rawState: string | undefined,
  endsAt: string | null | undefined,
  graceDays = 7,
  nowMs = Date.now(),
): LifecycleState {
  const baseState: LifecycleState = LIFECYCLE_STATES.includes(rawState as LifecycleState)
    ? (rawState as LifecycleState)
    : 'active';
  if ((baseState === 'active' || baseState === 'trial') && endsAt) {
    const endMs = new Date(endsAt).getTime();
    if (Number.isFinite(endMs) && nowMs > endMs) {
      const graceMs = Math.max(0, Number(graceDays) || 0) * 86_400_000;
      return nowMs <= endMs + graceMs ? 'grace' : 'suspended';
    }
  }
  return baseState;
}

function buildRecord(tenantId: string, raw: EntitlementInput = {}, nowMs = Date.now()): TenantEntitlement {
  const pkg = raw.packageCode && raw.packageCode !== 'CUSTOM' && PACKAGE_COMBINATIONS[raw.packageCode]
    ? raw.packageCode
    : (raw.modules ? undefined : 'FULL_SUITE');
  const modules = normalizeModules(raw.modules, pkg);
  const graceDays = raw.graceDays ?? 7;
  const endsAt = raw.endsAt || null;
  const state = evaluateLifecycleState(raw.state, endsAt, graceDays, nowMs);
  return {
    tenantId,
    packageCode: pkg || inferPackageCode(modules),
    modules,
    state,
    endsAt,
    graceDays,
    features: raw.features ? { ...raw.features } : {},
    quotas: raw.quotas ? { ...raw.quotas } : {},
    verifiedAt: Number(raw.verifiedAt) || nowMs,
    maxCacheTtlMs: Number(raw.maxCacheTtlMs) || DEFAULT_MAX_CACHE_TTL_MS,
  };
}

function readEnvEntitlement(tenantId: string): EntitlementInput | null {
  const jsonStr = process.env.WMS_ENTITLEMENT_JSON;
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') {
        if (parsed[tenantId]) return parsed[tenantId];
        if (!parsed.tenantId || parsed.tenantId === tenantId) return parsed;
      }
    } catch {
      // ignore invalid json
    }
  }
  const pkg = process.env.WMS_PACKAGE?.trim() as PackageCombination | undefined;
  if (pkg && PACKAGE_COMBINATIONS[pkg]) {
    return { packageCode: pkg, modules: PACKAGE_COMBINATIONS[pkg], state: 'active' };
  }
  return null;
}

function isUndefinedFunctionError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return code === '42883' || code === 'PGRST202' || /does not exist|could not find/i.test(msg);
}

function unwrapRpcResult(data: any, fnName: string): any {
  const first = Array.isArray(data) ? data[0] : data;
  if (first && typeof first === 'object' && fnName in first) {
    return first[fnName];
  }
  return first;
}

export function setTenantEntitlementForTests(tenantId: string, entitlement: EntitlementInput | null): TenantEntitlement | null {
  const key = resolveTenantId(tenantId);
  if (!entitlement) {
    testEntitlements.delete(key);
    entitlementCache.delete(key);
    return null;
  }
  const rec = buildRecord(key, entitlement);
  testEntitlements.set(key, rec);
  entitlementCache.set(key, rec);
  return rec;
}

export function clearEntitlementsForTests(): void {
  testEntitlements.clear();
  entitlementCache.clear();
  quotaLocks.clear();
  quotaReservations.clear();
  recordedUsageEvents.clear();
}

export function resetEntitlementUsageForTests(): void {
  quotaReservations.clear();
  recordedUsageEvents.clear();
}

export async function getEntitlements(
  context?: string | { tenantId?: string; orgId?: string },
  options: {
    now?: number | (() => number);
    maxCacheTtlMs?: number;
    useCacheOnly?: boolean;
    forceRefresh?: boolean;
    database?: ReturnType<typeof getServiceSupabase> | null;
  } = {},
): Promise<TenantEntitlement> {
  const tenantId = resolveTenantId(context);
  const nowMs = typeof options.now === 'function' ? options.now() : (Number(options.now) || Date.now());
  const maxCacheTtlMs = Number(options.maxCacheTtlMs) || DEFAULT_MAX_CACHE_TTL_MS;

  if (testEntitlements.has(tenantId)) {
    return buildRecord(tenantId, testEntitlements.get(tenantId), nowMs);
  }

  if (options.useCacheOnly) {
    const cached = entitlementCache.get(tenantId);
    if (!cached) {
      throw new EntitlementError('No cached entitlement available offline', 'ENTITLEMENT_UNAVAILABLE', 403);
    }
    const ttl = Number(cached.maxCacheTtlMs) || maxCacheTtlMs;
    if (nowMs - cached.verifiedAt > ttl) {
      entitlementCache.delete(tenantId);
      throw new EntitlementError('Offline entitlement cache expired', 'ENTITLEMENT_CACHE_EXPIRED', 403);
    }
    return buildRecord(tenantId, cached, nowMs);
  }

  const cached = entitlementCache.get(tenantId);
  if (cached && nowMs - cached.verifiedAt <= (Number(cached.maxCacheTtlMs) || maxCacheTtlMs) && !options.forceRefresh) {
    return buildRecord(tenantId, cached, nowMs);
  }

  const envEnt = readEnvEntitlement(tenantId);
  if (envEnt) {
    const rec = buildRecord(tenantId, envEnt, nowMs);
    entitlementCache.set(tenantId, rec);
    return rec;
  }

  try {
    const admin = options.database !== undefined ? options.database : getServiceSupabase();
    if (admin && typeof admin.from === 'function') {
      // org-scope-ok: tenant_modules uses tenant_id as its organization/tenant column
      const { data: modRow, error: modErr } = await admin
        .from('tenant_modules')
        .select('package_code, modules, lifecycle_state, ends_at, grace_days')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!modErr && modRow) {
        let features: Record<string, boolean> = {};
        let quotas: Record<string, number> = {};
        // org-scope-ok: tenant_features_limits uses tenant_id column
        const { data: limRow } = await admin
          .from('tenant_features_limits')
          .select('features, quotas')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (limRow) {
          features = (limRow.features as Record<string, boolean>) || {};
          quotas = (limRow.quotas as Record<string, number>) || {};
        }
        const rec = buildRecord(tenantId, {
          packageCode: modRow.package_code as PackageCombination,
          modules: modRow.modules as ModuleName[],
          state: (modRow.lifecycle_state as LifecycleState) || 'active',
          endsAt: modRow.ends_at || null,
          graceDays: modRow.grace_days ?? 7,
          features,
          quotas,
          verifiedAt: nowMs,
        }, nowMs);
        entitlementCache.set(tenantId, rec);
        return rec;
      }

      const { data: orgRow } = await admin
        .from('organizations')
        .select('id, plan, status')
        .eq('id', tenantId)
        .maybeSingle();

      if (orgRow) {
        const limits: PlanLimits = getPlanLimits(orgRow.plan || 'FREE');
        const state: LifecycleState = orgRow.status === 'SUSPENDED'
          ? 'suspended'
          : orgRow.status === 'CANCELLED'
            ? 'cancelled'
            : orgRow.status === 'GRACE'
              ? 'grace'
              : 'active';
        const rec = buildRecord(tenantId, {
          packageCode: 'FULL_SUITE',
          state,
          quotas: {
            products: limits.products,
            users: limits.users,
            branches: limits.branches,
          },
          verifiedAt: nowMs,
        }, nowMs);
        entitlementCache.set(tenantId, rec);
        return rec;
      }
    }
  } catch {
    // ignore missing/mocked DB
  }

  const fallback = buildRecord(tenantId, { packageCode: 'FULL_SUITE', state: 'active', verifiedAt: nowMs }, nowMs);
  entitlementCache.set(tenantId, fallback);
  return fallback;
}

export function isOperationAllowedInState(state: LifecycleState, operationType: OperationType = 'write'): boolean {
  if (state === 'trial' || state === 'active') return true;
  if (state === 'grace') {
    return operationType === 'read' || operationType === 'drain_in_flight' || operationType === 'export' || operationType === 'reconcile';
  }
  if (state === 'suspended' || state === 'cancelled') {
    return operationType === 'read' || operationType === 'export';
  }
  return false;
}

export async function requireModule(
  context: string | { tenantId?: string; orgId?: string },
  moduleName: ModuleName,
  operationType: OperationType = 'write',
  options: { now?: number | (() => number); useCacheOnly?: boolean; forceRefresh?: boolean; database?: ReturnType<typeof getServiceSupabase> | null } = {},
): Promise<TenantEntitlement> {
  const ent = await getEntitlements(context, options);
  if (!ent.modules.includes(moduleName)) {
    throw new EntitlementError(
      `Module '${moduleName}' is not included in package '${ent.packageCode}'`,
      'MODULE_NOT_SUBSCRIBED',
      403,
    );
  }
  if (!isOperationAllowedInState(ent.state, operationType)) {
    const code = ent.state === 'grace'
      ? 'MODULE_IN_GRACE_DRAIN'
      : ent.state === 'cancelled'
        ? 'MODULE_CANCELLED'
        : 'MODULE_SUSPENDED';
    throw new EntitlementError(
      `Operation '${operationType}' is blocked while module '${moduleName}' is in '${ent.state}' state`,
      code,
      403,
    );
  }
  return ent;
}

export async function requireFeature(
  context: string | { tenantId?: string; orgId?: string },
  featureKey: string,
): Promise<TenantEntitlement> {
  const ent = await getEntitlements(context);
  if (ent.features?.[featureKey] === false) {
    throw new EntitlementError(`Feature '${featureKey}' is not enabled for tenant`, 'FEATURE_NOT_ENABLED', 403);
  }
  return ent;
}

async function withQuotaLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = quotaLocks.get(lockKey) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  quotaLocks.set(lockKey, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function checkAndReserveQuota(
  context: string | { tenantId?: string; orgId?: string },
  resourceKey: string,
  currentCountFn: () => Promise<number> | number,
  options: {
    module?: ModuleName;
    delta?: number;
    eventId?: string;
    database?: ReturnType<typeof getServiceSupabase> | null;
    allowInMemoryQuotaFallback?: boolean;
    quotaMode?: 'concurrent_resource' | 'cumulative_usage';
    nowIso?: string;
  } = {},
): Promise<{ allowed: boolean; reserved: number; limit: number; deduplicated?: boolean; eventId?: string }> {
  const tenantId = resolveTenantId(context);
  const moduleName = options.module || 'wms';
  const ent = await requireModule(context, moduleName, 'create', { database: options.database });
  const limit = ent.quotas?.[resourceKey];

  if (limit === undefined || limit === null || Number(limit) < 0) {
    return { allowed: true, reserved: 0, limit: -1, deduplicated: false };
  }

  const maxLimit = Number(limit);
  const delta = Math.max(1, Number(options.delta) || 1);
  const eventId = String(
    options.eventId || `quota:${tenantId}:${moduleName}:${resourceKey}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
  ).trim();
  const explicitInMemory = options.database === null || options.allowInMemoryQuotaFallback === true;

  if (explicitInMemory) {
    if (process.env.NODE_ENV === 'production') {
      throw new EntitlementError('In-memory quota fallback is forbidden in production', 'QUOTA_CONFIG_ERROR', 503);
    }
    const lockKey = `${tenantId}:${resourceKey}`;
    return withQuotaLock(lockKey, async () => {
      const baseCount = Number(await currentCountFn());
      const inFlight = quotaReservations.get(lockKey) || 0;
      if (baseCount + inFlight + delta > maxLimit) {
        throw new EntitlementError(
          `Quota exceeded for '${resourceKey}' (limit: ${maxLimit})`,
          'QUOTA_EXCEEDED',
          403,
        );
      }
      quotaReservations.set(lockKey, inFlight + delta);
      if (options.eventId) {
        recordUsageEvent({
          tenantId,
          module: moduleName,
          resource: resourceKey,
          eventId: options.eventId,
          delta,
        });
      }
      return { allowed: true, reserved: inFlight + delta, limit: maxLimit, deduplicated: false, eventId };
    });
  }

  const db = options.database !== undefined ? options.database : getServiceSupabase();
  if (!db || typeof db.rpc !== 'function') {
    throw new EntitlementError(
      'Quota reservation schema/RPC unavailable: database client missing rpc()',
      'QUOTA_SCHEMA_MISSING',
      503,
    );
  }

  const baseCount = Number(await currentCountFn());
  const { data, error } = await db.rpc('reserve_tenant_quota', {
    p_tenant_id: tenantId,
    p_module: moduleName,
    p_resource: resourceKey,
    p_event_id: eventId,
    p_delta: delta,
    p_limit: maxLimit,
    p_base_count: baseCount,
    p_now: options.nowIso || new Date().toISOString(),
    p_quota_mode: options.quotaMode || 'concurrent_resource',
  });

  if (error) {
    if (isUndefinedFunctionError(error)) {
      throw new EntitlementError(
        `Quota reservation schema/RPC unavailable or invalid: ${error.message}`,
        'QUOTA_SCHEMA_MISSING',
        503,
      );
    }
    throw new EntitlementError(`Quota reservation failed: ${error.message}`, 'QUOTA_DB_ERROR', 503);
  }

  const res = data !== null && data !== undefined ? unwrapRpcResult(data, 'reserve_tenant_quota') : null;
  if (!res || typeof res.allowed !== 'boolean') {
    throw new EntitlementError(
      'Quota reservation schema/RPC unavailable or invalid: malformed reserve_tenant_quota response',
      'QUOTA_SCHEMA_MISSING',
      503,
    );
  }

  if (!res.allowed) {
    throw new EntitlementError(
      `Quota exceeded for '${resourceKey}' (limit: ${maxLimit})`,
      res.code || 'QUOTA_EXCEEDED',
      403,
    );
  }

  return {
    allowed: true,
    deduplicated: Boolean(res.deduplicated),
    reserved: Number(res.reserved ?? delta),
    limit: Number(res.limit ?? maxLimit),
    eventId,
  };
}

export async function releaseQuotaReservation(
  contextOrTenantId: string | { tenantId?: string; orgId?: string },
  resourceKey: string,
  deltaOrOptions:
    | number
    | {
        delta?: number;
        module?: ModuleName;
        eventId?: string;
        database?: ReturnType<typeof getServiceSupabase> | null;
        allowInMemoryQuotaFallback?: boolean;
      } = 1,
  maybeOptions: {
    delta?: number;
    module?: ModuleName;
    eventId?: string;
    database?: ReturnType<typeof getServiceSupabase> | null;
    allowInMemoryQuotaFallback?: boolean;
  } = {},
): Promise<void> {
  const tenantId = resolveTenantId(contextOrTenantId);
  const opts = typeof deltaOrOptions === 'object' && deltaOrOptions !== null ? deltaOrOptions : maybeOptions;
  const delta = typeof deltaOrOptions === 'number' ? deltaOrOptions : (opts.delta ?? 1);
  const moduleName = opts.module || 'wms';
  const eventId = opts.eventId ? String(opts.eventId).trim() : '';
  const explicitInMemory = opts.database === null || opts.allowInMemoryQuotaFallback === true;

  if (explicitInMemory) {
    if (process.env.NODE_ENV === 'production') {
      throw new EntitlementError('In-memory quota fallback is forbidden in production', 'QUOTA_CONFIG_ERROR', 503);
    }
    const lockKey = `${tenantId}:${resourceKey}`;
    const current = quotaReservations.get(lockKey) || 0;
    quotaReservations.set(lockKey, Math.max(0, current - Math.max(1, Number(delta) || 1)));
    return;
  }

  const db = opts.database !== undefined ? opts.database : getServiceSupabase();
  if (!db || typeof db.rpc !== 'function') {
    throw new EntitlementError(
      'Quota release schema/RPC unavailable: database client missing rpc()',
      'QUOTA_SCHEMA_MISSING',
      503,
    );
  }

  if (eventId) {
    const { error } = await db.rpc('release_tenant_quota', {
      p_tenant_id: tenantId,
      p_module: moduleName,
      p_resource: resourceKey,
      p_event_id: eventId,
    });
    if (error) {
      if (isUndefinedFunctionError(error)) {
        throw new EntitlementError(
          `Quota release schema/RPC unavailable or invalid: ${error.message}`,
          'QUOTA_SCHEMA_MISSING',
          503,
        );
      }
      throw new EntitlementError(`Failed to release quota reservation: ${error.message}`, 'QUOTA_DB_ERROR', 503);
    }
  }
}

export async function commitQuotaReservation(
  contextOrTenantId: string | { tenantId?: string; orgId?: string },
  resourceKey: string,
  options: {
    module?: ModuleName;
    eventId?: string;
    delta?: number;
    database?: ReturnType<typeof getServiceSupabase> | null;
    allowInMemoryQuotaFallback?: boolean;
  } = {},
): Promise<void> {
  const tenantId = resolveTenantId(contextOrTenantId);
  const moduleName = options.module || 'wms';
  const eventId = options.eventId ? String(options.eventId).trim() : '';
  const explicitInMemory = options.database === null || options.allowInMemoryQuotaFallback === true;

  if (explicitInMemory) {
    if (process.env.NODE_ENV === 'production') {
      throw new EntitlementError('In-memory quota fallback is forbidden in production', 'QUOTA_CONFIG_ERROR', 503);
    }
    const lockKey = `${tenantId}:${resourceKey}`;
    const current = quotaReservations.get(lockKey) || 0;
    const delta = Math.max(1, Number(options.delta) || 1);
    quotaReservations.set(lockKey, Math.max(0, current - delta));
    return;
  }

  const db = options.database !== undefined ? options.database : getServiceSupabase();
  if (!db || typeof db.rpc !== 'function') {
    throw new EntitlementError(
      'Quota commit schema/RPC unavailable: database client missing rpc()',
      'QUOTA_SCHEMA_MISSING',
      503,
    );
  }

  if (eventId) {
    const { error } = await db.rpc('commit_tenant_quota', {
      p_tenant_id: tenantId,
      p_module: moduleName,
      p_resource: resourceKey,
      p_event_id: eventId,
    });
    if (error) {
      if (isUndefinedFunctionError(error)) {
        throw new EntitlementError(
          `Quota commit schema/RPC unavailable or invalid: ${error.message}`,
          'QUOTA_SCHEMA_MISSING',
          503,
        );
      }
      throw new EntitlementError(`Failed to commit quota reservation: ${error.message}`, 'QUOTA_DB_ERROR', 503);
    }
  }
}

export function recordUsageEvent(params: {
  tenantId: string;
  module: ModuleName;
  resource: string;
  eventId: string;
  delta?: number;
}) {
  const tId = resolveTenantId(params.tenantId);
  const dedupKey = `${tId}:${params.eventId}`;
  if (recordedUsageEvents.has(dedupKey)) {
    return { deduplicated: true, event: recordedUsageEvents.get(dedupKey)! };
  }
  const event = {
    tenantId: tId,
    module: params.module,
    resource: params.resource,
    eventId: params.eventId,
    delta: params.delta ?? 1,
    recordedAt: new Date().toISOString(),
  };
  recordedUsageEvents.set(dedupKey, event);
  return { deduplicated: false, event };
}

export function getRecordedUsageEventsForTests(tenantId: string) {
  const tId = resolveTenantId(tenantId);
  return [...recordedUsageEvents.values()].filter((e) => e.tenantId === tId);
}

export async function requireEntitlementScope(
  moduleName: ModuleName,
  operationType: OperationType = 'write',
): Promise<{ ctx: TrustedTenantContext; ent: TenantEntitlement }> {
  const ctx = await requireTenantContext();
  const ent = await requireModule(ctx, moduleName, operationType);
  return { ctx, ent };
}
