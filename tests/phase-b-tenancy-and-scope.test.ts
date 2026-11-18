import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { state, mockWmsSupabase } = vi.hoisted(() => {
  const s = {
    session: null as any,
    orgAccess: null as any,
    outboundOrders: [] as any[],
    returnOrders: [] as any[],
    pushSubscriptions: [] as any[],
    failUpdateOnOrderId: null as string | null,
    webPushSentPayloads: [] as Array<{ endpoint: string; payload: string }>,
    webPushFailStatusByEndpoint: new Map<string, number>(),
  };

  function makeWmsQueryBuilder(table: string) {
    const filters: Array<{ op: string; col: string; val: unknown }> = [];
    let pendingUpdate: Record<string, unknown> | null = null;
    let pendingInsert: any[] | null = null;
    let pendingUpsert: any[] | null = null;
    let isDelete = false;

    const getRows = () => {
      if (table === 'outbound_orders') return s.outboundOrders;
      if (table === 'return_orders') return s.returnOrders;
      if (table === 'push_subscriptions') return s.pushSubscriptions;
      return [];
    };

    const applyFilters = (rows: any[]) =>
      rows.filter((row) =>
        filters.every((f) => {
          if (f.op === 'eq') return row[f.col] === f.val;
          if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(row[f.col]);
          return true;
        })
      );

    const execute = async () => {
      const rows = getRows();
      if (pendingInsert) {
        const inserted = pendingInsert.map((r) => ({ ...r }));
        rows.push(...inserted);
        return { data: inserted, error: null };
      }
      if (pendingUpsert) {
        for (const item of pendingUpsert) {
          const existingIdx = rows.findIndex((r) => r.endpoint === item.endpoint);
          if (existingIdx >= 0) {
            rows[existingIdx] = { ...rows[existingIdx], ...item };
          } else {
            rows.push({ ...item });
          }
        }
        return { data: pendingUpsert, error: null };
      }
      const matched = applyFilters(rows);
      if (isDelete) {
        for (let i = rows.length - 1; i >= 0; i--) {
          if (matched.includes(rows[i])) {
            rows.splice(i, 1);
          }
        }
        return { data: matched, error: null };
      }
      if (pendingUpdate) {
        for (const r of matched) {
          if (table === 'outbound_orders' && s.failUpdateOnOrderId === r.id) {
            return { data: null, error: { message: 'Simulated DB update failure' } };
          }
        }
        for (const r of matched) {
          Object.assign(r, pendingUpdate);
        }
        return { data: matched, error: null };
      }
      return { data: matched.map((r) => ({ ...r })), error: null };
    };

    const builder: any = {
      select: vi.fn(() => builder),
      insert: vi.fn((payload: any) => {
        pendingInsert = Array.isArray(payload) ? payload : [payload];
        return builder;
      }),
      upsert: vi.fn((payload: any) => {
        pendingUpsert = Array.isArray(payload) ? payload : [payload];
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
      in: vi.fn((col: string, val: unknown[]) => {
        filters.push({ op: 'in', col, val });
        return builder;
      }),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(async () => {
        const res = await execute();
        if (res.error) return res;
        const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
        if (!first) return { data: null, error: { message: 'Not found' } };
        return { data: first, error: null };
      }),
      maybeSingle: vi.fn(async () => {
        const res = await execute();
        if (res.error) return res;
        const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
        return { data: first, error: null };
      }),
      then: (resolve: any, reject: any) => execute().then(resolve, reject),
    };

    return builder;
  }

  return {
    state: s,
    mockWmsSupabase: {
      from: vi.fn((table: string) => makeWmsQueryBuilder(table)),
    },
  };
});

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(async () => state.session),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/memberships', () => ({
  getOrgAccess: vi.fn(async () => state.orgAccess),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
      const failStatus = state.webPushFailStatusByEndpoint.get(sub.endpoint);
      if (failStatus) {
        const err: any = new Error(`HTTP ${failStatus}`);
        err.statusCode = failStatus;
        throw err;
      }
      state.webPushSentPayloads.push({ endpoint: sub.endpoint, payload });
    }),
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: mockWmsSupabase,
  getServiceSupabase: vi.fn(() => mockWmsSupabase),
}));

vi.mock('@/lib/docNumber', () => ({
  nextDocNumber: vi.fn(async (prefix: string) => `${prefix}-2026-0001`),
}));

import { requireTenantContext, TenantContextError } from '@/lib/tenantContext';
import { getCurrentOrgId, requireCurrentOrgId } from '@/lib/orgContext';
import { createDeliveryTrip } from '@/lib/data/orders';
import { ensureRmaForDamagedOrder } from '@/lib/data/returns';
import { getTmsTrackingUrl, isTmsEnabled } from '@/lib/tms';
import { validateIntegrationUrl } from '@/lib/urlSecurity';
import {
  getSubscriptions,
  removeSubscriptions,
  removeUserSubscriptionsOnLogout,
  saveSubscription,
} from '@/lib/subscriptionRepository';

