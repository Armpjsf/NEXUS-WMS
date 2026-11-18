import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { sharedDb, makeIndependentClient, defaultClient } = vi.hoisted(() => {
  const db = {
    outbox: [] as Array<Record<string, any>>,
    inbox: [] as Array<Record<string, any>>,
    attempts: [] as Array<Record<string, any>>,
    tenantModules: [] as Array<Record<string, any>>,
    tenantFeaturesLimits: [] as Array<Record<string, any>>,
    quotaReservations: [] as Array<Record<string, any>>,
    usageEvents: [] as Array<Record<string, any>>,
    stockLocations: [] as Array<Record<string, any>>,
    products: [] as Array<Record<string, any>>,
    productLots: [] as Array<Record<string, any>>,
    lotMovements: [] as Array<Record<string, any>>,
    organizations: [] as Array<Record<string, any>>,
    appUsers: [] as Array<Record<string, any>>,
    branches: [] as Array<Record<string, any>>,
    orgMemberships: [] as Array<Record<string, any>>,
    injectStockRace: false,
  };

  function createClient() {
    function makeBuilder(table: string) {
      const filters: Array<{ op: string; col: string; val: unknown }> = [];
      let pendingInsert: any[] | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;
      let isDelete = false;
      let maxRows: number | null = null;
      let orderCol: string | null = null;
      let orderAsc = true;
      let selectOpts: any = {};

      const getRows = () => {
        switch (table) {
          case 'integration_outbox': return db.outbox;
          case 'integration_inbox': return db.inbox;
          case 'integration_attempts': return db.attempts;
          case 'tenant_modules': return db.tenantModules;
          case 'tenant_features_limits': return db.tenantFeaturesLimits;
          case 'quota_reservations': return db.quotaReservations;
          case 'usage_events': return db.usageEvents;
          case 'stock_locations': return db.stockLocations;
          case 'products': return db.products;
          case 'product_lots': return db.productLots;
          case 'lot_movements': return db.lotMovements;
          case 'organizations': return db.organizations;
          case 'app_users': return db.appUsers;
          case 'branches': return db.branches;
          case 'org_memberships': return db.orgMemberships;
          default: return [];
        }
      };

      const applyFilters = (rows: any[]) =>
        rows.filter((row) =>
          filters.every((f) => {
            if (f.op === 'eq') return row[f.col] === f.val;
            if (f.op === 'neq') return row[f.col] !== f.val;
            if (f.op === 'is') return f.val === null ? row[f.col] == null : row[f.col] === f.val;
            if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(row[f.col]);
            return true;
          }),
        );

      const execute = async () => {
        const rows = getRows();
        if (pendingInsert) {
          for (const item of pendingInsert) {
            if ((table === 'integration_outbox' || table === 'integration_inbox') &&
                rows.some((r) => r.connection_id === item.connection_id && r.event_id === item.event_id)) {
              return { data: null, error: { code: '23505', message: 'duplicate key value' } };
            }
          }
          const inserted = pendingInsert.map((item, idx) => ({
            id: item.id || `${table}-${rows.length + idx + 1}`,
            created_at: item.created_at || new Date().toISOString(),
            ...item,
          }));
          rows.push(...inserted);
          return { data: inserted, error: null, count: inserted.length };
        }

        // Simulate a concurrent instance decrementing stock_locations right before our optimistic update
        if (
          db.injectStockRace &&
          table === 'stock_locations' &&
          pendingUpdate &&
          filters.some((f) => f.col === 'quantity')
        ) {
          db.injectStockRace = false;
          const targetRow = rows.find((r) => r.sku === 'SKU-RACE' && r.org_id === 'org-alpha');
          if (targetRow) targetRow.quantity = Number(targetRow.quantity) - 2;
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
          return { data: matched, error: null, count: matched.length };
        }

        if (pendingUpdate) {
          for (const r of matched) Object.assign(r, pendingUpdate);
          return { data: matched.map((r) => ({ ...r })), error: null, count: matched.length };
        }

        return {
          data: selectOpts?.head ? null : matched.map((r) => ({ ...r })),
          error: null,
          count: matched.length,
        };
      };

      const builder: any = {
        select: vi.fn((_cols?: string, opts?: any) => {
          selectOpts = opts || {};
          return builder;
        }),
        insert: vi.fn((payload: any) => {
          pendingInsert = Array.isArray(payload) ? payload : [payload];
          return builder;
        }),
        update: vi.fn((patch: Record<string, unknown>) => {
          pendingUpdate = patch;
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
        is: vi.fn((col: string, val: unknown) => {
          filters.push({ op: 'is', col, val });
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
        single: vi.fn(async () => {
          const res = await execute();
          const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
          if (!first) return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
          return { data: first, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          const res = await execute();
          const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
          return { data: first, error: null };
        }),
        then: (resolve: any, reject: any) => execute().then(resolve, reject),
      };
      return builder;
    }

    return {
      from: vi.fn((table: string) => makeBuilder(table)),
      rpc: vi.fn(async (fn: string, args: Record<string, any>) => {
        if (fn === 'claim_integration_outbox_batch') {
          const nowMs = Date.parse(args.p_now || new Date().toISOString());
          const leaseMs = Number(args.p_lease_ms) || 30000;
          const limit = Number(args.p_limit) || 20;
          const claimed: any[] = [];
          for (const row of db.outbox) {
            if (claimed.length >= limit) break;
            const nextAt = Date.parse(row.next_attempt_at);
            const leaseExp = row.lease_expires_at ? Date.parse(row.lease_expires_at) : null;
            const isDue =
              (row.status === 'pending' && nextAt <= nowMs) ||
              (row.status === 'processing' && leaseExp !== null && leaseExp <= nowMs);
            if (isDue) {
              row.status = 'processing';
              row.lease_owner = args.p_worker_id;
              row.lease_expires_at = new Date(nowMs + leaseMs).toISOString();
              claimed.push({ ...row });
            }
          }
          return { data: claimed, error: null };
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
            return {
              data: { allowed: true, deduplicated: true, reserved: inFlightReserved, limit: args.p_limit },
              error: null,
            };
          }

          if (args.p_limit >= 0 && Number(args.p_base_count) + inFlightReserved + Number(args.p_delta) > args.p_limit) {
            return {
              data: { allowed: false, code: 'QUOTA_EXCEEDED', reserved: inFlightReserved, limit: args.p_limit },
              error: null,
            };
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

import { SupabaseOutboxInboxRepository } from '@/lib/integrationOutboxInbox';
import { POST as cronOutboxPost } from '@/app/api/cron/integration-outbox/route';
import {
  checkAndReserveQuota,
  releaseQuotaReservation,
  clearEntitlementsForTests,
} from '@/lib/entitlements';
import { binConsume } from '@/lib/stockLocations';
import { addUser } from '@/lib/users';

const originalFetch = globalThis.fetch;

describe('WMS Codex R01 & R03 Durability, Multi-Instance Quota & Stock Optimistic Concurrency', () => {
  beforeEach(() => {
    sharedDb.outbox = [];
    sharedDb.inbox = [];
    sharedDb.attempts = [];
    sharedDb.tenantModules = [
      { tenant_id: 'org-alpha', package_code: 'FULL_SUITE', modules: ['hr', 'wms', 'tms'], lifecycle_state: 'active' },
    ];
    sharedDb.tenantFeaturesLimits = [
      { tenant_id: 'org-alpha', features: {}, quotas: { users: 1 } },
    ];
    sharedDb.quotaReservations = [];
    sharedDb.usageEvents = [];
    sharedDb.stockLocations = [];
    sharedDb.products = [];
    sharedDb.productLots = [];
    sharedDb.lotMovements = [];
    sharedDb.organizations = [];
    sharedDb.appUsers = [];
    sharedDb.branches = [];
    sharedDb.orgMemberships = [];
    sharedDb.injectStockRace = false;
    clearEntitlementsForTests();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('R01: shares DB outbox/inbox across instances and delivers via /api/cron/integration-outbox', async () => {
    vi.stubEnv('CRON_SECRET', 'wms-cron-secret');
    vi.stubEnv('TMS_API_URL', 'https://tms.example.com/api/external/v1/jobs');
    vi.stubEnv('NEXUS_SIGNING_SECRET', 'wms-sign-secret');

    const repoA = new SupabaseOutboxInboxRepository(makeIndependentClient() as any);
    const repoB = new SupabaseOutboxInboxRepository(makeIndependentClient() as any);

    await repoA.enqueueOutboxEvent({
      eventId: 'wms-evt-1',
      tenantId: 'org-alpha',
      connectionId: 'conn-wms-tms-alpha',
      aggregateId: 'ORD-001',
      payload: { orderNo: 'ORD-001' },
      nowMs: 1_700_000_000_000,
    });

    // Unauthorized cron rejected
    const unauth = await cronOutboxPost(new Request('https://wms.test/api/cron/integration-outbox', { method: 'POST' }));
    expect(unauth.status).toBe(401);

    globalThis.fetch = vi.fn(async (_url, init) => {
      expect((init?.headers as Record<string, string>)['x-nexus-signature']).toMatch(/^v1=/);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as any;

    const cronRes = await cronOutboxPost(
      new Request('https://wms.test/api/cron/integration-outbox', {
        method: 'POST',
        headers: { Authorization: 'Bearer wms-cron-secret' },
      }),
    );
    expect(cronRes.status).toBe(200);
    const cronJson = await cronRes.json();
    expect(cronJson.claimedCount).toBe(1);
    expect(cronJson.results[0].status).toBe('delivered');

    // Inbox deduplication across separate instance repos
    let applied = 0;
    await repoA.receiveAndApplyInboxEvent({
      connectionId: 'conn-tms-wms-alpha',
      tenantId: 'org-alpha',
      eventId: 'in-wms-1',
      aggregateId: 'TRIP-1',
      aggregateVersion: 1,
      payload: { status: 'Delivered' },
      applyFn: async () => { applied++; },
    });
    const dup = await repoB.receiveAndApplyInboxEvent({
      connectionId: 'conn-tms-wms-alpha',
      tenantId: 'org-alpha',
      eventId: 'in-wms-1',
      aggregateId: 'TRIP-1',
      aggregateVersion: 1,
      payload: { status: 'Delivered' },
      applyFn: async () => { applied++; },
    });
    expect(dup.status).toBe('duplicate_ignored');
    expect(applied).toBe(1);
  });

  it('R03: enforces DB-backed reserve_tenant_quota across instances and wires addUser', async () => {
    const clientA = makeIndependentClient() as any;
    const clientB = makeIndependentClient() as any;

    const [a, b] = await Promise.allSettled([
      checkAndReserveQuota('org-alpha', 'users', async () => 0, { module: 'wms', eventId: 'u-evt-1', database: clientA }),
      checkAndReserveQuota('org-alpha', 'users', async () => 0, { module: 'wms', eventId: 'u-evt-2', database: clientB }),
    ]);

    const passed = [a, b].filter((x) => x.status === 'fulfilled');
    const failed = [a, b].filter((x) => x.status === 'rejected');
    expect(passed).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason.code).toBe('QUOTA_EXCEEDED');

    // Release slot -> addUser succeeds for 1 user, then blocks 2nd user via quota
    const winnerId = (passed[0] as PromiseFulfilledResult<any>).value.eventId;
    await releaseQuotaReservation('org-alpha', 'users', 1, { module: 'wms', eventId: winnerId, database: clientA });

    const u1 = await addUser({ username: 'user1', password: 'pw1' });
    expect(u1).toBe(true);
    const u2 = await addUser({ username: 'user2', password: 'pw2' });
    expect(u2).toHaveProperty('error');
  });

  it('R03 stock fallback: retries optimistic concurrency check when a second instance decrements bin stock concurrently', async () => {
    sharedDb.products.push({ id: 'p-race', org_id: 'org-alpha', sku: 'SKU-RACE', stock: 10, location: 'A-01' });
    sharedDb.stockLocations.push({
      id: 'sl-race',
      org_id: 'org-alpha',
      sku: 'SKU-RACE',
      bin_code: 'A-01',
      lot_no: '',
      quantity: 10,
      created_at: new Date().toISOString(),
    });
    sharedDb.injectStockRace = true;

    // Concurrent instance took 2 units leaving 8; binConsume(6) retries and leaves exactly 2 (never 4!)
    const res = await binConsume('org-alpha', 'SKU-RACE', 6);
    expect(res.shortfall).toBe(0);
    expect(res.total).toBe(2);
    expect(sharedDb.stockLocations[0].quantity).toBe(2);
  });
});
