import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { createReceipt } from '@/lib/data/receipts';

export const dynamic = 'force-dynamic';

// C4 — Convert an ASN into a normal receipt so the standard receiving flow
// (scan, put-away, commit) handles the actual stock-in.
// POST { asnId }
export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { asnId } = await request.json();
    if (!asnId) return NextResponse.json({ error: 'ระบุ asnId' }, { status: 400 });
    const admin = getServiceSupabase();

    const { data: head } = await admin.from('asn_headers').select('*').eq('org_id', orgId).eq('id', asnId).maybeSingle();
    if (!head) return NextResponse.json({ error: 'ไม่พบ ASN' }, { status: 404 });
    if (head.status === 'RECEIVED') return NextResponse.json({ error: 'ASN นี้แปลงเป็นใบรับแล้ว' }, { status: 400 });

    // org-scope-ok: child rows of an ASN header already verified for this org
    const { data: lines } = await admin.from('asn_lines').select('*').eq('asn_id', asnId);
    const items = (lines || []).map((l: any) => ({ sku: l.sku, name: l.name || l.sku, expectedQty: Number(l.expected_qty || 0) }));
    if (items.length === 0) return NextResponse.json({ error: 'ASN ไม่มีรายการ' }, { status: 400 });

    const receipt = await createReceipt({
      poNumber: head.po_number || head.asn_no, supplier: head.supplier || '',
      items, notes: `จาก ASN ${head.asn_no}`,
    });
    if (!receipt) return NextResponse.json({ error: 'สร้างใบรับไม่สำเร็จ' }, { status: 500 });

    await admin.from('asn_headers')
      .update({ status: 'RECEIVED', receipt_id: (receipt as any).id, updated_at: new Date().toISOString() })
      .eq('id', asnId).eq('org_id', orgId);

    return NextResponse.json({ success: true, message: `สร้างใบรับจาก ${head.asn_no} แล้ว`, receiptId: (receipt as any).id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
