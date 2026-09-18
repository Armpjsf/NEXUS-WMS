import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// C4 — ASN list + create.
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const admin = getServiceSupabase();
    const { data: heads } = await admin.from('asn_headers').select('*')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(100);
    const ids = (heads || []).map((h: any) => h.id);
    const { data: lines } = ids.length
      ? await admin.from('asn_lines').select('*').in('asn_id', ids)
      : { data: [] as any[] };
    const byAsn = new Map<string, any[]>();
    for (const l of lines || []) {
      const arr = byAsn.get(l.asn_id) || [];
      arr.push(l);
      byAsn.set(l.asn_id, arr);
    }
    const asns = (heads || []).map((h: any) => ({
      id: h.id, asnNo: h.asn_no, supplier: h.supplier, poNumber: h.po_number, eta: h.eta,
      status: h.status, receiptId: h.receipt_id, notes: h.notes, createdAt: h.created_at,
      items: (byAsn.get(h.id) || []).map((l: any) => ({ sku: l.sku, name: l.name, expectedQty: Number(l.expected_qty || 0) })),
    }));
    return NextResponse.json({ success: true, asns });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const b = await request.json();
    const items = Array.isArray(b.items) ? b.items.filter((i: any) => i.sku) : [];
    if (items.length === 0) return NextResponse.json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1' }, { status: 400 });
    const admin = getServiceSupabase();
    const asnNo = b.asnNo || `ASN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const { data: head, error } = await admin.from('asn_headers').insert({
      org_id: orgId, asn_no: asnNo, supplier: b.supplier || '', po_number: b.poNumber || '',
      eta: b.eta || null, status: 'PENDING', notes: b.notes || '',
    }).select().single();
    if (error) throw error;

    await admin.from('asn_lines').insert(items.map((i: any) => ({
      org_id: orgId, asn_id: head.id, sku: i.sku, name: i.name || i.sku, expected_qty: Number(i.qty || i.expectedQty || 0),
    })));

    return NextResponse.json({ success: true, asnNo, id: head.id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
