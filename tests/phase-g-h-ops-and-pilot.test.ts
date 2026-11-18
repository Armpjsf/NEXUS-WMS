import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { dbState, mockSupabase } = vi.hoisted(() => {
  const s = {
    organizations: [] as Array<Record<string, any>>,
    branches: [] as Array<Record<string, any>>,
    app_users: [] as Array<Record<string, any>>,
    warehouse_locations: [] as Array<Record<string, any>>,
    products: [] as Array<Record<string, any>>,
    stock_locations: [] as Array<Record<string, any>>,
    push_subscriptions: [] as Array<Record<string, any>>,
    failOnTableInsert: null as string | null,
    orgSeq: 1,
  };

  function getTable(table: string): Array<Record<string, any>> {
    if (table === 'organizations') return s.organizations;
    if (table === 'branches') return s.branches;
    if (table === 'app_users') return s.app_users;
    if (table === 'warehouse_locations') return s.warehouse_locations;
    if (table === 'products') return s.products;
    if (table === 'stock_locations') return s.stock_locations;
    if (table === 'push_subscriptions') return s.push_subscriptions;
    return [];
  }

  function makeBuilder(table: string) {
    const filters: Array<{ op: string; col: string; val: unknown }> = [];
    let pendingInsert: any[] | null = null;
    let isDelete = false;
    let rangeBounds: [number, number] | null = null;

    const applyFilters = (rows: Array<Record<string, any>>) =>
      rows.filter((r) =>
        filters.every((f) => {
          if (f.op === 'eq') return r[f.col] === f.val;
          if (f.op === 'ilike') {
            return String(r[f.col] ?? '').toLowerCase() === String(f.val ?? '').toLowerCase();
          }
          return true;
        }),
      );

    const execute = async () => {
      const target = getTable(table);
      if (pendingInsert) {
        if (s.failOnTableInsert === table) {
          return { data: null, error: { message: `Injected insert failure on ${table}` } };
        }
        const inserted = pendingInsert.map((row) => {
          const copy = { ...row };
          if (table === 'organizations' && !copy.id) {
            copy.id = `org-${s.orgSeq++}`;
          }
          target.push(copy);
          return copy;
        });
        return { data: inserted, error: null };
      }

      if (isDelete) {
        const remaining = target.filter((r) => !applyFilters([r]).length);
        target.length = 0;
        target.push(...remaining);
        return { data: null, error: null };
      }

      let matched = applyFilters(target);
      if (rangeBounds) {
        matched = matched.slice(rangeBounds[0], rangeBounds[1] + 1);
      }
      return { data: matched, error: null };
    };

    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push({ op: 'eq', col, val });
        return builder;
      },
      ilike: (col: string, val: unknown) => {
        filters.push({ op: 'ilike', col, val });
        return builder;
      },
      limit: () => builder,
      range: (from: number, to: number) => {
        rangeBounds = [from, to];
        return execute();
      },
      insert: (rows: any) => {
        pendingInsert = Array.isArray(rows) ? rows : [rows];
        return builder;
      },
      delete: () => {
        isDelete = true;
        return builder;
      },
      maybeSingle: async () => {
        const res = await execute();
        return { data: res.data?.[0] ?? null, error: res.error };
      },
      single: async () => {
        const res = await execute();
        return { data: res.data?.[0] ?? null, error: res.error };
      },
      then: (resolve: (v: any) => void, reject?: (e: any) => void) =>
        execute().then(resolve, reject),
    };

    return builder;
  }

  return {
    dbState: s,
    mockSupabase: {
      from: (table: string) => makeBuilder(table),
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  getServiceSupabase: () => mockSupabase,
}));

vi.mock('@/lib/stockLocations', () => ({
  resetBinsBulk: vi.fn(async () => {}),
}));

import {
  onboardOrganization,
  clearOnboardingIdempotencyCacheForTests,
} from '@/lib/data/onboarding';
import {
  runTenantProvisioning,
  clearProvisioningStateForTests,
} from '@/lib/provisioning';
import {
  computeMigrationChecksum,
  verifyMigrationLedger,
  planProvenanceBackfill,
} from '@/lib/migrationRunner';
import {
  createWmsOrgLogicalBackup,
  restoreWmsOrgBackupIsolated,
} from '@/lib/backupRestore';
import {
  grantSupportAccessToken,
  verifySupportAccess,
  initiateTenantExitExport,
  clearOpsPrivacySupportForTests,
} from '@/lib/opsPrivacySupport';
import {
  getOfflineQueueKey,
  enqueue,
  flushQueue,
  queueLength,
  clearOfflineStateOnLogout,
} from '@/lib/offlineQueue';
import { shouldSyncPendingTransaction } from '@/hooks/useOfflineSync';
import {
  createPlatformSubscriptionInvoice,
  clearCommercialControlForTests,
} from '@/lib/commercialControl';

