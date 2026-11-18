import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { state, mockSupabase } = vi.hoisted(() => {
  const s = {
    session: null as any,
    orgAccess: null as any,
    currentOrgId: 'org-alpha',
    products: [] as any[],
    stockLocations: [] as any[],
    stockTransactions: [] as any[],
    productLots: [] as any[],
    lotMovements: [] as any[],
    stockReservations: [] as any[],
    receipts: [] as any[],
    outboundOrders: [] as any[],
    returnOrders: [] as any[],
    stockAdjustments: [] as any[],
    purchaseOrders: [] as any[],
    warehouseTasks: [] as any[],
    auditLogs: [] as any[],
    enterpriseAuditLogs: [] as any[],
    thirdPartyClients: [] as any[],
    integrationOutbox: [] as any[],
    integrationInbox: [] as any[],
    integrationAttempts: [] as any[],
    docCounters: new Map<string, number>(),
  };

  function makeBuilder(table: string) {
    const filters: Array<{ op: string; col: string; val: unknown }> = [];
    let pendingInsert: any[] | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;
    let isDelete = false;
    let maxRows: number | null = null;
    let orderCol: string | null = null;
    let orderAsc = true;

    const getRows = () => {
      switch (table) {
        case 'products': return s.products;
        case 'stock_locations': return s.stockLocations;
        case 'stock_transactions': return s.stockTransactions;
        case 'product_lots': return s.productLots;
        case 'lot_movements': return s.lotMovements;
        case 'stock_reservations': return s.stockReservations;
        case 'receipts': return s.receipts;
        case 'outbound_orders': return s.outboundOrders;
        case 'return_orders': return s.returnOrders;
        case 'stock_adjustment_requests': return s.stockAdjustments;
        case 'purchase_orders': return s.purchaseOrders;
        case 'warehouse_tasks': return s.warehouseTasks;
        case 'audit_log': return s.auditLogs;
        case 'enterprise_audit_logs': return s.enterpriseAuditLogs;
        case 'third_party_clients': return s.thirdPartyClients;
        case 'integration_outbox': return s.integrationOutbox;
        case 'integration_inbox': return s.integrationInbox;
        case 'integration_attempts': return s.integrationAttempts;
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
        for (const r of pendingInsert) {
          if ((table === 'integration_outbox' || table === 'integration_inbox') &&
              rows.some((ex) => ex.connection_id === r.connection_id && ex.event_id === r.event_id)) {
            return { data: null, error: { code: '23505', message: 'duplicate key value' } };
          }
        }
        const inserted = pendingInsert.map((r, i) => ({
          id: r.id || `${table}-${rows.length + i + 1}`,
          created_at: r.created_at || new Date().toISOString(),
          ...r,
        }));
        rows.push(...inserted);
        return { data: inserted, error: null };
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
        for (const r of matched) {
          Object.assign(r, pendingUpdate);
        }
        return { data: matched.map((r) => ({ ...r })), error: null };
      }

      return { data: matched.map((r) => ({ ...r })), error: null };
    };

    const builder: any = {
      select: vi.fn(() => builder),
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
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
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
      rpc: vi.fn(async (fn: string, args: any) => {
        // Model the installed atomic domain RPC; event-backed webhooks no longer
        // accept a missing RPC and non-transactional JS fallback as success.
        if (fn === 'apply_wms_tms_pod_target_atomic') {
          const order = s.outboundOrders.find((row) => row.org_id === args.p_tenant_id &&
            (args.p_order_id ? row.id === args.p_order_id : row.order_no === args.p_order_no));
          if (!order) {
            return { data: { ok: false, outcome: 'not_found', notFound: true, orderKey: args.p_order_no || 'UNKNOWN' }, error: null };
          }
          const alreadyDelivered = order.status === 'DELIVERED';
          if (!alreadyDelivered) {
            order.tms_status = args.p_status;
            if (args.p_is_completed) order.status = 'DELIVERED';
          }
          if (args.p_has_incidents && !s.returnOrders.some((r) => r.org_id === order.org_id && r.order_no === order.order_no)) {
            s.returnOrders.push({ org_id: order.org_id, order_no: order.order_no, status: 'REQUESTED', disposition: 'QUARANTINE' });
          }
          return { data: {
            ok: true, outcome: alreadyDelivered ? 'skipped_idempotent' : 'applied',
            idempotent: alreadyDelivered, orderKey: order.order_no, orderId: order.id,
          }, error: null };
        }
        if (fn === 'next_doc_number') {
          const next = Math.max(s.docCounters.get(args.p_key) || 0, args.p_floor || 0) + 1;
          s.docCounters.set(args.p_key, next);
          return { data: next, error: null };
        }
        return { data: null, error: { code: '42883', message: 'function does not exist' } };
      }),
    },
  };
});

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => state.session),
}));
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(async () => state.session),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/memberships', () => ({
  getOrgAccess: vi.fn(async () => state.orgAccess),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  getServiceSupabase: vi.fn(() => mockSupabase),
}));
vi.mock('@/lib/orgContext', () => ({
  getCurrentOrgId: vi.fn(async () => state.currentOrgId),
  requireCurrentOrgId: vi.fn(async () => state.currentOrgId),
  DEFAULT_ORG: '00000000-0000-0000-0000-000000000001',
}));

