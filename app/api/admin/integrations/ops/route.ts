import { NextResponse } from 'next/server';
import { requireTenantContext, TenantContextError } from '@/lib/tenantContext';
import { requireModule, EntitlementError } from '@/lib/entitlements';
import { isManagementRole } from '@/lib/rbac';
import {
  getIntegrationOperationsSummary,
  retryDeadLetterEvents,
  runDryRunReconciliation,
  applyReconciliationRepair,
  IntegrationOpsError,
} from '@/lib/integrationOps';

export const dynamic = 'force-dynamic';

export async function GET() {
  let ctx;
  try {
    ctx = await requireTenantContext();
    if (!isManagementRole(ctx.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await requireModule(ctx, 'wms', 'read');
  } catch (err) {
    if (err instanceof TenantContextError || err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const summary = await getIntegrationOperationsSummary(ctx);
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireTenantContext();
    if (!isManagementRole(ctx.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await requireModule(ctx, 'wms', 'reconcile');
  } catch (err) {
    if (err instanceof TenantContextError || err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body?.action || '').trim();
  try {
    if (action === 'retry_dead_letter') {
      const result = await retryDeadLetterEvents(ctx, {
        eventIds: body.eventIds,
        actorId: ctx.userId,
      });
      return NextResponse.json({ success: true, ...result });
    }
    if (action === 'reconcile_dry_run') {
      const report = runDryRunReconciliation(ctx, {
        sourceItems: body.sourceItems || [],
        localItems: body.localItems || [],
      });
      return NextResponse.json({ success: true, ...report });
    }
    if (action === 'reconcile_repair') {
      const result = await applyReconciliationRepair(ctx, {
        approvedIds: body.approvedIds || [],
        actorId: ctx.userId,
        drifts: body.drifts || [],
      });
      return NextResponse.json({ success: true, ...result });
    }
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err) {
    if (err instanceof IntegrationOpsError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Integration ops failed' },
      { status: 500 },
    );
  }
}