beforeEach(() => {
  state.session = null;
  state.orgAccess = null;
  state.outboundOrders = [];
  state.returnOrders = [];
  state.pushSubscriptions = [];
  state.failUpdateOnOrderId = null;
  state.webPushSentPayloads = [];
  state.webPushFailStatusByEndpoint.clear();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('TASK-B02: WMS Trusted Tenant Context', () => {
  it('rejects missing session, revoked user, missing orgId, and revoked membership without DEFAULT_ORG fallback', async () => {
    await expect(requireTenantContext()).rejects.toThrow(TenantContextError);
    await expect(requireCurrentOrgId()).rejects.toThrow(/Unauthorized/);
    await expect(getCurrentOrgId({ allowDefaultInDev: false })).rejects.toThrow(/Unauthorized/);

    state.session = { user: { id: 'u-1', role: 'Admin', revoked: true, orgId: 'tenant-alpha' } };
    await expect(requireTenantContext()).rejects.toThrow(/revoked/i);

    state.session = { user: { id: 'u-1', role: 'Admin', orgId: '' } };
    await expect(requireTenantContext()).rejects.toThrow(/missing/i);

    state.session = { user: { id: 'u-1', role: 'Admin', orgId: 'tenant-alpha' } };
    state.orgAccess = null;
    await expect(requireTenantContext()).rejects.toThrow(/membership/i);

    state.orgAccess = {
      orgId: 'tenant-alpha',
      orgName: 'Alpha',
      role: 'Admin',
      allowedBranches: ['HQ'],
      home: true,
    };
    const ctx = await requireTenantContext();
    expect(ctx.orgId).toBe('tenant-alpha');
    expect(ctx.allowedBranches).toEqual(['HQ']);
    expect(Object.isFrozen(ctx)).toBe(true);
  });
});

describe('TASK-B03: WMS Scope & Transactional Trip Creation + Returns', () => {
  it('rejects mixed-tenant orders, duplicate IDs, unauthorized branch, and rolls back on partial failure', async () => {
    state.outboundOrders.push(
      {
        id: 'ord-a1',
        org_id: 'tenant-alpha',
        order_no: 'ORD-2026-0001',
        branch_code: 'HQ',
        status: 'PACKED',
        items_json: [],
        notes: 'Order A1',
      },
      {
        id: 'ord-a2',
        org_id: 'tenant-alpha',
        order_no: 'ORD-2026-0002',
        branch_code: 'HQ',
        status: 'READY_TO_SHIP',
        items_json: [],
        notes: 'Order A2',
      },
      {
        id: 'ord-b1',
        org_id: 'tenant-beta',
        order_no: 'ORD-2026-0001',
        branch_code: 'HQ',
        status: 'PACKED',
        items_json: [],
        notes: 'Order B1',
      }
    );

    // Mixed tenant IDs -> 0 rows updated!
    const mixedRes = await createDeliveryTrip({
      orderIds: ['ord-a1', 'ord-b1'],
      orgId: 'tenant-alpha',
      sendToTms: false,
    });
    expect(mixedRes.ok).toBe(false);
    expect(state.outboundOrders.find((o) => o.id === 'ord-a1')?.status).toBe('PACKED');
    expect(state.outboundOrders.find((o) => o.id === 'ord-b1')?.status).toBe('PACKED');

    // Duplicate IDs rejected
    const dupRes = await createDeliveryTrip({
      orderIds: ['ord-a1', 'ord-a1'],
      orgId: 'tenant-alpha',
      sendToTms: false,
    });
    expect(dupRes.ok).toBe(false);

    // Unauthorized branch rejected
    const branchRes = await createDeliveryTrip({
      orderIds: ['ord-a1'],
      orgId: 'tenant-alpha',
      allowedBranches: ['URT'],
      sendToTms: false,
    });
    expect(branchRes.ok).toBe(false);

    // Partial DB failure rolls back earlier order in the same trip
    state.failUpdateOnOrderId = 'ord-a2';
    const failRes = await createDeliveryTrip({
      orderIds: ['ord-a1', 'ord-a2'],
      orgId: 'tenant-alpha',
      sendToTms: false,
    });
    expect(failRes.ok).toBe(false);
    expect(state.outboundOrders.find((o) => o.id === 'ord-a1')?.status).toBe('PACKED');
    expect(state.outboundOrders.find((o) => o.id === 'ord-a1')?.tms_job_id).toBeNull();
  });

  it('scopes ensureRmaForDamagedOrder return_orders lookup by org_id', async () => {
    state.returnOrders.push({
      id: 'rma-beta-1',
      org_id: 'tenant-beta',
      rma_no: 'RMA-BETA-001',
      order_no: 'ORD-2026-0001',
      status: 'REQUESTED',
      items_json: [],
    });

    // Tenant Alpha with colliding order_no ORD-2026-0001 must NOT match Tenant Beta's RMA
    const res = await ensureRmaForDamagedOrder({
      orderNo: 'ORD-2026-0001',
      customerName: 'Alpha Customer',
      orgId: 'tenant-alpha',
    });
    expect(res.ok).toBe(true);
    expect(res.alreadyExists).toBe(false);
    expect(state.returnOrders.filter((r) => r.org_id === 'tenant-alpha')).toHaveLength(1);
    expect(state.returnOrders).toHaveLength(2);
  });
});

describe('TASK-B04: WMS Endpoint Config & SSRF Validation', () => {
  it('disables TMS when TMS_API_URL or TMS_API_KEY are unset and rejects unsafe URLs', () => {
    vi.stubEnv('TMS_API_URL', '');
    vi.stubEnv('TMS_API_KEY', '');
    vi.stubEnv('TMS_APP_URL', '');
    vi.stubEnv('NEXT_PUBLIC_TMS_APP_URL', '');

    expect(isTmsEnabled()).toBe(false);
    expect(getTmsTrackingUrl('JOB-1')).toBe('');

    expect(validateIntegrationUrl('http://tms.example.com/api').valid).toBe(false);
    expect(validateIntegrationUrl('https://127.0.0.1/api').valid).toBe(false);
    expect(validateIntegrationUrl('https://10.0.0.5/api').valid).toBe(false);
    expect(validateIntegrationUrl('https://169.254.169.254/latest/meta-data').valid).toBe(false);
    expect(validateIntegrationUrl('https://192.168.1.10/api').valid).toBe(false);
    expect(validateIntegrationUrl('https://tms.tenant-alpha.example/api/external/v1/jobs').valid).toBe(true);
  });
});

describe('TASK-B05: WMS Notification Isolation', () => {
  it('isolates push subscriptions and expired cleanup strictly by orgId', async () => {
    await expect(
      saveSubscription(
        { endpoint: 'https://push.example/no-org', keys: { p256dh: 'k', auth: 'a' } },
        { orgId: '' }
      )
    ).rejects.toThrow(/orgId is required/);

    await saveSubscription(
      { endpoint: 'https://push.example/alpha-1', keys: { p256dh: 'ka1', auth: 'aa1' } },
      { orgId: 'tenant-alpha', userId: 'user-a1' }
    );
    await saveSubscription(
      { endpoint: 'https://push.example/beta-1', keys: { p256dh: 'kb1', auth: 'ab1' } },
      { orgId: 'tenant-beta', userId: 'user-b1' }
    );

    const alphaSubs = await getSubscriptions('tenant-alpha');
    expect(alphaSubs.map((s) => s.endpoint)).toEqual(['https://push.example/alpha-1']);

    // Tenant Alpha trying to remove Tenant Beta's endpoint must NOT delete Tenant Beta's row
    await removeSubscriptions(['https://push.example/beta-1'], 'tenant-alpha');
    expect(await getSubscriptions('tenant-beta')).toHaveLength(1);

    // sendWebPush with mocked VAPID keys isolates Tenant A vs Tenant B and cleans up 410 only for Tenant A
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'test-pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'test-priv');
    vi.resetModules();
    const { sendWebPush } = await import('@/lib/webPushSender');

    state.webPushFailStatusByEndpoint.set('https://push.example/alpha-1', 410);
    const pushRes = await sendWebPush({
      title: 'Alert',
      body: 'Sensitive details',
      orgId: 'tenant-alpha',
      redactLockScreen: true,
    });
    expect(pushRes.failed).toBe(1);
    expect(await getSubscriptions('tenant-alpha')).toHaveLength(0);
    expect(await getSubscriptions('tenant-beta')).toHaveLength(1);

    // Logout cleanup unbinds only user/org
    await saveSubscription(
      { endpoint: 'https://push.example/alpha-2', keys: { p256dh: 'ka2', auth: 'aa2' } },
      { orgId: 'tenant-alpha', userId: 'user-a2' }
    );
    await removeUserSubscriptionsOnLogout('tenant-alpha', 'user-a2');
    expect(await getSubscriptions('tenant-alpha')).toHaveLength(0);
    expect(await getSubscriptions('tenant-beta')).toHaveLength(1);
  });
});
