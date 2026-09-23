import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// Generic document e-signatures. GET lists a document's signatures; POST upserts
// one slot's signature (data URL). Used by the print pages' SignatureSlot.
export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(request.url);
    const docType = searchParams.get('docType');
    const docId = searchParams.get('docId');
    if (!docType || !docId) return NextResponse.json({ signatures: [] });
    const admin = getServiceSupabase();
    const { data } = await admin
      .from('document_signatures')
      .select('role, signer_name, data_url, signed_at')
      .eq('org_id', orgId).eq('doc_type', docType).eq('doc_id', docId);
    return NextResponse.json({ signatures: data || [] });
  } catch (e: any) {
    // Table may not exist yet (migration pending) — behave as "no signatures".
    return NextResponse.json({ signatures: [] });
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { docType, docId, role, signerName, dataUrl } = await request.json();
    if (!docType || !docId || !role || !dataUrl) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ (docType, docId, role, dataUrl)' }, { status: 400 });
    }
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      return NextResponse.json({ error: 'ลายเซ็นไม่ถูกต้อง' }, { status: 400 });
    }
    if (dataUrl.length > 400_000) {
      return NextResponse.json({ error: 'ลายเซ็นใหญ่เกินไป' }, { status: 413 });
    }
    const admin = getServiceSupabase();
    const { error } = await admin.from('document_signatures').upsert({
      org_id: orgId, doc_type: docType, doc_id: docId, role,
      signer_name: signerName || '', data_url: dataUrl, signed_at: new Date().toISOString(),
    }, { onConflict: 'org_id,doc_type,doc_id,role' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'บันทึกลายเซ็นไม่สำเร็จ' }, { status: 500 });
  }
}
