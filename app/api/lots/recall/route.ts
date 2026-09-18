import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';

export const dynamic = 'force-dynamic';

// C1 — Lot recall.
// POST { sku, lot, action?: 'RECALL' | 'CLEAR' }  (default RECALL)
//   flags the lot and returns the affected customers/orders so ops can notify them.
export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { sku, lot, action = 'RECALL' } = await request.json();
    if (!sku || !lot) return NextResponse.json({ error: 'ระบุ sku และ lot' }, { status: 400 });
    const admin = getServiceSupabase();
    const recalled = action !== 'CLEAR';

    await admin.from('product_lots')
      .update({ recalled, recalled_at: recalled ? new Date().toISOString() : null })
      .eq('org_id', orgId).eq('sku', sku).eq('lot_number', lot);

    // gather who received this lot (for the recall notice)
    const out = await fetchAllRows((f, t) => admin.from('lot_movements')
      .select('doc_ref, party, qty, created_at').eq('org_id', orgId).eq('sku', sku).eq('lot_number', lot).eq('direction', 'OUT').range(f, t));
    const byRecipient = new Map<string, { docRef: string; party: string; qty: number }>();
    for (const m of out) {
      const key = `${m.doc_ref || ''}|${m.party || ''}`;
      const cur = byRecipient.get(key) || { docRef: m.doc_ref || '', party: m.party || '', qty: 0 };
      cur.qty += Number(m.qty || 0);
      byRecipient.set(key, cur);
    }
    const affected = Array.from(byRecipient.values()).sort((a, b) => b.qty - a.qty);

    await recordEnterpriseAudit({
      orgId, action: 'UPDATE', entityName: 'product_lots', entityId: `${sku}/${lot}`,
      afterState: { recalled, affectedRecipients: affected.length },
      performedBy: 'system', reason: `${recalled ? 'RECALL' : 'CLEAR recall'} lot ${lot} of ${sku} — ${affected.length} recipient(s)`,
    });

    return NextResponse.json({
      success: true, sku, lot, recalled,
      message: recalled
        ? `เรียกคืนล็อต ${lot} แล้ว — กระทบ ${affected.length} ผู้รับ`
        : `ยกเลิกการเรียกคืนล็อต ${lot} แล้ว`,
      affected,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