describe('Phase G & Phase H (WMS): Provisioning, Migrations, Backup/Restore, Ops, Offline Scope & Commercial Control', () => {
  beforeEach(() => {
    dbState.organizations.length = 0;
    dbState.branches.length = 0;
    dbState.app_users.length = 0;
    dbState.warehouse_locations.length = 0;
    dbState.products.length = 0;
    dbState.stock_locations.length = 0;
    dbState.push_subscriptions.length = 0;
    dbState.failOnTableInsert = null;
    dbState.orgSeq = 1;
    clearOnboardingIdempotencyCacheForTests();
    clearProvisioningStateForTests();
    clearOpsPrivacySupportForTests();
    clearCommercialControlForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TASK-G01: onboardOrganization rolls back org + HQ branch on admin_user failure, skips demo SKUs by default, and resumes idempotently', async () => {
    // 1) Failure on app_users insert MUST roll back organizations + branches and NEVER return ok: true
    dbState.failOnTableInsert = 'app_users';
    const failRes = await onboardOrganization({
      orgName: 'Broken Org',
      slug: 'broken-org',
      adminUsername: 'admin1',
      adminPassword: 'Password123',
    });

    expect(failRes.ok).toBe(false);
    expect(failRes.stepFailed).toBe('admin_user');
    expect(failRes.rolledBack).toBe(true);
    expect(dbState.organizations.length).toBe(0);
    expect(dbState.branches.length).toBe(0);
    expect(dbState.app_users.length).toBe(0);

    // 2) Production onboarding with seedDemo omitted/false MUST NOT seed SKU-0001..0003
    dbState.failOnTableInsert = null;
    const prodRes = await onboardOrganization({
      orgName: 'Alpha Warehouse',
      slug: 'alpha-wh',
      adminUsername: 'alpha_admin',
      adminPassword: 'Password123',
      legalName: 'Alpha Warehouse Co., Ltd.',
      taxId: '0105561112222',
      idempotencyKey: 'idem-alpha-1',
    });

    expect(prodRes.ok).toBe(true);
    expect(prodRes.seededDemo).toBe(false);
    expect(dbState.organizations.length).toBe(1);
    expect(dbState.branches.length).toBe(1);
    expect(dbState.app_users.length).toBe(1);
    expect(dbState.products.length).toBe(0);
    expect(dbState.warehouse_locations.length).toBe(0);

    // 3) Simulate incomplete prior org (has org + HQ branch, missing admin user) and resume
    dbState.organizations.push({ id: 'org-partial', name: 'Partial Co', slug: 'partial-co', plan: 'FREE', status: 'ACTIVE' });
    dbState.branches.push({ org_id: 'org-partial', code: 'HQ', name: 'HQ' });

    const resumeRes = await onboardOrganization({
      orgName: 'Partial Co',
      slug: 'partial-co',
      adminUsername: 'partial_admin',
      adminPassword: 'Password123',
      resumeIfIncomplete: true,
    });

    expect(resumeRes.ok).toBe(true);
    expect(resumeRes.resumed).toBe(true);
    expect(dbState.branches.filter((b) => b.org_id === 'org-partial').length).toBe(1);
    expect(dbState.app_users.filter((u) => u.org_id === 'org-partial').length).toBe(1);

    // 4) Suite provisioning state machine resumes without duplicating tenant/binding
    let createCount = 0;
    let inviteCount = 0;
    const p1 = await runTenantProvisioning({
      tenantId: 'tenant-wms-1',
      idempotencyKey: 'key-1',
      orgName: 'WMS Tenant 1',
      adminUsername: 'admin@wms.test',
      handlers: {
        create_tenant_and_binding: () => { createCount++; },
        invite_first_admin: () => {
          inviteCount++;
          if (inviteCount === 1) throw new Error('Simulated failure');
        },
      },
    });
    expect(p1.ok).toBe(false);
    expect(p1.failedStep).toBe('invite_first_admin');

    const p2 = await runTenantProvisioning({
      tenantId: 'tenant-wms-1',
      idempotencyKey: 'key-1',
      orgName: 'WMS Tenant 1',
      adminUsername: 'admin@wms.test',
      handlers: {
        create_tenant_and_binding: () => { createCount++; },
        invite_first_admin: () => { inviteCount++; },
      },
    });
    expect(p2.ok).toBe(true);
    expect(p2.resumed).toBe(true);
    expect(createCount).toBe(1);
  });

  it('TASK-G02: migration ledger detects drift & planProvenanceBackfill quarantines ambiguous rows', () => {
    const sql1 = 'CREATE TABLE IF NOT EXISTS demo (id INT);';
    const sql2 = 'ALTER TABLE demo ADD COLUMN org_id TEXT;';
    const files = [
      { version: '001', name: '001_demo.sql', content: sql1 },
      { version: '002', name: '002_scope.sql', content: sql2 },
    ];
    const applied = [
      { version: '001', checksum: computeMigrationChecksum(sql1), status: 'applied' },
    ];
    const pendingRes = verifyMigrationLedger(applied, files);
    expect(pendingRes.ok).toBe(false);
    expect(pendingRes.pending.map((p) => p.version)).toEqual(['002']);

    const driftRes = verifyMigrationLedger(
      [
        { version: '001', checksum: 'tampered-hash', status: 'applied' },
        { version: '002', checksum: computeMigrationChecksum(sql2), status: 'applied' },
      ],
      files,
    );
    expect(driftRes.hasDrift).toBe(true);
    expect(driftRes.canProceed).toBe(false);

    const plan = planProvenanceBackfill(
      [
        { id: 'row-proven', user_id: 'u-alpha' },
        { id: 'row-ambiguous', candidateTenantIds: ['org-alpha', 'org-beta'] },
        { id: 'row-missing' },
      ],
      {
        validTenantIds: ['org-alpha', 'org-beta'],
        userTenantMap: { 'u-alpha': 'org-alpha' },
      },
    );
    expect(plan.mapped).toHaveLength(1);
    expect(plan.mapped[0].resolvedTenantId).toBe('org-alpha');
    expect(plan.quarantine).toHaveLength(2);
    expect(plan.quarantine.map((q) => q.reason)).toEqual(['AMBIGUOUS_PROVENANCE', 'MISSING_PROVENANCE']);
  });

  it('TASK-G03: paginated WMS backup redacts secrets & isolated restore preserves Org B while reconciling stock === sum(bins)', async () => {
    for (let i = 1; i <= 5; i++) {
      dbState.products.push({
        org_id: 'org-alpha',
        sku: `SKU-A-${i}`,
        name: `Item ${i}`,
        stock: 10,
      });
      dbState.stock_locations.push(
        { org_id: 'org-alpha', sku: `SKU-A-${i}`, bin_code: 'A-01', quantity: 4 },
        { org_id: 'org-alpha', sku: `SKU-A-${i}`, bin_code: 'A-02', quantity: 6 },
      );
    }
    dbState.app_users.push({
      id: 'u-a1',
      org_id: 'org-alpha',
      username: 'alpha',
      password_hash: '$2b$10$realSecretHashShouldBeRedacted',
    });
    dbState.push_subscriptions.push({
      id: 'push-a1',
      org_id: 'org-alpha',
      endpoint: 'https://push.example.com/sub-alpha',
      active: true,
    });

    const backup = await createWmsOrgLogicalBackup('org-alpha', {
      tables: ['products', 'stock_locations', 'app_users', 'push_subscriptions'],
      pageSize: 2, // forces 3 paginated loops over 5 products!
    });

    expect(backup.tables.products).toHaveLength(5);
    expect(backup.tableManifest.products.rowCount).toBe(5);
    expect(String(backup.tables.app_users[0].password_hash)).toMatch(/^\[REDACTED_SECRET_REF:/);

    const targetStore = {
      tables: {
        products: [{ org_id: 'org-beta', sku: 'SKU-B-1', name: 'Beta Product', stock: 99 }],
        stock_locations: [{ org_id: 'org-beta', sku: 'SKU-B-1', bin_code: 'B-01', quantity: 99 }],
        app_users: [{ id: 'u-b1', org_id: 'org-beta', username: 'beta' }],
        push_subscriptions: [{ id: 'push-b1', org_id: 'org-beta', endpoint: 'https://push.example.com/sub-beta', active: true }],
      },
      quarantinedEndpoints: [],
    };

    const restoreRes = restoreWmsOrgBackupIsolated(backup, targetStore, { targetOrgId: 'org-alpha' });
    expect(restoreRes.ok).toBe(true);
    expect(restoreRes.reconciledSkus).toBe(5);
    expect(restoreRes.quarantinedOutboundCount).toBe(1);

    // Org B untouched
    expect(targetStore.tables.products.filter((p) => p.org_id === 'org-beta')).toHaveLength(1);
    expect(targetStore.tables.products.find((p) => p.org_id === 'org-beta')?.stock).toBe(99);
    // Org A push subscription quarantined
    const restoredPushA = targetStore.tables.push_subscriptions.find((p) => p.org_id === 'org-alpha');
    expect(restoredPushA?.quarantined).toBe(true);
    expect(restoredPushA?.active).toBe(false);
  });

  it('TASK-G04 & TASK-H03: support access TTL/audit, tenant exit statutory preservation & commercial issuer separation', () => {
    const grant = grantSupportAccessToken({
      tenantId: 'org-alpha',
      supportActorId: 'ops-1',
      reason: 'Verify inventory ledger discrepancy INC-42',
      ttlMinutes: 15,
      nowMs: 1_000_000,
    });
    expect(verifySupportAccess(grant.token, { tenantId: 'org-alpha', nowMs: 1_100_000 }).authorized).toBe(true);
    expect(() => verifySupportAccess(grant.token, { tenantId: 'org-alpha', nowMs: 2_000_000 })).toThrow(/expired/);

    const exitStore = {
      statutoryDocuments: [{ id: 'inv-1', orgId: 'org-alpha', total: 5000 }],
      pushSubscriptions: [{ id: 'p-1', orgId: 'org-alpha', active: true }],
      integrationCredentials: [{ id: 'k-1', orgId: 'org-alpha', status: 'active' }],
      tenantLifecycle: { state: 'active' },
    };
    const exitRes = initiateTenantExitExport({ tenantId: 'org-alpha', actorId: 'ops-1', store: exitStore });
    expect(exitRes.autoDeletedStatutoryDocuments).toBe(false);
    expect(exitRes.retainedStatutoryDocumentsCount).toBe(1);

    expect(() =>
      createPlatformSubscriptionInvoice({
        actor: { id: 'wms-admin', role: 'Super Admin', isTenantScoped: true },
        contract: { contractId: 'C-1', tenantId: 'org-alpha' },
        platformVendorEntity: { entityId: 'PLAT', legalName: 'Platform Co', taxId: '0001' },
        tenantLegalEntity: { entityId: 'TEN-A', tenantId: 'org-alpha', legalName: 'Alpha Co', taxId: '0002' },
        billingItems: [{ code: 'WMS', unitAmountMinor: 500000 }],
      }),
    ).toThrow(/cannot modify platform contracts/);
  });

  it('TASK-G05 (WMS): offline queue namespaces by orgId+userId and blocks User B from replaying User A actions', async () => {
    const memStorage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memStorage.get(k) ?? null,
      setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
      removeItem: (k: string) => { memStorage.delete(k); },
    });
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const scopeA = { orgId: 'org-alpha', userId: 'user-a' };
    const scopeB = { orgId: 'org-alpha', userId: 'user-b' };
    const keyA = getOfflineQueueKey(scopeA);
    const keyB = getOfflineQueueKey(scopeB);
    expect(keyA).toBe('wms_offline_queue_v2:org-alpha:user-a');
    expect(keyB).toBe('wms_offline_queue_v2:org-alpha:user-b');
    expect(keyA).not.toBe(keyB);

    enqueue('/api/orders/ready', { orderId: 'ORD-A1' }, scopeA);
    expect(queueLength(scopeA)).toBe(1);
    expect(queueLength(scopeB)).toBe(0);

    // Simulate even a poisoned/tampered item from User A inside User B's queue key
    memStorage.set(
      keyB,
      JSON.stringify([{ id: 'poison-1', path: '/api/orders/ready', body: { orderId: 'ORD-A1' }, ts: 1, orgId: 'org-alpha', userId: 'user-a' }]),
    );

    const sentUnderB = await flushQueue((p) => p, scopeB);
    expect(sentUnderB).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    // User A flushes their own queue
    const sentUnderA = await flushQueue((p) => p, scopeA);
    expect(sentUnderA).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Logout cleanup clears User A's queue
    enqueue('/api/orders/ready', { orderId: 'ORD-A2' }, scopeA);
    clearOfflineStateOnLogout(scopeA);
    expect(queueLength(scopeA)).toBe(0);

    // Dexie PendingTransaction scope guard
    expect(shouldSyncPendingTransaction({ orgId: 'org-alpha', userId: 'user-a' }, scopeB)).toBe(false);
    expect(shouldSyncPendingTransaction({ orgId: 'org-alpha', userId: 'user-a' }, { orgId: 'org-beta', userId: 'user-a' })).toBe(false);
    expect(shouldSyncPendingTransaction({ orgId: 'org-alpha', userId: 'user-a' }, scopeA)).toBe(true);
  });
});
