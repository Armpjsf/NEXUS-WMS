import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// C1 — Lot traceability.
// GET /api/lots/trace?sku=ABC&lot=LOT-A
//   forward trace: every movement of that lot, and the customers/orders (OUT)
//   that received it — the recall list.
export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const lot = searchParams.get('lot');
    if (!sku || !lot) return NextResponse.json({ success: false, error: 'ระบุ sku และ lot' }, { status: 400 });

    const admin = getServiceSupabase();
    const [{ data: lotRow }, moves] = await Promise.all([
      admin.from('product_lots').select('*').eq('org_id', orgId).eq('sku', sku).eq('lot_number', lot).maybeSingle(),
      fetchAllRows((f, t) => admin.from('lot_movements').select('*')
        .eq('org_id', orgId).eq('sku', sku).eq('lot_number', lot)
        .order('created_at', { ascending: false }).range(f, t)),
    ]);

    const out = moves.filter((m: any) => m.direction === 'OUT');
    // affected recipients: group OUT by doc_ref/party
    const recipientsMap = new Map<string, { docRef: string; party: string; qty: number; lastAt: string }>();
    for (const m of out) {
      const key = `${m.doc_ref || ''}|${m.party || ''}`;
      const cur = recipientsMap.get(key) || { docRef: m.doc_ref || '', party: m.party || '', qty: 0, lastAt: m.created_at };
      cur.qty += Number(m.qty || 0);
      recipientsMap.set(key, cur);
    }

    return NextResponse.json({
      success: true, sku, lot,
      lotInfo: lotRow ? { lotNumber: lotRow.lot_number, expDate: lotRow.exp_date, currentQty: Number(lotRow.current_qty || 0), recalled: !!lotRow.recalled } : null,
      totals: {
        received: moves.filter((m: any) => m.direction === 'IN').reduce((s: number, m: any) => s + Number(m.qty || 0), 0),
        shipped: out.reduce((s: number, m: any) => s + Number(m.qty || 0), 0),
      },
      recipients: Array.from(recipientsMap.values()).sort((a, b) => b.qty - a.qty),
      movements: moves,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}