import {
  CONTRACT_VERSION,
  validateEnvelope,
  ExternalEntityLinkStore,
  parseLegacyWmsNotesForBackfillOnly,
} from '@/lib/contracts/integrationContracts';
import {
  signWebhookPayload,
  verifyWebhookSignature,
  IntegrationOutboxInboxStore,
  enqueueOutboxEvent,
  claimOutboxBatch,
  processOutboxBatch,
  receiveAndApplyInboxEvent,
  defaultOutboxInboxStore,
} from '@/lib/integrationOutboxInbox';
import {
  createTmsDeliveryJob,
  reconcileTimedOutTmsDispatch,
} from '@/lib/tms';
import {
  createDeliveryTrip,
  applyTmsPodToWmsOrders,
} from '@/lib/data/orders';
import { POST as tmsWebhookPost } from '@/app/api/webhooks/tms/route';
import { POST as adjustmentPost } from '@/app/api/adjustments/route';
import { POST as adjustmentApprovePost } from '@/app/api/adjustments/approve/route';
import { GET as threePlClientsGet } from '@/app/api/3pl/clients/route';
import { POST as opsPost, GET as opsGet } from '@/app/api/admin/integrations/ops/route';
import { createReceipt, commitReceipt } from '@/lib/data/receipts';
import { binConsume, getBins } from '@/lib/stockLocations';
import { reserveForOrder, getAvailable } from '@/lib/reservations';
import { calculateSShapePickPath } from '@/lib/picking';
import { txDelta } from '@/lib/ledger';
import { clearEntitlementsForTests, setTenantEntitlementForTests } from '@/lib/entitlements';
import {
  clearIntegrationOpsForTests,
  runDryRunReconciliation,
  applyReconciliationRepair,
} from '@/lib/integrationOps';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  state.session = {
    user: { id: '1', name: 'Admin Alpha', role: 'Admin', orgId: 'org-alpha', allowedBranches: ['*'] },
  };
  state.orgAccess = { orgId: 'org-alpha', role: 'Admin', allowedBranches: ['*'] };
  state.currentOrgId = 'org-alpha';
  state.products = [];
  state.stockLocations = [];
  state.stockTransactions = [];
  state.productLots = [];
  state.lotMovements = [];
  state.stockReservations = [];
  state.receipts = [];
  state.outboundOrders = [];
  state.returnOrders = [];
  state.stockAdjustments = [];
  state.purchaseOrders = [];
  state.warehouseTasks = [];
  state.auditLogs = [];
  state.enterpriseAuditLogs = [];
  state.thirdPartyClients = [];
  state.integrationOutbox = [];
  state.integrationInbox = [];
  state.integrationAttempts = [];
  state.docCounters.clear();
  defaultOutboxInboxStore.clear();
  clearEntitlementsForTests();
  clearIntegrationOpsForTests();
  setTenantEntitlementForTests('org-alpha', { packageCode: 'FULL_SUITE', state: 'active' });
  vi.unstubAllEnvs();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe('TASK-E01 & TASK-E02: WMS Contracts, HMAC Rotation & Outbox/Inbox Guarantees', () => {
  it('validates v2 envelopes, enforces external link tenant isolation, and guarantees outbox/inbox semantics', async () => {
    expect(CONTRACT_VERSION).toBe('2.0.0');
    expect(
      validateEnvelope({
        event_id: 'evt-wms-1',
        connection_id: 'conn-alpha',
        source_product: 'wms',
        target_product: 'tms',
        event_type: 'dispatch.created',
        schema_version: '2.0.0',
        aggregate_id: 'ORD-001',
        aggregate_version: 1,
        occurred_at: '2026-11-18T10:00:00+07:00',
        correlation_id: 'corr-1',
        tenant_claim: 'org-alpha',
        payload: { job_id: 'JOB-001' },
      }).valid,
    ).toBe(true);

    const links = new ExternalEntityLinkStore();
    links.linkExternalEntity({
      tenantId: 'org-alpha',
      connectionId: 'conn-alpha',
      sourceSystem: 'wms',
      sourceType: 'outbound_order',
      sourceId: 'ORD-001',
      targetSystem: 'tms',
      targetType: 'job',
      targetId: 'JOB-001',
    });
    expect(() =>
      links.resolveExternalEntity({
        tenantId: 'org-beta',
        connectionId: 'conn-alpha',
        sourceSystem: 'wms',
        sourceType: 'outbound_order',
        sourceId: 'ORD-001',
      }),
    ).toThrow(/cross-tenant/i);
    expect(parseLegacyWmsNotesForBackfillOnly('[WMS: ORD-001]').backfillOnly).toBe(true);

    // Key rotation & replay window
    const body = JSON.stringify({ ok: true });
    const sigHeaders = signWebhookPayload(body, 'rot-secret-2', 'key-2', 1_700_000_000);
    expect(
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: sigHeaders['x-nexus-signature'],
        timestampHeader: sigHeaders['x-nexus-timestamp'],
        keyIdHeader: sigHeaders['x-nexus-key-id'],
        secretsByKeyId: { 'key-1': 'rot-secret-1', 'key-2': 'rot-secret-2' },
        nowSec: 1_700_000_060,
      }).valid,
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: sigHeaders['x-nexus-signature'],
        timestampHeader: sigHeaders['x-nexus-timestamp'],
        keyIdHeader: sigHeaders['x-nexus-key-id'],
        secretsByKeyId: { 'key-2': 'rot-secret-2' },
        nowSec: 1_700_000_500,
      }).valid,
    ).toBe(false);

    const store = new IntegrationOutboxInboxStore();
    enqueueOutboxEvent(
      {
        eventId: 'out-1',
        tenantId: 'org-alpha',
        connectionId: 'conn-alpha',
        aggregateId: 'ORD-1',
        payload: { orderNo: 'ORD-1' },
        nowMs: 1000,
      },
      store,
    );
    const outRes = await processOutboxBatch(
      {
        workerId: 'wms-w1',
        nowMs: 1000,
        maxAttempts: 2,
        deliverFn: async () => ({ ok: false, httpStatus: 400, error: 'Invalid schema token=secret_abc' }),
      },
      store,
    );
    expect(outRes.results[0].status).toBe('failed_permanent');
    expect(String(outRes.results[0].lastErrorRedacted)).not.toContain('secret_abc');

    // Crash recovery
    enqueueOutboxEvent(
      {
        eventId: 'out-2',
        tenantId: 'org-alpha',
        connectionId: 'conn-alpha',
        aggregateId: 'ORD-2',
        payload: { orderNo: 'ORD-2' },
        nowMs: 1000,
      },
      store,
    );
    const rec2 = store.outbox.get('conn-alpha::out-2')!;
    rec2.status = 'processing';
    rec2.leaseExpiresAt = 2000;
    const claimed = claimOutboxBatch({ workerId: 'wms-w2', nowMs: 2500 }, store);
    expect(claimed.map((c) => c.eventId)).toEqual(['out-2']);

    // Inbox persistence failure -> 500
    const failInbox = await receiveAndApplyInboxEvent(
      {
        connectionId: 'conn-alpha',
        tenantId: 'org-alpha',
        eventId: 'in-fail',
        aggregateId: 'ORD-1',
        aggregateVersion: 1,
        payload: { a: 1 },
        persistInboxFn: async () => {
          throw new Error('DB write failed');
        },
      },
      store,
    );
    expect(failInbox.httpStatus).toBe(500);
  });
});

