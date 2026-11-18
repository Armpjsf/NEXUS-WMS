import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { sharedDb, makeIndependentClient, defaultClient } = vi.hoisted(() => {
  const db = {
    inbox: [] as Array<Record<string, any>>,
    effectReceipts: [] as Array<Record<string, any>>,
    outboundOrders: [] as Array<Record<string, any>>,
    returnOrders: [] as Array<Record<string, any>>,
    auditLog: [] as Array<Record<string, any>>,
    tenantModules: [] as Array<Record<string, any>>,
    tenantFeaturesLimits: [] as Array<Record<string, any>>,
    quotaReservations: [] as Array<Record<string, any>>,
    appUsers: [] as Array<Record<string, any>>,
    orgMemberships: [] as Array<Record<string, any>>,
    branches: [] as Array<Record<string, any>>,
    products: [] as Array<Record<string, any>>,
    rpcFaultMode: null as null | '42883' | 'PGRST202' | 'malformed',
    failNextInsertTable: null as null | string,
    enableAtomicWmsRpc: false,
    atomicWmsFault: null as null | '42883' | 'PGRST202' | '42P01' | 'malformed' | 'null' | 'empty_array' | 'invalid_shape',
  };

  function createClient() {
    function makeBuilder(table: string) {
      const filters: Array<{ op: string; col: string; val: unknown }> = [];
      let pendingInsert: any[] | null = null;
      let pendingUpsert: { rows: any[]; onConflict?: string } | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;
      let isDelete = false;
      let isHead = false;
      let orderCol: string | null = null;
      let orderAsc = true;
      let maxRows: number | null = null;

      const getRows = () => {
        if (table === 'integration_inbox') return db.inbox;
        if (table === 'integration_effect_receipts') return db.effectReceipts;
        if (table === 'outbound_orders') return db.outboundOrders;
        if (table === 'return_orders') return db.returnOrders;
        if (table === 'audit_log') return db.auditLog;
        if (table === 'tenant_modules') return db.tenantModules;
        if (table === 'tenant_features_limits') return db.tenantFeaturesLimits;
        if (table === 'quota_reservations') return db.quotaReservations;
        if (table === 'app_users') return db.appUsers;
        if (table === 'org_memberships') return db.orgMemberships;
        if (table === 'branches') return db.branches;
        if (table === 'products') return db.products;
        return [];
      };

      const applyFilters = (rows: any[]) =>
        rows.filter((row) =>
          filters.every((f) => {
            if (f.op === 'eq') return row[f.col] === f.val;
            if (f.op === 'neq') return row[f.col] !== f.val;
            if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(row[f.col]);
            return true;
          }),
        );

      const execute = async () => {
        const rows = getRows();
        if (pendingInsert) {
          if (db.failNextInsertTable === table) {
            db.failNextInsertTable = null;
            return { data: null, error: { message: 'Simulated insert failure' } };
          }
          for (const item of pendingInsert) {
            if (
              table === 'integration_inbox' &&
              rows.some((r) => r.connection_id === item.connection_id && r.event_id === item.event_id)
            ) {
              return { data: null, error: { code: '23505', message: 'duplicate key value' } };
            }
          }
          const inserted = pendingInsert.map((item, idx) => ({
            id: item.id || `${table}-${rows.length + idx + 1}`,
            created_at: item.created_at || new Date().toISOString(),
            ...item,
          }));
          rows.push(...inserted);
          return { data: inserted, error: null };
        }

        if (pendingUpsert) {
          if (db.failNextInsertTable === table) {
            db.failNextInsertTable = null;
            return { data: null, error: { message: 'Simulated upsert failure' } };
          }
          const cols = (pendingUpsert.onConflict || 'id').split(',').map((s) => s.trim());
          const out: any[] = [];
          for (const item of pendingUpsert.rows) {
            const existing = rows.find((r) => cols.every((c) => r[c] === item[c]));
            if (existing) {
              Object.assign(existing, item);
              out.push({ ...existing });
            } else {
              const created = { id: item.id || `${table}-${rows.length + 1}`, ...item };
              rows.push(created);
              out.push({ ...created });
            }
          }
          return { data: out, error: null };
        }

        let matched = applyFilters(rows);
        if (orderCol) {
          matched = [...matched].sort((a, b) => {
            const av = a[orderCol!];
            const bv = b[orderCol!];
            if (av === bv) return 0;
            return (av > bv ? 1 : -1) * (orderAsc ? 1 : -1);
          });
        }
        if (maxRows !== null) matched = matched.slice(0, maxRows);

        if (isDelete) {
          for (let i = rows.length - 1; i >= 0; i--) {
            if (matched.includes(rows[i])) rows.splice(i, 1);
          }
          return { data: matched, error: null };
        }
        if (pendingUpdate) {
          for (const r of matched) Object.assign(r, pendingUpdate);
          return { data: matched.map((r) => ({ ...r })), error: null };
        }
        return {
          data: isHead ? null : matched.map((r) => ({ ...r })),
          error: null,
          count: matched.length,
        };
      };

      const builder: any = {
        select: vi.fn((_cols?: string, opts?: { head?: boolean }) => {
          if (opts?.head) isHead = true;
          return builder;
        }),
        insert: vi.fn((p: any) => {
          pendingInsert = Array.isArray(p) ? p : [p];
          return builder;
        }),
        upsert: vi.fn((p: any, opts?: { onConflict?: string }) => {
          pendingUpsert = { rows: Array.isArray(p) ? p : [p], onConflict: opts?.onConflict };
          return builder;
        }),
        update: vi.fn((p: Record<string, unknown>) => {
          pendingUpdate = p;
          return builder;
        }),
        delete: vi.fn(() => {
          isDelete = true;
          return builder;
        }),
        eq: vi.fn((col: string, val: unknown) => {
          filters.push({ op: 'eq', col, val });
          return builder;
        }),
        neq: vi.fn((col: string, val: unknown) => {
          filters.push({ op: 'neq', col, val });
          return builder;
        }),
        in: vi.fn((col: string, val: unknown[]) => {
          filters.push({ op: 'in', col, val });
          return builder;
        }),
        order: vi.fn((col: string, opts?: { ascending?: boolean }) => {
          orderCol = col;
          orderAsc = opts?.ascending !== false;
          return builder;
        }),
        limit: vi.fn((n: number) => {
          maxRows = n;
          return builder;
        }),
        maybeSingle: vi.fn(async () => {
          const res = await execute();
          return { data: Array.isArray(res.data) ? res.data[0] ?? null : res.data, error: res.error };
        }),
        single: vi.fn(async () => {
          const res = await execute();
          return { data: Array.isArray(res.data) ? res.data[0] ?? null : res.data, error: res.error };
        }),
        then: (resolve: any, reject: any) => execute().then(resolve, reject),
      };
      return builder;
    }

    return {
      from: vi.fn((table: string) => makeBuilder(table)),
      rpc: vi.fn(async (fn: string, args: Record<string, any>) => {
        if (db.rpcFaultMode === '42883') {
          return { data: null, error: { code: '42883', message: `function ${fn} does not exist` } };
        }
        if (db.rpcFaultMode === 'PGRST202') {
          return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${fn} in the schema cache` } };
        }
        if (db.rpcFaultMode === 'malformed') {
          return { data: { unexpected: true }, error: null };
        }

        if (fn === 'reserve_tenant_quota') {
          const existing = db.quotaReservations.find(
            (r) =>
              r.tenant_id === args.p_tenant_id &&
              r.module === args.p_module &&
              r.resource === args.p_resource &&
              r.event_id === args.p_event_id,
          );
          const inFlightReserved = db.quotaReservations
            .filter(
              (r) =>
                r.tenant_id === args.p_tenant_id &&
                r.module === args.p_module &&
                r.resource === args.p_resource &&
                r.status === 'reserved',
            )
            .reduce((s, r) => s + Number(r.delta || 0), 0);

          if (existing && (existing.status === 'reserved' || existing.status === 'committed')) {
            return { data: { allowed: true, deduplicated: true, reserved: inFlightReserved, limit: args.p_limit }, error: null };
          }
          if (args.p_limit >= 0 && Number(args.p_base_count) + inFlightReserved + Number(args.p_delta) > args.p_limit) {
            return { data: { allowed: false, code: 'QUOTA_EXCEEDED', reserved: inFlightReserved, limit: args.p_limit }, error: null };
          }
          db.quotaReservations.push({
            tenant_id: args.p_tenant_id,
            module: args.p_module,
            resource: args.p_resource,
            event_id: args.p_event_id,
            delta: args.p_delta,
            status: 'reserved',
          });
          return {
            data: { allowed: true, deduplicated: false, reserved: inFlightReserved + Number(args.p_delta), limit: args.p_limit },
            error: null,
          };
        }

        if (fn === 'commit_tenant_quota') {
          for (const r of db.quotaReservations) {
            if (
              r.tenant_id === args.p_tenant_id &&
              r.module === args.p_module &&
              r.resource === args.p_resource &&
              r.event_id === args.p_event_id &&
              r.status === 'reserved'
            ) {
              r.status = 'committed';
            }
          }
          return { data: { committed: true }, error: null };
        }

        if (fn === 'release_tenant_quota') {
          for (const r of db.quotaReservations) {
            if (
              r.tenant_id === args.p_tenant_id &&
              r.module === args.p_module &&
              r.resource === args.p_resource &&
              r.event_id === args.p_event_id &&
              r.status === 'reserved'
            ) {
              r.status = 'released';
            }
          }
          return { data: { released: true }, error: null };
        }

        if (db.enableAtomicWmsRpc && fn === 'claim_integration_inbox_event') {
          const existing = db.inbox.find(
            (r) => r.connection_id === args.p_connection_id && r.event_id === args.p_event_id,
          );
          const nowMs = Date.parse(args.p_now || new Date().toISOString());
          const leaseExpiresIso = new Date(nowMs + (Number(args.p_lease_ms) || 30000)).toISOString();
          if (existing) {
            if (existing.payload_hash !== args.p_payload_hash) {
              return { data: { outcome: 'conflict_payload_mismatch', http_status: 409 }, error: null };
            }
            if (existing.status === 'applied' || existing.status === 'rejected_stale_version') {
              return {
                data: {
                  outcome: 'duplicate_ignored',
                  http_status: 200,
                  prior_status: existing.status,
                  inbox_id: existing.id,
                  result_json: existing.result_json,
                },
                error: null,
              };
            }
            if (existing.effect_applied_at) {
              existing.status = 'applied';
              existing.applied_at = existing.applied_at || args.p_now;
              existing.lease_owner = null;
              existing.lease_expires_at = null;
              return {
                data: {
                  outcome: 'recovered_already_applied',
                  http_status: 200,
                  prior_status: 'applied',
                  inbox_id: existing.id,
                  result_json: existing.result_json,
                },
                error: null,
              };
            }
            if (existing.status === 'processing' && existing.lease_expires_at && Date.parse(existing.lease_expires_at) > nowMs) {
              return { data: { outcome: 'in_progress_retry_later', http_status: 409, inbox_id: existing.id }, error: null };
            }
            existing.status = 'processing';
            existing.lease_owner = args.p_worker_id;
            existing.lease_expires_at = leaseExpiresIso;
            existing.attempt_count = Number(existing.attempt_count || 0) + 1;
            const committed: Record<string, unknown> = {};
            for (const rcpt of db.effectReceipts) {
              if (
                rcpt.tenant_id === args.p_tenant_id &&
                rcpt.connection_id === args.p_connection_id &&
                rcpt.event_id === args.p_event_id
              ) {
                committed[rcpt.target_key] = rcpt.result_json;
              }
            }
            return {
              data: {
                outcome: 'claimed',
                http_status: 200,
                inbox_id: existing.id,
                reclaimed: true,
                attempt_count: existing.attempt_count,
                fencing_token: existing.attempt_count,
                lease_owner: existing.lease_owner,
                committed_receipts: committed,
              },
              error: null,
            };
          }
          const id = `inbox-${db.inbox.length + 1}`;
          db.inbox.push({
            id,
            tenant_id: args.p_tenant_id,
            connection_id: args.p_connection_id,
            event_id: args.p_event_id,
            aggregate_id: args.p_aggregate_id,
            aggregate_version: args.p_aggregate_version || 1,
            payload_hash: args.p_payload_hash,
            status: 'processing',
            lease_owner: args.p_worker_id,
            lease_expires_at: leaseExpiresIso,
            attempt_count: 1,
            effect_applied_at: null,
            result_json: null,
          });
          return {
            data: {
              outcome: 'claimed',
              http_status: 200,
              inbox_id: id,
              reclaimed: false,
              attempt_count: 1,
              fencing_token: 1,
              lease_owner: args.p_worker_id,
              committed_receipts: {},
            },
            error: null,
          };
        }

        if (db.enableAtomicWmsRpc && fn === 'complete_integration_inbox_event') {
          const row = db.inbox.find((r) => r.id === args.p_inbox_id);
          if (!row) return { data: { updated: false, reason: 'not_found' }, error: null };
          if (row.status === 'applied') {
            return { data: { updated: false, reason: 'already_applied', result_json: row.result_json }, error: null };
          }
          if (
            (row.lease_owner && args.p_worker_id && row.lease_owner !== args.p_worker_id) ||
            (args.p_fencing_token != null && Number(row.attempt_count) !== Number(args.p_fencing_token))
          ) {
            return { data: { updated: false, reason: 'lease_lost' }, error: null };
          }
          if (args.p_status === 'applied') {
            row.status = 'applied';
            row.effect_applied_at = row.effect_applied_at || args.p_now;
            row.applied_at = args.p_now;
            row.result_json = args.p_result_json ?? row.result_json;
            row.lease_owner = null;
            row.lease_expires_at = null;
            return { data: { updated: true, status: 'applied' }, error: null };
          }
          if (args.p_status === 'failed') {
            row.status = args.p_effect_applied || row.effect_applied_at ? 'applied' : 'failed';
            row.lease_owner = null;
            row.lease_expires_at = null;
            row.last_error = args.p_error;
            return { data: { updated: true, status: row.status }, error: null };
          }
        }

        if (db.enableAtomicWmsRpc && fn === 'apply_wms_tms_pod_target_atomic') {
          if (db.atomicWmsFault) {
            if (['42883', 'PGRST202', '42P01'].includes(db.atomicWmsFault)) {
              return { data: null, error: { code: db.atomicWmsFault, message: 'Atomic schema unavailable' } };
            }
            const invalidData = { malformed: {}, null: null, empty_array: [], invalid_shape: { ok: 'true', outcome: 'applied' } };
            return { data: invalidData[db.atomicWmsFault as keyof typeof invalidData], error: null };
          }
          if (args.p_inbox_id) {
            const inboxRow = db.inbox.find((r) => r.id === args.p_inbox_id);
            if (
              inboxRow &&
              ((inboxRow.lease_owner && args.p_worker_id && inboxRow.lease_owner !== args.p_worker_id) ||
                (args.p_fencing_token != null && Number(inboxRow.attempt_count) !== Number(args.p_fencing_token)))
            ) {
              return { data: null, error: { message: 'INBOX_LEASE_LOST: Worker lost lease' } };
            }
          }
          const existingRcpt = db.effectReceipts.find(
            (r) =>
              r.tenant_id === args.p_tenant_id &&
              r.connection_id === args.p_connection_id &&
              r.event_id === args.p_event_id &&
              r.target_key === args.p_target_key,
          );
          if (existingRcpt) {
            if (args.p_mark_inbox_complete && args.p_inbox_id) {
              const inboxRow = db.inbox.find((r) => r.id === args.p_inbox_id);
              if (inboxRow) inboxRow.effect_applied_at = inboxRow.effect_applied_at || args.p_now;
            }
            return {
              data: { ...existingRcpt.result_json, idempotent: true, receipt_reused: true, outcome: 'skipped_idempotent' },
              error: null,
            };
          }
          const order = db.outboundOrders.find(
            (o) =>
              o.org_id === args.p_tenant_id &&
              ((args.p_order_no && o.order_no === args.p_order_no) || (args.p_order_id && o.id === args.p_order_id)),
          );
          if (!order) {
            return { data: { outcome: 'not_found', ok: false, notFound: true, orderKey: args.p_order_no || 'UNKNOWN' }, error: null };
          }
          order.status = args.p_is_completed ? 'DELIVERED' : order.status;
          db.auditLog.push({ org_id: order.org_id, record_id: order.id, action: 'UPDATE', order_no: order.order_no });
          let rmaCreated = false;
          if (args.p_has_incidents && !db.returnOrders.some((r) => r.org_id === order.org_id && r.order_no === order.order_no)) {
            db.returnOrders.push({ org_id: order.org_id, order_no: order.order_no, rma_no: `RMA-${db.returnOrders.length + 1}` });
            rmaCreated = true;
          }
          const resJson = {
            outcome: 'applied',
            ok: true,
            idempotent: false,
            orderKey: order.order_no,
            orderId: order.id,
            rmaCreated,
          };
          db.effectReceipts.push({
            tenant_id: args.p_tenant_id,
            connection_id: args.p_connection_id,
            event_id: args.p_event_id,
            target_key: args.p_target_key,
            inbox_id: args.p_inbox_id,
            worker_id: args.p_worker_id,
            fencing_token: args.p_fencing_token ?? 1,
            result_json: resJson,
          });
          if (args.p_mark_inbox_complete && args.p_inbox_id) {
            const inboxRow = db.inbox.find((r) => r.id === args.p_inbox_id);
            if (inboxRow) inboxRow.effect_applied_at = inboxRow.effect_applied_at || args.p_now;
          }
          return { data: resJson, error: null };
        }

        return { data: null, error: { code: '42883', message: 'function does not exist' } };
      }),
    };
  }

  return { sharedDb: db, makeIndependentClient: createClient, defaultClient: createClient() };
});

vi.mock('@/lib/supabase', () => ({
  supabase: defaultClient,
  getServiceSupabase: vi.fn(() => defaultClient),
}));
vi.mock('@/lib/orgContext', () => ({
  getCurrentOrgId: vi.fn(async () => 'org-alpha'),
  DEFAULT_ORG: '00000000-0000-0000-0000-000000000001',
}));

import {
  SupabaseOutboxInboxRepository,
  IntegrationOutboxInboxStore,
  receiveAndApplyInboxEvent,
  computePayloadHash,
} from '@/lib/integrationOutboxInbox';
import {
  checkAndReserveQuota,
  commitQuotaReservation,
  clearEntitlementsForTests,
  EntitlementError,
} from '@/lib/entitlements';
import { addUser } from '@/lib/users';
import { addBranch } from '@/lib/branches';
import { createOrUpdateProductWithQuota } from '@/lib/data/products';
import { POST as tmsWebhookPost } from '@/app/api/webhooks/tms/route';

describe('WMS Codex RV2-01, RV2-02 & RV2-03 Remediation', () => {
  beforeEach(() => {
    sharedDb.inbox = [];
    sharedDb.effectReceipts = [];
    sharedDb.outboundOrders = [];
    sharedDb.returnOrders = [];
    sharedDb.auditLog = [];
    sharedDb.tenantModules = [
      { tenant_id: 'org-alpha', package_code: 'FULL_SUITE', modules: ['hr', 'wms', 'tms'], lifecycle_state: 'active' },
    ];
    sharedDb.tenantFeaturesLimits = [
      { tenant_id: 'org-alpha', features: {}, quotas: { users: 2, branches: 2, products: 2, orders: 2 } },
    ];
    sharedDb.quotaReservations = [];
    sharedDb.appUsers = [];
    sharedDb.orgMemberships = [];
    sharedDb.branches = [];
    sharedDb.products = [];
    sharedDb.rpcFaultMode = null;
    sharedDb.failNextInsertTable = null;
    sharedDb.enableAtomicWmsRpc = false;
    sharedDb.atomicWmsFault = null;
    delete (globalThis as any).__NEXUS_TEST_ON_AFTER_TARGET_COMMIT;
    clearEntitlementsForTests();
  });

  afterEach(() => {
    delete (globalThis as any).__NEXUS_TEST_ON_AFTER_TARGET_COMMIT;
    vi.unstubAllEnvs();
  });

  it('RV2-01: reclaims stale processing row, returns 409 for active processing, and never duplicates side effects after crash-before-finalize', async () => {
    const repo = new SupabaseOutboxInboxRepository(makeIndependentClient() as any);
    const payload = { orderNo: 'ORD-RV2-1', status: 'Delivered' };
    const payloadHash = computePayloadHash(payload);

    // Seed year-2020 stale processing row
    sharedDb.inbox.push({
      id: 'inbox-stale-2020',
      tenant_id: 'org-alpha',
      connection_id: 'conn-tms-wms-alpha',
      event_id: 'evt-wms-stale-2020',
      aggregate_id: 'TRIP-2020',
      aggregate_version: 1,
      payload_hash: payloadHash,
      status: 'processing',
      lease_expires_at: '2020-01-01T00:00:30Z',
      received_at: '2020-01-01T00:00:00Z',
    });

    let sideEffects = 0;
    const reclaimed = await repo.receiveAndApplyInboxEvent({
      connectionId: 'conn-tms-wms-alpha',
      tenantId: 'org-alpha',
      eventId: 'evt-wms-stale-2020',
      aggregateId: 'TRIP-2020',
      aggregateVersion: 1,
      payload,
      applyFn: async () => {
        sideEffects++;
        return { ok: true };
      },
    });
    expect(reclaimed.status).toBe('applied');
    expect(reclaimed.httpStatus).toBe(200);
    expect(sideEffects).toBe(1);

    // Active processing lease -> 409 in_progress_retry_later (NEVER 200 duplicate_ignored)
    const nowMs = 1_750_000_000_000;
    sharedDb.inbox.push({
      id: 'inbox-active-1',
      tenant_id: 'org-alpha',
      connection_id: 'conn-tms-wms-alpha',
      event_id: 'evt-wms-active',
      aggregate_id: 'TRIP-ACTIVE',
      aggregate_version: 1,
      payload_hash: payloadHash,
      status: 'processing',
      lease_expires_at: new Date(nowMs + 60_000).toISOString(),
      received_at: new Date(nowMs).toISOString(),
    });
    const activeRes = await repo.receiveAndApplyInboxEvent({
      connectionId: 'conn-tms-wms-alpha',
      tenantId: 'org-alpha',
      eventId: 'evt-wms-active',
      aggregateId: 'TRIP-ACTIVE',
      aggregateVersion: 1,
      payload,
      nowMs: nowMs + 1000,
    });
    expect(activeRes.httpStatus).toBe(409);
    expect(activeRes.status).toBe('in_progress_retry_later');

    // Crash after applyFn side effect before finalization -> retry does NOT re-execute applyFn
    let crashEffects = 0;
    const crashFirst = await repo.receiveAndApplyInboxEvent({
      connectionId: 'conn-tms-wms-alpha',
      tenantId: 'org-alpha',
      eventId: 'evt-wms-crash-after',
      aggregateId: 'TRIP-CRASH',
      aggregateVersion: 1,
      payload,
      applyFn: async () => {
        crashEffects++;
        return { applied: true };
      },
      persistInboxFn: async () => {
        throw new Error('Transient persistence error');
      },
    });
    expect(crashFirst.httpStatus).toBe(500);
    expect(crashEffects).toBe(1);

    const crashRetry = await repo.receiveAndApplyInboxEvent({
      connectionId: 'conn-tms-wms-alpha',
      tenantId: 'org-alpha',
      eventId: 'evt-wms-crash-after',
      aggregateId: 'TRIP-CRASH',
      aggregateVersion: 1,
      payload,
      applyFn: async () => {
        crashEffects++;
        return { applied: true };
      },
    });
    expect(crashRetry.httpStatus).toBe(200);
    expect(crashRetry.status).toBe('duplicate_ignored');
    expect(crashEffects).toBe(1);

    // In-memory store also enforces processing lease 409 / stale reclaim
    const memStore = new IntegrationOutboxInboxStore();
    memStore.inbox.set(memStore.inboxKey('c1', 'e-stale'), {
      connectionId: 'c1',
      tenantId: 'org-alpha',
      eventId: 'e-stale',
      aggregateId: 'A1',
      aggregateVersion: 1,
      eventType: 't',
      schemaVersion: '2.0.0',
      payloadHash,
      status: 'processing',
      appliedAt: 1000,
      leaseExpiresAt: 2000,
    });
    let memCount = 0;
    const memReclaim = await receiveAndApplyInboxEvent(
      {
        connectionId: 'c1',
        tenantId: 'org-alpha',
        eventId: 'e-stale',
        aggregateId: 'A1',
        aggregateVersion: 1,
        payload,
        nowMs: 5000,
        applyFn: async () => {
          memCount++;
        },
      },
      memStore,
    );
    expect(memReclaim.status).toBe('applied');
    expect(memCount).toBe(1);
  });

  it('RV2-02: fails closed (503 QUOTA_SCHEMA_MISSING) on 42883/PGRST202/malformed RPC and forbids production in-memory fallback', async () => {
    for (const mode of ['42883', 'PGRST202', 'malformed'] as const) {
      sharedDb.rpcFaultMode = mode;

      await expect(
        checkAndReserveQuota('org-alpha', 'users', async () => 0, { module: 'wms', eventId: `fail-${mode}` }),
      ).rejects.toMatchObject({ code: 'QUOTA_SCHEMA_MISSING', status: 503 });

      const userRes = await addUser({ username: `u-${mode}`, password: 'pw' });
      expect(userRes).toHaveProperty('error');
      expect(sharedDb.appUsers).toHaveLength(0);

      await expect(addBranch('org-alpha', { code: `B-${mode}`, name: 'Branch' })).rejects.toMatchObject({
        code: 'QUOTA_SCHEMA_MISSING',
        status: 503,
      });
      expect(sharedDb.branches).toHaveLength(0);

      await expect(
        createOrUpdateProductWithQuota('org-alpha', { sku: `SKU-${mode}`, name: 'Prod' }),
      ).rejects.toMatchObject({ code: 'QUOTA_SCHEMA_MISSING', status: 503 });
      expect(sharedDb.products).toHaveLength(0);
    }

    vi.stubEnv('NODE_ENV', 'production');
    await expect(
      checkAndReserveQuota('org-alpha', 'users', async () => 0, {
        module: 'wms',
        eventId: 'prod-inmem',
        database: null,
        allowInMemoryQuotaFallback: true,
      }),
    ).rejects.toMatchObject({ code: 'QUOTA_CONFIG_ERROR', status: 503 });
  });

  it('RV2-03: commits quota on resource creation without double-counting against limit=2, and releases on DB insert failure', async () => {
    // Users: limit = 2 -> user1 commits, user2 succeeds, user3 blocked
    expect(await addUser({ username: 'u1', password: 'pw1' })).toBe(true);
    expect(await addUser({ username: 'u2', password: 'pw2' })).toBe(true);
    const u3 = await addUser({ username: 'u3', password: 'pw3' });
    expect(u3).toHaveProperty('error');
    expect(sharedDb.appUsers).toHaveLength(2);
    expect(sharedDb.quotaReservations.filter((r) => r.resource === 'users' && r.status === 'committed')).toHaveLength(2);

    // Branches: limit = 2 -> failed insert releases slot, then 2 branches succeed, 3rd fails
    sharedDb.failNextInsertTable = 'branches';
    const bFail = await addBranch('org-alpha', { code: 'B-FAIL', name: 'Fail Branch', eventId: 'br-fail' });
    expect(bFail.success).toBe(false);
    expect(sharedDb.quotaReservations.find((r) => r.event_id === 'br-fail')?.status).toBe('released');

    expect((await addBranch('org-alpha', { code: 'B1', name: 'Branch 1', eventId: 'br-1' })).success).toBe(true);
    expect((await addBranch('org-alpha', { code: 'B2', name: 'Branch 2', eventId: 'br-2' })).success).toBe(true);
    await expect(addBranch('org-alpha', { code: 'B3', name: 'Branch 3', eventId: 'br-3' })).rejects.toBeInstanceOf(
      EntitlementError,
    );

    // Products: limit = 2 -> 2 products succeed, 3rd fails
    await createOrUpdateProductWithQuota('org-alpha', { sku: 'SKU-1', name: 'Item 1' }, { eventId: 'p-1' });
    await createOrUpdateProductWithQuota('org-alpha', { sku: 'SKU-2', name: 'Item 2' }, { eventId: 'p-2' });
    await expect(
      createOrUpdateProductWithQuota('org-alpha', { sku: 'SKU-3', name: 'Item 3' }, { eventId: 'p-3' }),
    ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED', status: 403 });

    // Direct commitQuotaReservation does not double-count on subsequent check
    const o1 = await checkAndReserveQuota('org-alpha', 'orders', async () => 0, { module: 'wms', eventId: 'ord-q1' });
    expect(o1.allowed).toBe(true);
    expect(o1.limit).toBe(2);
    await commitQuotaReservation('org-alpha', 'orders', { module: 'wms', eventId: 'ord-q1' });
    const o2 = await checkAndReserveQuota('org-alpha', 'orders', async () => 1, { module: 'wms', eventId: 'ord-q2' });
    expect(o2.allowed).toBe(true);
    expect(o2.limit).toBe(2);
    expect(o2.reserved).toBe(1);
  });

  it.each(['42883', 'PGRST202', '42P01', 'malformed', 'null', 'empty_array', 'invalid_shape'] as const)(
    'RV4-01: webhook returns 503 without domain mutations when atomic RPC returns %s',
    async (mode) => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('TMS_WEBHOOK_SECRET', 'wms-rv4-test-secret');
      sharedDb.enableAtomicWmsRpc = true;
      sharedDb.atomicWmsFault = mode;
      const originalOrder = { id: 'ord-rv4', org_id: 'org-alpha', order_no: 'ORD-RV4', status: 'SHIPPED' };
      sharedDb.outboundOrders.push({ ...originalOrder });

      for (const shape of ['whole_job', 'drop', 'intermediate'] as const) {
        const response = await tmsWebhookPost(new Request('https://wms.test/api/webhooks/tms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-wms-secret': 'wms-rv4-test-secret' },
          body: JSON.stringify({
            event_id: `evt-rv4-${mode}-${shape}`,
            connection_id: 'conn-rv4', tenant_claim: 'org-alpha', aggregate_id: `JOB-RV4-${shape}`,
            payload: {
              job_id: `JOB-RV4-${shape}`, wms_order_no: 'ORD-RV4',
              status: shape === 'intermediate' ? 'In Transit' : 'Completed',
              is_completed: shape !== 'intermediate',
              ...(shape === 'drop' ? { drops: [{ drop_index: 1, wms_order_no: 'ORD-RV4', status: 'Completed' }] } : {}),
            },
          }),
        }));
        expect(response.status).toBe(503);
        expect((await response.json()).code).toBe('ATOMIC_EFFECT_SCHEMA_MISSING');
        expect(sharedDb.outboundOrders).toEqual([originalOrder]);
        expect(sharedDb.returnOrders).toHaveLength(0);
        expect(sharedDb.auditLog).toHaveLength(0);
        expect(sharedDb.effectReceipts).toHaveLength(0);
        expect(sharedDb.inbox.every((row) => row.status !== 'applied' && !row.effect_applied_at)).toBe(true);
      }
    },
  );

  it('RV4-01: webhook fails closed when the database client has no RPC method', async () => {
    vi.stubEnv('TMS_WEBHOOK_SECRET', 'wms-rv4-test-secret');
    const rpc = defaultClient.rpc;
    const originalOrder = { id: 'ord-no-rpc', org_id: 'org-alpha', order_no: 'ORD-NO-RPC', status: 'SHIPPED' };
    sharedDb.outboundOrders.push({ ...originalOrder });
    try {
      Reflect.set(defaultClient, 'rpc', undefined);
      const response = await tmsWebhookPost(new Request('https://wms.test/api/webhooks/tms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wms-secret': 'wms-rv4-test-secret' },
        body: JSON.stringify({
          event_id: 'evt-no-rpc', connection_id: 'conn-rv4', tenant_claim: 'org-alpha',
          payload: { job_id: 'JOB-NO-RPC', wms_order_no: 'ORD-NO-RPC', status: 'Completed', is_completed: true },
        }),
      }));
      expect(response.status).toBe(503);
      expect((await response.json()).code).toBe('ATOMIC_EFFECT_SCHEMA_MISSING');
      expect(sharedDb.outboundOrders).toEqual([originalOrder]);
      expect(sharedDb.effectReceipts).toHaveLength(0);
    } finally {
      Reflect.set(defaultClient, 'rpc', rpc);
    }
  });

  it('RV3-01: POST /api/webhooks/tms recovers partial multi-drop POD crash cleanly and fences stale reclaimed worker with 409 lease_lost', async () => {
    vi.stubEnv('TMS_WEBHOOK_SECRET', 'wms-rv3-test-secret');
    sharedDb.enableAtomicWmsRpc = true;
    sharedDb.outboundOrders.push(
      { id: 'ord-w1-id', org_id: 'org-alpha', order_no: 'ORD-W1', status: 'SHIPPED' },
      { id: 'ord-w2-id', org_id: 'org-alpha', order_no: 'ORD-W2', status: 'SHIPPED' },
    );

    const body = {
      event_id: 'evt-wms-rv3-multi',
      connection_id: 'conn-tms-wms-alpha',
      aggregate_id: 'JOB-WMS-RV3',
      aggregate_version: 1,
      tenant_claim: 'org-alpha',
      event_type: 'tms.pod.updated',
      payload: {
        job_id: 'JOB-WMS-RV3',
        drops: [
          {
            drop_index: 1,
            wms_order_no: 'ORD-W1',
            status: 'Completed',
            has_incidents: true,
            incidents: [{ category: 'DAMAGED', description: 'Drop 1 carton' }],
          },
          {
            drop_index: 2,
            wms_order_no: 'ORD-W2',
            status: 'Completed',
            has_incidents: true,
            incidents: [{ category: 'WET', description: 'Drop 2 carton' }],
          },
        ],
      },
    };

    // 1. Attempt 1 crashes right after Drop 1 commits, before Drop 2 starts
    (globalThis as any).__NEXUS_TEST_ON_AFTER_TARGET_COMMIT = async ({ index }: { index: number }) => {
      if (index === 0) throw new Error('Simulated crash after Drop 1');
    };
    const crashRes = await tmsWebhookPost(
      new Request('https://wms.test/api/webhooks/tms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wms-secret': 'wms-rv3-test-secret',
        },
        body: JSON.stringify(body),
      }),
    );
    expect(crashRes.status).toBe(500);
    expect(sharedDb.outboundOrders.find((o) => o.order_no === 'ORD-W1')?.status).toBe('DELIVERED');
    expect(sharedDb.outboundOrders.find((o) => o.order_no === 'ORD-W2')?.status).toBe('SHIPPED');
    expect(sharedDb.returnOrders).toHaveLength(1);
    expect(sharedDb.auditLog).toHaveLength(1);
    expect(sharedDb.inbox[0].effect_applied_at).toBeNull();

    // 2. Attempt 2 retries -> Drop 1 reuses receipt without duplicate RMA/audit; Drop 2 commits cleanly
    delete (globalThis as any).__NEXUS_TEST_ON_AFTER_TARGET_COMMIT;
    const recoverRes = await tmsWebhookPost(
      new Request('https://wms.test/api/webhooks/tms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wms-secret': 'wms-rv3-test-secret',
        },
        body: JSON.stringify(body),
      }),
    );
    expect(recoverRes.status).toBe(200);
    const recoverJson = await recoverRes.json();
    expect(recoverJson.skippedIdempotent).toEqual(['ORD-W1']);
    expect(recoverJson.applied).toEqual(['ORD-W2']);
    expect(sharedDb.outboundOrders.find((o) => o.order_no === 'ORD-W2')?.status).toBe('DELIVERED');
    expect(sharedDb.returnOrders).toHaveLength(2);
    expect(sharedDb.auditLog).toHaveLength(2);
    expect(sharedDb.inbox[0].status).toBe('applied');

    // 3. Attempt 3 replay returns cached 200 duplicate_ignored
    const replayRes = await tmsWebhookPost(
      new Request('https://wms.test/api/webhooks/tms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wms-secret': 'wms-rv3-test-secret',
        },
        body: JSON.stringify(body),
      }),
    );
    expect(replayRes.status).toBe(200);
    const replayJson = await replayRes.json();
    expect(replayJson.idempotent).toBe(true);
    expect(replayJson.inboxStatus).toBe('duplicate_ignored');
    expect(replayJson.skippedIdempotent).toEqual(['ORD-W1']);
    expect(replayJson.applied).toEqual(['ORD-W2']);

    // 4. Stale worker fencing: simulate lease hijack mid-flight between Drop 1 and Drop 2 -> 409 lease_lost
    sharedDb.outboundOrders.push(
      { id: 'ord-f1-id', org_id: 'org-alpha', order_no: 'ORD-F1', status: 'SHIPPED' },
      { id: 'ord-f2-id', org_id: 'org-alpha', order_no: 'ORD-F2', status: 'SHIPPED' },
    );
    const fenceBody = {
      ...body,
      event_id: 'evt-wms-rv3-fence',
      aggregate_id: 'JOB-WMS-FENCE',
      payload: {
        job_id: 'JOB-WMS-FENCE',
        drops: [
          { drop_index: 1, wms_order_no: 'ORD-F1', status: 'Completed' },
          { drop_index: 2, wms_order_no: 'ORD-F2', status: 'Completed' },
        ],
      },
    };
    (globalThis as any).__NEXUS_TEST_ON_AFTER_TARGET_COMMIT = async ({ index }: { index: number }) => {
      if (index === 0) {
        const row = sharedDb.inbox.find((r) => r.event_id === 'evt-wms-rv3-fence');
        if (row) {
          row.lease_owner = 'worker-hijacker-B';
          row.attempt_count = Number(row.attempt_count || 1) + 1;
        }
      }
    };
    const fencedRes = await tmsWebhookPost(
      new Request('https://wms.test/api/webhooks/tms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wms-secret': 'wms-rv3-test-secret',
        },
        body: JSON.stringify(fenceBody),
      }),
    );
    expect(fencedRes.status).toBe(409);
    const fencedJson = await fencedRes.json();
    expect(fencedJson.status).toBe('lease_lost');
    expect(sharedDb.outboundOrders.find((o) => o.order_no === 'ORD-F2')?.status).toBe('SHIPPED');
  });
});
