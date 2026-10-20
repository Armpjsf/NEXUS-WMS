
import { NextResponse } from 'next/server';
import { getCycleCountLogs, addCycleCountEntry, type CycleCountRecord } from '@/lib/data/wms';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { requireManagement } from '@/lib/apiAuth';
import { nextDocNumber } from '@/lib/docNumber';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await getCycleCountLogs();
    
    // Sort by Date Descending (Newest First)
    records.sort((a, b) => {
        const dateA = new Date(a.count_date).getTime();
        const dateB = new Date(b.count_date).getTime();
        return dateB - dateA;
    });

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cycle count logs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await req.json();

    const isBatch = Array.isArray(body.items);
    const rawItems: any[] = isBatch ? body.items : [body];

    if (rawItems.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const batchDate = body.date || new Date().toISOString().split('T')[0];
    const batchNote = body.note || body.notes || '';
    const batchInspector = body.inspector || 'System';

    let processedCount = 0;
    let adjustmentsCreated = 0;
    let lastVariance = 0;
    let anyVariance = false;

    for (const item of rawItems) {
      const productName = item.product_name || item.name || item.sku || item.id || item.product_id;
      const sku = item.sku || item.id || item.product_id || productName;
      const rawActual = item.actual_qty ?? item.actualQty ?? item.actualStock;

      if (!productName || rawActual === undefined || rawActual === '') {
        if (!isBatch) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        continue;
      }

      const sysQty = parseFloat(String(item.system_qty ?? item.systemQty ?? item.systemStock ?? 0)) || 0;
      const actQty = parseFloat(String(rawActual)) || 0;
      const variance = actQty - sysQty;
      const status = variance === 0 ? 'Match' : 'Discrepancy';
      const loc = item.location || body.location || '-';
      const inspector = item.inspector || batchInspector;
      const varianceReason = item.variance_reason || body.variance_reason;
      const photoUrl = item.photo_url || body.photo_url;

      let fullNotes = item.notes || batchNote || '';
      if (varianceReason) {
        fullNotes = fullNotes ? `${fullNotes} | Reason: ${varianceReason}` : `Reason: ${varianceReason}`;
      }
      if (photoUrl) {
        fullNotes = fullNotes ? `${fullNotes} | Photo: ${photoUrl}` : `Photo: ${photoUrl}`;
      }

      const newRecord: CycleCountRecord = {
        product_name: productName,
        location: loc,
        due_date: batchDate,
        count_date: batchDate,
        inspector,
        notes: fullNotes,
        system_qty: sysQty,
        actual_qty: actQty,
        variance,
        status,
      };

      const success = await addCycleCountEntry(newRecord);
      if (success) {
        processedCount++;
        lastVariance = variance;
        if (variance !== 0) {
          anyVariance = true;
          try {
            const requestNo = await nextDocNumber('ADJ', {
              date: 'yyyymmdd',
              pad: 4,
              existing: { table: 'stock_adjustment_requests', column: 'request_no' },
            });
            const { error: adjErr } = await supabase.from('stock_adjustment_requests').insert({
              org_id: orgId,
              request_no: requestNo,
              sku: sku || productName,
              product_name: productName,
              location_code: loc || 'Unassigned',
              system_qty: sysQty,
              counted_qty: actQty,
              reason_code: 'CYCLE_COUNT_DISCREPANCY',
              notes: fullNotes || `Cycle Count (${batchDate})`,
              requested_by: inspector,
              status: 'PENDING_APPROVAL',
            });
            if (!adjErr) {
              adjustmentsCreated++;
            }
          } catch (adjException) {
            console.warn('Cycle count adjustment forwarding fallback:', adjException);
          }
        }
      }
    }

    if (processedCount > 0) {
      return NextResponse.json({
        success: true,
        count: processedCount,
        adjustmentsCreated,
        message: 'Count recorded successfully',
        variance: lastVariance,
        has_variance: anyVariance,
      });
    } else {
      return NextResponse.json({ error: 'Failed to record count' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error recording cycle count:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const guard = await requireManagement();
    if (guard.error) return guard.error;

    // Clear all cycle count log rows
    const orgId = await getCurrentOrgId();
    const { error } = await supabase
      .from('cycle_count_logs')
      .delete()
      .eq('org_id', orgId);

    if (error) {
      console.error('Error clearing cycle count log:', error);
      return NextResponse.json({ error: 'Failed to clear log' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Cycle Count Log cleared successfully' });
  } catch (error) {
    console.error('Error clearing cycle count log:', error);
    return NextResponse.json({ error: 'Failed to clear log' }, { status: 500 });
  }
}
