import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { state, mockSupabase } = vi.hoisted(() => {
  const s = {
    orgs: new Map<string, Record<string, any>>(),
    counters: new Map<string, number>(),
    sessionUser: null as any,
    currentOrgId: 'org-alpha',
  };

  function makeBuilder(table: string) {
    const filters: Array<{ op: string; col: string; val: unknown }> = [];
    let pendingUpdate: Record<string, unknown> | null = null;

    const applyFilters = (rows: any[]) =>
      rows.filter((row) =>
        filters.every((f) => {
          if (f.op === 'eq') return row[f.col] === f.val;
          return true;
        }),
      );

    const execute = async () => {
      if (table === 'organizations') {
        const rows = [...s.orgs.values()];
        const matched = applyFilters(rows);
        if (pendingUpdate) {
          for (const r of matched) {
            Object.assign(r, pendingUpdate);
          }
          return { data: matched, error: null };
        }
        return { data: matched.map((r) => ({ ...r })), error: null };
      }
      return { data: [], error: null };
    };

    const builder: any = {
      select: vi.fn(() => builder),
      update: vi.fn((patch: Record<string, unknown>) => {
        pendingUpdate = patch;
        return builder;
      }),
      eq: vi.fn((col: string, val: unknown) => {
        filters.push({ op: 'eq', col, val });
        return builder;
      }),
      like: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(async () => {
        const res = await execute();
        const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
        if (!first) return { data: null, error: { message: 'Not found' } };
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
    state: s,
    mockSupabase: {
      from: vi.fn((table: string) => makeBuilder(table)),
      rpc: vi.fn(async (_fn: string, args: { p_key: string; p_floor: number }) => {
        const next = Math.max(state.counters.get(args.p_key) || 0, args.p_floor || 0) + 1;
        state.counters.set(args.p_key, next);
        return { data: next, error: null };
      }),
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  getServiceSupabase: () => mockSupabase,
}));

vi.mock('@/lib/orgContext', () => ({
  getCurrentOrgId: vi.fn(async () => state.currentOrgId),
  DEFAULT_ORG: '00000000-0000-0000-0000-000000000001',
}));

vi.mock('@/lib/apiAuth', () => ({
  getSessionUser: vi.fn(async () => state.sessionUser),
  requireManagement: vi.fn(async () => {
    if (!state.sessionUser) {
      return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) };
    }
    return { user: state.sessionUser };
  }),
}));

vi.mock('@/lib/planAdmin', () => ({
  canEditPlan: vi.fn((u: any) => Boolean(u?.isPlatformAdmin)),
}));

vi.mock('@/lib/planLimits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/planLimits')>();
  return {
    ...actual,
    getPlanUsage: vi.fn(async () => ({ plan: 'PRO', limits: actual.PLAN_LIMITS.PRO, usage: { products: 0, users: 1, branches: 1 } })),
  };
});

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(async () => (state.sessionUser ? { user: state.sessionUser } : null)),
}));

vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/memberships', () => ({
  getOrgAccess: vi.fn(async () => ({ role: 'Admin', allowedBranches: ['*'] })),
}));

import {
  getOrg,
  toPublicOrgBranding,
  checkTenantSetupReadiness,
} from '@/lib/data/org';
import { GET as orgGet, PATCH as orgPatch } from '@/app/api/org/route';
import { nextDocNumber } from '@/lib/docNumber';
import {
  createDocumentSnapshot,
  resolveDocumentIssuer,
  issuePublicDocumentToken,
  verifyPublicDocumentToken,
} from '@/lib/documentSnapshot';
import {
  PACKAGE_COMBINATIONS,
  setTenantEntitlementForTests,
  clearEntitlementsForTests,
  resetEntitlementUsageForTests,
  getEntitlements,
  requireModule,
  checkAndReserveQuota,
  recordUsageEvent,
  getRecordedUsageEventsForTests,
} from '@/lib/entitlements';
import { createTmsDeliveryJob, createTmsConsolidatedTripJob } from '@/lib/tms';

const LEGACY_LEAK_RE = /ดีดี|DD Service|DD TRANSPORT|0745559001353|nexus-tms-six/;

