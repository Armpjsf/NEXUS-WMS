import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recommendPutaway } from '@/lib/putawayEngine';
import { binMove, getBins } from '@/lib/stockLocations';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const STAGING_BINS = new Set(['RCV-DOCK', 'RECEIVING-DOCK', 'RECEIVING', 'STAGING', 'UNASSIGNED', 'Unassigned']);

export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku') || 'SKU-GENERAL';
    const qty = Number(searchParams.get('qty') || 1);
    const weight = Number(searchParams.get('weight') || 2.5);

    const [recommendation, bins] = await Promise.all([
      recommendPutaway({ sku, quantity: qty, weightKg: weight }),
      getBins(orgId, sku),
    ]);

    const stagingBin = bins.find(b => STAGING_BINS.has(b.binCode) && b.quantity > 0);
    const fromBin = stagingBin?.binCode || bins.find(b => b.quantity > 0)?.binCode || bins[0]?.binCode || 'RCV-DOCK';

    return NextResponse.json({
      success: true,
      data: {
        ...recommendation,
        fromBin,
        currentBins: bins,
      },
      bins,
      fromBin,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { sku, fromBin, toBin, qty, taskId, lotNo } = body;

    if (!sku || !toBin) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ SKU และพิกัดปลายทาง (toBin)' }, { status: 400 });
    }

    const targetBin = String(toBin).trim().toUpperCase();
    const moveQty = Math.max(1, Number(qty) || 1);
    let actualFromBin = String(fromBin || 'RCV-DOCK').trim();

    let moveResult = await binMove(orgId, sku, actualFromBin, targetBin, moveQty);

    // Fallback: if no units were in actualFromBin (e.g. legacy SKU seeded in UNASSIGNED or products.location),
    // relocate from the SKU's current primary bin so total stock is never double-counted.
    if (moveResult.moved === 0) {
      const currentBins = await getBins(orgId, sku);
      const fallbackSource =
        currentBins.find(b => STAGING_BINS.has(b.binCode) && b.binCode !== targetBin && b.quantity > 0)?.binCode ||
        currentBins.find(b => b.binCode !== targetBin && b.quantity > 0)?.binCode ||
        currentBins[0]?.binCode ||
        'UNASSIGNED';

      if (fallbackSource && fallbackSource !== targetBin) {
        actualFromBin = fallbackSource;
        moveResult = await binMove(orgId, sku, fallbackSource, targetBin, moveQty);
      }
    }

    // Complete associated PUTAWAY task if present
    try {
      if (taskId) {
        await supabase
          .from('warehouse_tasks')
          .update({
            status: 'COMPLETED',
            completed_qty: moveQty,
            target_location: targetBin,
            completed_at: new Date().toISOString(),
          })
          .eq('id', taskId)
          .eq('org_id', orgId);
      } else {
        const { data: pendingTasks } = await supabase
          .from('warehouse_tasks')
          .select('id')
          .eq('org_id', orgId)
          .eq('task_type', 'PUTAWAY')
          .eq('sku', sku)
          .neq('status', 'COMPLETED')
          .order('created_at', { ascending: true })
          .limit(1);

        if (pendingTasks && pendingTasks.length > 0) {
          await supabase
            .from('warehouse_tasks')
            .update({
              status: 'COMPLETED',
              completed_qty: moveQty,
              target_location: targetBin,
              completed_at: new Date().toISOString(),
            })
            .eq('id', pendingTasks[0].id)
            .eq('org_id', orgId);
        }
      }
    } catch (taskErr) {
      console.warn('Putaway task status update warning:', taskErr);
    }

    try {
      await recordEnterpriseAudit({
        orgId,
        action: 'UPDATE',
        entityName: 'stock_locations',
        entityId: sku,
        beforeState: { fromBin: actualFromBin, qty: moveQty },
        afterState: { toBin: targetBin, moved: moveResult.moved, total: moveResult.total, lotNo: lotNo || undefined },
        performedBy: 'Mobile Operator',
        reason: `Putaway bin move for ${sku}: ${moveQty} units from ${actualFromBin} -> ${targetBin}`,
      });
    } catch {
      /* non-fatal audit */
    }

    return NextResponse.json({
      success: true,
      moved: moveResult.moved,
      total: moveResult.total,
      fromBin: actualFromBin,
      toBin: targetBin,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}
