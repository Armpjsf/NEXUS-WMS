import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { errorMessage } from '@/lib/errors';
import { deriveHistoricalLots, HISTORICAL_LOT } from '@/lib/lotHistory';

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

    // Historical RCV-YYYYMMDD lots predate lot_movements — replay the ledger
    // with the same FIFO the lot-building script used (lib/lotHistory).
    if (moves.length === 0 && HISTORICAL_LOT.test(lot)) {
      const txs = await fetchAllRows((f, t) => admin.from('stock_transactions')
        .select('type, qty, created_at, doc_ref')
        .eq('org_id', orgId).eq('sku', sku).in('type', ['IN', 'OUT', 'DAMAGE'])
        .order('created_at', { ascending: true }).range(f, t));
      const derived = deriveHistoricalLots(
        txs.filter((t: any) => t.type === 'IN'),
        txs.filter((t: any) => t.type !== 'IN'),
      ).get(lot);
      const shippedRows = (derived?.consumed || []).filter(c => c.type === 'OUT');

      // Customer per document: orders are linked by order_no or the legacy ref_no.
      const refs = [...new Set(shippedRows.map(c => c.docRef).filter(Boolean))];
      const party = new Map<string, string>();
      if (refs.length) {
        const [byNo, byRef] = await Promise.all([
          admin.from('outbound_orders').select('order_no, ref_no, customer_name').eq('org_id', orgId).in('order_no', refs),
          admin.from('outbound_orders').select('order_no, ref_no, customer_name').eq('org_id', orgId).in('ref_no', refs),
        ]);
        for (const o of [...(byNo.data || []), ...(byRef.data || [])]) {
          if (o.order_no) party.set(o.order_no, o.customer_name || '');
          if (o.ref_no) party.set(o.ref_no, o.customer_name || '');
        }
      }
      const recipients = new Map<string, { docRef: string; party: string; qty: number; lastAt: string }>();
      for (const c of shippedRows) {
        const cur = recipients.get(c.docRef) || { docRef: c.docRef, party: party.get(c.docRef) || '', qty: 0, lastAt: c.at };
        cur.qty += c.qty;
        if (c.at > cur.lastAt) cur.lastAt = c.at;
        recipients.set(c.docRef, cur);
      }

      return NextResponse.json({
        success: true, sku, lot, source: 'ledger-fifo',
        lotInfo: lotRow ? { lotNumber: lotRow.lot_number, expDate: lotRow.exp_date, currentQty: Number(lotRow.current_qty || 0), recalled: !!lotRow.recalled } : null,
        totals: {
          received: derived?.received ?? Number(lotRow?.received_qty || 0),
          shipped: shippedRows.reduce((s, c) => s + c.qty, 0),
          damaged: (derived?.consumed || []).filter(c => c.type === 'DAMAGE').reduce((s, c) => s + c.qty, 0),
        },
        recipients: [...recipients.values()].sort((a, b) => b.qty - a.qty),
        movements: (derived?.consumed || []).map(c => ({ direction: 'OUT', qty: c.qty, doc_ref: c.docRef, created_at: c.at, type: c.type })),
      });
    }

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