describe('WMS Phase C & D: White-label, Snapshots, Scoped Sequences & Entitlements', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    state.orgs.clear();
    state.counters.clear();
    state.sessionUser = null;
    state.currentOrgId = 'org-alpha';
    clearEntitlementsForTests();
    delete process.env.WMS_PACKAGE;
    delete process.env.TMS_API_URL;
    delete process.env.TMS_API_KEY;
    delete process.env.TMS_DISABLED;

    state.orgs.set('org-alpha', {
      id: 'org-alpha',
      name: 'อัลฟ่า แวร์เฮาส์',
      slug: 'alpha',
      plan: 'PRO',
      branding_logo: 'https://cdn.example.com/alpha-wms.png',
      branding_color: '#0284c7',
      status: 'ACTIVE',
      legal_name: 'บริษัท อัลฟ่า โลจิสติกส์ จำกัด',
      legal_name_en: 'Alpha Logistics Co., Ltd.',
      tax_id: '0105560000011',
      tax_branch_code: '00000',
      address: '100 ถนนพระราม 3 กรุงเทพฯ 10120',
      phone: '02-999-1111',
      email: 'wms@alpha.example',
      bank_name: 'KBANK',
      bank_account_no: '111-2-33333-4',
      bank_account_name: 'Alpha Logistics',
      signatory_name: 'นายสมชาย อัลฟ่า',
      profile_version: 1,
    });

    state.orgs.set('org-unconfigured', {
      id: 'org-unconfigured',
      name: 'New Tenant WMS',
      slug: 'new-tenant',
      plan: 'FREE',
      branding_logo: '',
      branding_color: '#0ea5e9',
      status: 'ACTIVE',
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearEntitlementsForTests();
    delete process.env.WMS_PACKAGE;
    delete process.env.TMS_API_URL;
    delete process.env.TMS_API_KEY;
    delete process.env.TMS_DISABLED;
  });

  it('TASK-C01 & C03: strips private tax/bank/signatory fields from public /api/org & checks setup readiness', async () => {
    // Unauthenticated GET /api/org returns public branding ONLY
    const unauthRes = await orgGet(new Request('http://localhost/api/org'));
    expect(unauthRes.status).toBe(200);
    const unauthJson = await unauthRes.json();
    expect(unauthJson.name).toBe('อัลฟ่า แวร์เฮาส์');
    expect(unauthJson.brandingLogo).toBe('https://cdn.example.com/alpha-wms.png');
    for (const privateField of ['taxId', 'bankName', 'bankAccountNo', 'bankAccountName', 'signatoryName']) {
      expect(privateField in unauthJson).toBe(false);
    }

    // Authenticated GET /api/org?mode=public also strips private fields
    state.sessionUser = { id: 'U-1', orgId: 'org-alpha', role: 'Admin', isPlatformAdmin: false };
    const pubModeRes = await orgGet(new Request('http://localhost/api/org?mode=public'));
    const pubModeJson = await pubModeRes.json();
    expect('taxId' in pubModeJson).toBe(false);
    expect('bankAccountNo' in pubModeJson).toBe(false);

    // Authenticated full GET /api/org returns legal profile & setupComplete
    const fullRes = await orgGet(new Request('http://localhost/api/org'));
    const fullJson = await fullRes.json();
    expect(fullJson.legalName).toBe('บริษัท อัลฟ่า โลจิสติกส์ จำกัด');
    expect(fullJson.taxId).toBe('0105560000011');
    expect(fullJson.setupComplete).toBe(true);
    expect(LEGACY_LEAK_RE.test(JSON.stringify(fullJson))).toBe(false);

    // Unconfigured org fails readiness check & snapshot creation
    const unconfiguredOrg = await getOrg('org-unconfigured');
    const readiness = checkTenantSetupReadiness(unconfiguredOrg);
    expect(readiness.ready).toBe(false);
    expect(readiness.missingFields).toEqual(['legalName', 'taxId', 'address']);
    expect(() =>
      createDocumentSnapshot({
        tenantId: 'org-unconfigured',
        documentType: 'DELIVERY_NOTE',
        documentNo: 'ORD-001',
        issuerProfile: unconfiguredOrg,
      }),
    ).toThrow(/SETUP_REQUIRED/);

    // Tenant admin cannot change plan, nor update another orgId, and invalid taxId is rejected
    const badTax = await orgPatch(new Request('http://localhost/api/org', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taxId: '123' }),
    }));
    expect(badTax.status).toBe(400);

    const planEscalation = await orgPatch(new Request('http://localhost/api/org', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'ENTERPRISE' }),
    }));
    expect(planEscalation.status).toBe(403);

    const alphaBranding = toPublicOrgBranding((await getOrg('org-alpha'))!);
    expect('taxId' in alphaBranding).toBe(false);
    expect('bankAccountNo' in alphaBranding).toBe(false);
  });

  it('TASK-C04 & C05: freezes issued snapshot across profile edits, isolates doc numbers per orgId & verifies public tokens', async () => {
    const orgAlphaV1 = await getOrg('org-alpha');
    const snapshot = createDocumentSnapshot({
      tenantId: 'org-alpha',
      documentType: 'DELIVERY_NOTE',
      documentNo: 'ORD-261118-001',
      issuerProfile: orgAlphaV1,
    });
    expect(snapshot.issuer.legalName).toBe('บริษัท อัลฟ่า โลจิสติกส์ จำกัด');
    expect(snapshot.issuer.taxId).toBe('0105560000011');
    expect(snapshot.contentHash).toMatch(/^[0-9a-f]{64}$/);

    // Update live org profile to v2
    state.sessionUser = { id: 'U-1', orgId: 'org-alpha', role: 'Admin', isPlatformAdmin: false };
    const patchRes = await orgPatch(new Request('http://localhost/api/org', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        legalName: 'บริษัท เบต้า ซัพพลายเชน จำกัด',
        taxId: '0105560000029',
      }),
    }));
    expect(patchRes.status).toBe(200);
    const updatedOrg = await getOrg('org-alpha');
    expect(updatedOrg?.legalName).toBe('บริษัท เบต้า ซัพพลายเชน จำกัด');

    // Already-issued document keeps original v1 issuer
    const resolved = resolveDocumentIssuer(
      { status: 'DELIVERED', issued_snapshot: snapshot },
      updatedOrg!,
    );
    expect((resolved as any).legalName).toBe('บริษัท อัลฟ่า โลจิสติกส์ จำกัด');
    expect((resolved as any).taxId).toBe('0105560000011');

    // Per-org atomic doc numbering: Tenant A and Tenant B each get ORD-261118-001
    const fixedDate = new Date('2026-11-18T05:00:00Z');
    const numA1 = await nextDocNumber('ORD', { orgId: 'org-alpha', now: fixedDate });
    const numA2 = await nextDocNumber('ORD', { orgId: 'org-alpha', now: fixedDate });
    const numB1 = await nextDocNumber('ORD', { orgId: 'org-beta', now: fixedDate });
    expect(numA1).toBe('ORD-261118-001');
    expect(numA2).toBe('ORD-261118-002');
    expect(numB1).toBe('ORD-261118-001');

    // Public document token checks
    const now = 1_700_000_000_000;
    const token = issuePublicDocumentToken({
      tenantId: 'org-alpha',
      documentType: 'qc_handover',
      documentId: 'ORD-261118-001',
      ttlSeconds: 120,
      now,
    });
    expect(
      verifyPublicDocumentToken(token, {
        expectedTenantId: 'org-alpha',
        expectedDocumentType: 'qc_handover',
        expectedDocumentId: 'ORD-261118-001',
        now: now + 30_000,
      }).valid,
    ).toBe(true);
    expect(
      verifyPublicDocumentToken(token + 'tamper', {
        expectedTenantId: 'org-alpha',
        expectedDocumentId: 'ORD-261118-001',
        now,
      }).valid,
    ).toBe(false);
    expect(
      verifyPublicDocumentToken(token, {
        expectedTenantId: 'org-alpha',
        expectedDocumentId: 'ORD-261118-001',
        now: now + 121_000,
      }).error,
    ).toBe('TOKEN_EXPIRED');
    expect(
      verifyPublicDocumentToken(token, {
        expectedTenantId: 'org-beta',
        expectedDocumentId: 'ORD-261118-001',
        now,
      }).error,
    ).toBe('TENANT_MISMATCH');
  });

  it('TASK-D01, D02 & D03: 7-package matrix, lifecycle drain/suspend, cache TTL, concurrency quota & zero TMS calls', async () => {
    for (const [pkg, expectedMods] of Object.entries(PACKAGE_COMBINATIONS)) {
      setTenantEntitlementForTests('org-alpha', { packageCode: pkg as any, state: 'active' });
      for (const mod of ['hr', 'wms', 'tms'] as const) {
        if (expectedMods.includes(mod)) {
          const ent = await requireModule('org-alpha', mod, 'create');
          expect(ent.packageCode).toBe(pkg);
        } else {
          await expect(requireModule('org-alpha', mod, 'create')).rejects.toMatchObject({
            code: 'MODULE_NOT_SUBSCRIBED',
            status: 403,
          });
        }
      }
    }

    // Lifecycle: grace blocks create, allows drain_in_flight & export
    setTenantEntitlementForTests('org-alpha', { packageCode: 'WMS_ONLY', state: 'grace' });
    await expect(requireModule('org-alpha', 'wms', 'create')).rejects.toMatchObject({
      code: 'MODULE_IN_GRACE_DRAIN',
      status: 403,
    });
    await expect(requireModule('org-alpha', 'wms', 'drain_in_flight')).resolves.toBeTruthy();
    await expect(requireModule('org-alpha', 'wms', 'export')).resolves.toBeTruthy();

    // Suspended / cancelled: blocks create & drain_in_flight, allows read & export
    for (const s of ['suspended', 'cancelled'] as const) {
      setTenantEntitlementForTests('org-alpha', { packageCode: 'WMS_ONLY', state: s });
      await expect(requireModule('org-alpha', 'wms', 'create')).rejects.toMatchObject({ status: 403 });
      await expect(requireModule('org-alpha', 'wms', 'drain_in_flight')).rejects.toMatchObject({ status: 403 });
      await expect(requireModule('org-alpha', 'wms', 'read')).resolves.toBeTruthy();
      await expect(requireModule('org-alpha', 'wms', 'export')).resolves.toBeTruthy();
    }

    // Offline cache TTL expiry
    clearEntitlementsForTests();
    const baseNow = 1_700_000_000_000;
    process.env.WMS_PACKAGE = 'WMS_ONLY';
    await getEntitlements('org-cache-test', { now: baseNow });
    const cached = await getEntitlements('org-cache-test', { now: baseNow + 4 * 60_000, useCacheOnly: true });
    expect(cached.packageCode).toBe('WMS_ONLY');
    await expect(
      getEntitlements('org-cache-test', { now: baseNow + 6 * 60_000, useCacheOnly: true }),
    ).rejects.toMatchObject({ code: 'ENTITLEMENT_CACHE_EXPIRED' });
    delete process.env.WMS_PACKAGE;

    // Concurrent quota reservation race guard: limit=2, 5 concurrent creates -> 2 pass, 3 rejected
    resetEntitlementUsageForTests();
    setTenantEntitlementForTests('org-alpha', {
      packageCode: 'WMS_ONLY',
      state: 'active',
      quotas: { products: 2 },
    });
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, idx) =>
        checkAndReserveQuota('org-alpha', 'products', async () => 0, {
          module: 'wms',
          eventId: `wms-evt-${idx}`,
          database: null,
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(3);

    // Idempotent usage metering
    const u1 = recordUsageEvent({ tenantId: 'org-alpha', module: 'wms', resource: 'products', eventId: 'idemp-1', delta: 1 });
    const u2 = recordUsageEvent({ tenantId: 'org-alpha', module: 'wms', resource: 'products', eventId: 'idemp-1', delta: 1 });
    expect(u1.deduplicated).toBe(false);
    expect(u2.deduplicated).toBe(true);
    expect(getRecordedUsageEventsForTests('org-alpha').filter((e) => e.eventId === 'idemp-1')).toHaveLength(1);

    // Upgrade & downgrade preserves org without duplicating
    setTenantEntitlementForTests('org-alpha', { packageCode: 'WMS_TMS', state: 'active' });
    setTenantEntitlementForTests('org-alpha', { packageCode: 'WMS_ONLY', state: 'active' });
    expect(state.orgs.size).toBe(2);

    // TASK-D03: WMS_ONLY and HR_WMS make ZERO outbound fetch calls to TMS even if TMS_API_URL is set
    process.env.TMS_API_URL = 'https://tms.example.com/api/external/v1/jobs';
    process.env.TMS_API_KEY = 'dummy-key';
    const fetchSpy = vi.fn(async () => {
      throw new Error('Should not call outbound fetch when TMS module is not subscribed');
    });
    globalThis.fetch = fetchSpy as any;

    const fakeOrder: any = {
      id: 'ord-1',
      orgId: 'org-alpha',
      orderNo: 'ORD-261118-001',
      customerName: 'Alpha Customer',
      carrier: 'รถขนส่งบริษัท',
      shipAddress: 'Bangkok',
      items: [{ sku: 'SKU-1', name: 'Item 1', qty: 1 }],
      totalQty: 1,
      status: 'SHIPPED',
    };

    for (const pkg of ['WMS_ONLY', 'HR_WMS'] as const) {
      setTenantEntitlementForTests('org-alpha', { packageCode: pkg, state: 'active' });
      const singleRes = await createTmsDeliveryJob(fakeOrder);
      expect(singleRes.skipped).toBe(true);
      expect(singleRes.error).toBe('tms-module-not-subscribed');

      const tripRes = await createTmsConsolidatedTripJob({
        tripId: 'TRIP-1',
        orgId: 'org-alpha',
        orders: [fakeOrder],
      });
      expect(tripRes.skipped).toBe(true);
      expect(tripRes.error).toBe('tms-module-not-subscribed');
    }
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});