describe('TASK-E03 & TASK-E04: WMS <-> TMS Dispatch Reconciliation, Per-Drop POD, Idempotent RMA & Stale Status Guard', () => {
  it('reconciles timed-out dispatch without duplicate job creation and queues unrecovered failures to outbox', async () => {
    vi.stubEnv('TMS_API_URL', 'https://tms.example.com/api/external/v1/jobs');
    vi.stubEnv('TMS_API_KEY', 'tms-key-alpha');

    let postCalls = 0;
    globalThis.fetch = vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        postCalls++;
        expect((init.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
        throw new Error('AbortError: Request timed out');
      }
      if (url.includes('job_id=JOB-2026-0001')) {
        return new Response(
          JSON.stringify({
            success: true,
            job: { job_id: 'JOB-2026-0001', status: 'New', is_completed: false, tracking_url: 'https://tms.example.com/track/JOB-2026-0001' },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }) as any;

    const res = await createTmsDeliveryJob({
      id: 'ord-1',
      orgId: 'org-alpha',
      orderNo: 'ORD-2026-0001',
      channel: 'DIRECT',
      refNo: '',
      customerName: 'Alpha Customer',
      phone: '0811111111',
      shipAddress: 'Bangkok',
      branchCode: 'HQ',
      carrier: 'รถขนส่งบริษัท',
      trackingNo: '',
      status: 'SHIPPED',
      items: [{ sku: 'SKU-1', name: 'Box A', qty: 2 }],
      totalQty: 2,
      totalAmount: 500,
      createdBy: 'staff',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(postCalls).toBe(1);
    expect(res.ok).toBe(true);
    expect(res.reconciled).toBe(true);
    expect(res.dispatchState).toBe('accepted');
    expect(res.jobId).toBe('JOB-2026-0001');

    // Genuine outage -> queued into WMS outbox with dispatchState='failed'
    const reconMiss = await reconcileTimedOutTmsDispatch({ targetJobId: 'JOB-MISSING', orderNo: 'ORD-MISSING' });
    expect(reconMiss.existsInTms).toBe(false);

    globalThis.fetch = vi.fn(async () => new Response('Service Unavailable', { status: 503 })) as any;
    const failRes = await createTmsDeliveryJob({
      id: 'ord-2',
      orgId: 'org-alpha',
      orderNo: 'ORD-2026-0002',
      channel: 'DIRECT',
      refNo: '',
      customerName: 'Alpha Customer',
      phone: '0811111111',
      shipAddress: 'Bangkok',
      branchCode: 'HQ',
      carrier: 'รถขนส่งบริษัท',
      trackingNo: '',
      status: 'SHIPPED',
      items: [{ sku: 'SKU-1', name: 'Box A', qty: 1 }],
      totalQty: 1,
      totalAmount: 250,
      createdBy: 'staff',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(failRes.ok).toBe(false);
    expect(failRes.dispatchState).toBe('failed');
    expect(failRes.queuedOutboxEventId).toBeTruthy();
  });

  it('closes only completed Drop 1 without closing Drop 2, rejects stale In Transit, deduplicates RMA, and isolates unknown orders', async () => {
    vi.stubEnv('TMS_WEBHOOK_SECRET', 'wh-secret-v1');

    state.outboundOrders.push(
      {
        id: 'ord-a1',
        org_id: 'org-alpha',
        order_no: 'ORD-2026-0101',
        branch_code: 'HQ',
        status: 'PACKED',
        customer_name: 'Customer Drop 1',
        items_json: [{ sku: 'SKU-1', name: 'Item 1', qty: 2 }],
        total_qty: 2,
      },
      {
        id: 'ord-a2',
        org_id: 'org-alpha',
        order_no: 'ORD-2026-0102',
        branch_code: 'HQ',
        status: 'PACKED',
        customer_name: 'Customer Drop 2',
        items_json: [{ sku: 'SKU-2', name: 'Item 2', qty: 1 }],
        total_qty: 1,
      },
      {
        id: 'ord-beta-1',
        org_id: 'org-beta',
        order_no: 'ORD-BETA-999',
        branch_code: 'HQ',
        status: 'SHIPPED',
        customer_name: 'Beta Customer',
        items_json: [],
        total_qty: 1,
      },
    );

    // Create consolidated trip (TMS disabled -> standalone/disconnected gracefully)
    vi.stubEnv('TMS_DISABLED', 'true');
    const tripRes = await createDeliveryTrip({
      orderIds: ['ord-a1', 'ord-a2'],
      tripId: 'TRIP-2026-01',
      orgId: 'org-alpha',
      allowedBranches: ['HQ'],
    });
    expect(tripRes.ok).toBe(true);
    expect(tripRes.orderCount).toBe(2);

    // Per-drop POD webhook: Drop 1 Delivered (with damage incident), Drop 2 still In Transit, plus unknown order ORD-BETA-999 (must NOT resolve across org-beta!)
    const podEnvelope = {
      event_id: 'evt-pod-drop1',
      connection_id: 'conn-tms-wms-alpha',
      source_product: 'tms',
      target_product: 'wms',
      event_type: 'drop.completed',
      schema_version: '2.0.0',
      aggregate_id: 'TRIP-2026-01',
      aggregate_version: 2,
      occurred_at: '2026-11-18T11:00:00+07:00',
      correlation_id: 'corr-pod-1',
      tenant_claim: 'org-alpha',
      payload: {
        event: 'drop.completed',
        job_id: 'TRIP-2026-01',
        status: 'In Transit',
        is_completed: false,
        driver_name: 'สมชาย',
        vehicle_plate: '70-1234',
        drops: [
          {
            drop_index: 1,
            wms_order_id: 'ord-a1',
            wms_order_no: 'ORD-2026-0101',
            status: 'Delivered',
            signature_url: 'https://cdn.example.com/sig1.png',
            has_incidents: true,
            incidents: [{ category: 'Damaged Box', description: 'Corner crushed' }],
          },
          {
            drop_index: 2,
            wms_order_id: 'ord-a2',
            wms_order_no: 'ORD-2026-0102',
            status: 'In Transit',
          },
          {
            drop_index: 3,
            wms_order_no: 'ORD-BETA-999',
            status: 'Delivered',
          },
        ],
      },
    };

    const rawBody = JSON.stringify(podEnvelope);
    const sigHeaders = signWebhookPayload(rawBody, 'wh-secret-v1', 'key-v1');
    const webhookRes = await tmsWebhookPost(
      new Request('https://wms.test/api/webhooks/tms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...sigHeaders },
        body: rawBody,
      }),
    );
    expect(webhookRes.status).toBe(200);
    const webhookBody = await webhookRes.json();
    expect(webhookBody.applied).toContain('ORD-2026-0101');
    expect(webhookBody.unmappedReviewQueue).toContain('ORD-BETA-999');

    // Drop 1 is DELIVERED, Drop 2 is still SHIPPED, Beta order untouched!
    expect(state.outboundOrders.find((o) => o.id === 'ord-a1')!.status).toBe('DELIVERED');
    expect(state.outboundOrders.find((o) => o.id === 'ord-a2')!.status).toBe('SHIPPED');
    expect(state.outboundOrders.find((o) => o.id === 'ord-beta-1')!.status).toBe('SHIPPED');
    // Exactly 1 Quarantine RMA created for damaged Drop 1
    expect(state.returnOrders).toHaveLength(1);
    expect(state.returnOrders[0].disposition).toBe('QUARANTINE');

    // Duplicate webhook with same event_id -> 200 duplicate_ignored, no extra RMA
    const dupRes = await tmsWebhookPost(
      new Request('https://wms.test/api/webhooks/tms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...sigHeaders },
        body: rawBody,
      }),
    );
    expect(dupRes.status).toBe(200);
    expect((await dupRes.json()).inboxStatus).toBe('duplicate_ignored');
    expect(state.returnOrders).toHaveLength(1);

    // Payload mismatch on same event_id -> 409 conflict
    const mismatchBody = JSON.stringify({
      ...podEnvelope,
      payload: { ...podEnvelope.payload, driver_name: 'TAMPERED' },
    });
    const mismatchHeaders = signWebhookPayload(mismatchBody, 'wh-secret-v1', 'key-v1');
    const mismatchRes = await tmsWebhookPost(
      new Request('https://wms.test/api/webhooks/tms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mismatchHeaders },
        body: mismatchBody,
      }),
    );
    expect(mismatchRes.status).toBe(409);

    // Out-of-order late 'In Transit' status on already DELIVERED Drop 1 must NOT revert status
    const staleDirect = await applyTmsPodToWmsOrders({
      orgId: 'org-alpha',
      tmsJobId: 'TRIP-2026-01',
      wmsOrderNo: 'ORD-2026-0101',
      status: 'In Transit',
      isCompleted: false,
    });
    expect(staleDirect.skippedIdempotent).toContain('ORD-2026-0101');
    expect(state.outboundOrders.find((o) => o.id === 'ord-a1')!.status).toBe('DELIVERED');
  });
});

describe('TASK-F03 & TASK-E06: WMS End-to-End Inventory Invariants, Concurrency, Cycle Count & Integration Ops', () => {
  it('maintains stock === sum(bins) === ledger net across receipt, concurrent pick, maker-checker adjust, and ops reconciliation', async () => {
    // 1. Inbound receipt + lot/bin putaway
    const rcv = await createReceipt({
      poNumber: 'PO-100',
      supplier: 'Supplier A',
      items: [{ sku: 'SKU-100', name: 'Widget X', expectedQty: 10, putawayBin: 'A-01-01-1', lotNo: 'LOT-01' }],
    });
    expect(rcv).not.toBeNull();
    await commitReceipt(rcv!.id, [
      { sku: 'SKU-100', name: 'Widget X', expectedQty: 10, receivedQty: 10, putawayBin: 'A-01-01-1', lotNo: 'LOT-01', expDate: '2027-12-31' },
    ]);

    const prodAfterRcv = state.products.find((p) => p.sku === 'SKU-100' && p.org_id === 'org-alpha');
    const binsAfterRcv = await getBins('org-alpha', 'SKU-100');
    const binSumAfterRcv = binsAfterRcv.reduce((s, b) => s + b.quantity, 0);
    const ledgerNetAfterRcv = state.stockTransactions
      .filter((t) => t.sku === 'SKU-100' && t.org_id === 'org-alpha')
      .reduce((s, t) => s + txDelta(t.type, t.qty), 0);

    expect(prodAfterRcv.stock).toBe(10);
    expect(binSumAfterRcv).toBe(10);
    expect(ledgerNetAfterRcv).toBe(10);

    // 2. Reservation & wave S-shape pick path
    const resv = await reserveForOrder('org-alpha', 'ord-w1', 'ORD-W1', [{ sku: 'SKU-100', qty: 4 }]);
    expect(resv.hasBackorder).toBe(false);
    expect(await getAvailable('org-alpha', 'SKU-100')).toBe(6);

    const wavePath = calculateSShapePickPath([
      { sku: 'SKU-100', location: 'A-02-01-1', qty: 1 },
      { sku: 'SKU-100', location: 'A-01-01-1', qty: 3 },
    ]);
    expect(wavePath[0].location).toBe('A-01-01-1');

    // 3. Concurrent pick race protection: two concurrent consumes of 6 from 10 available must never go negative
    const [pick1, pick2] = await Promise.all([
      binConsume('org-alpha', 'SKU-100', 6, { docRef: 'ORD-W1' }),
      binConsume('org-alpha', 'SKU-100', 6, { docRef: 'ORD-W2' }),
    ]);
    const totalTaken =
      pick1.taken.reduce((s, t) => s + t.quantity, 0) +
      pick2.taken.reduce((s, t) => s + t.quantity, 0);
    expect(totalTaken).toBeLessThanOrEqual(10);

    const prodAfterPick = state.products.find((p) => p.sku === 'SKU-100' && p.org_id === 'org-alpha');
    const binSumAfterPick = (await getBins('org-alpha', 'SKU-100')).reduce((s, b) => s + b.quantity, 0);
    expect(prodAfterPick.stock).toBeGreaterThanOrEqual(0);
    expect(prodAfterPick.stock).toBe(binSumAfterPick);

    // 4. Cycle count / maker-checker adjustment
    const adjCreateRes = await adjustmentPost(
      new Request('https://wms.test/api/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'SKU-100',
          productName: 'Widget X',
          locationCode: 'A-01-01-1',
          systemQty: prodAfterPick.stock,
          countedQty: 7,
          reasonCode: 'CYCLE_COUNT',
          requestedBy: 'Checker 1',
        }),
      }),
    );
    expect(adjCreateRes.status).toBe(200);
    const adjReqNo = (await adjCreateRes.json()).data.requestNo;

    const adjApproveRes = await adjustmentApprovePost(
      new Request('https://wms.test/api/adjustments/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: adjReqNo, action: 'APPROVE', approvedBy: 'Manager Alpha' }),
      }),
    );
    expect(adjApproveRes.status).toBe(200);
    const prodAfterAdj = state.products.find((p) => p.sku === 'SKU-100' && p.org_id === 'org-alpha');
    const binSumAfterAdj = (await getBins('org-alpha', 'SKU-100')).reduce((s, b) => s + b.quantity, 0);
    expect(prodAfterAdj.stock).toBe(7);
    expect(binSumAfterAdj).toBe(7);

    // 5. Integration Operations Center summary & dry-run reconciliation
    const opsSummaryRes = await opsGet();
    expect(opsSummaryRes.status).toBe(200);
    const dryRun = runDryRunReconciliation(
      { orgId: 'org-alpha' },
      {
        sourceItems: [{ id: 'ORD-1', status: 'Delivered' }],
        localItems: [{ id: 'ORD-1', status: 'SHIPPED' }],
      },
    );
    expect(dryRun.driftCount).toBe(1);
    const repaired = await applyReconciliationRepair(
      { orgId: 'org-alpha', role: 'Admin', userId: '1' },
      { approvedIds: ['ORD-1'], actorId: '1', drifts: dryRun.drifts },
    );
    expect(repaired.repaired).toEqual(['ORD-1']);

    const opsApiDryRun = await opsPost(
      new Request('https://wms.test/api/admin/integrations/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile_dry_run',
          sourceItems: [{ id: 'ORD-2', status: 'Delivered' }],
          localItems: [],
        }),
      }),
    );
    expect(opsApiDryRun.status).toBe(200);
    expect((await opsApiDryRun.json()).driftCount).toBe(1);

    // 6. 3PL owner scope isolation
    state.thirdPartyClients.push(
      { id: 'cli-a', org_id: 'org-alpha', client_code: 'OWN-A', client_name: 'Owner Alpha', status: 'ACTIVE' },
      { id: 'cli-b', org_id: 'org-beta', client_code: 'OWN-B', client_name: 'Owner Beta', status: 'ACTIVE' },
    );
    const tplRes = await threePlClientsGet();
    expect(tplRes.status).toBe(200);
    const tplJson = await tplRes.json();
    expect(tplJson.clients).toHaveLength(1);
    expect(tplJson.clients[0].clientCode).toBe('OWN-A');
  });
});
