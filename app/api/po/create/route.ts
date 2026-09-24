import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { nextDocNumber } from '@/lib/docNumber';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Generate a system PO number: PO-YYMMDD-XXX
async function nextPoNumber(): Promise<string> {
  return nextDocNumber('PO', { existing: { table: 'purchase_orders', column: 'po_number' } });
}

// List purchase orders (for receiving prefill etc.).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const orgId = await getCurrentOrgId();
    if (id) {
      const { data, error } = await supabase.from('purchase_orders').select('*').eq('org_id', orgId).eq('id', id).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ order: data });
    }
    // status=DRAFT or status=DRAFT,ORDERED
    const statuses = (searchParams.get('status') || '').split(',').map(s => s.trim()).filter(Boolean);
    let q = supabase.from('purchase_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(500);
    if (statuses.length === 1) q = q.eq('status', statuses[0]);
    else if (statuses.length > 1) q = q.in('status', statuses);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orders: data || [] });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// Create a system-owned purchase order (generic, not customer-specific).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items = [], totalAmount, supplier, notes } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items to order' }, { status: 400 });
    }
    const session = await getServerSession(authOptions);

    const total =
      typeof totalAmount === 'number'
        ? totalAmount
        : items.reduce((sum: number, it: any) => sum + Number(it.total ?? Number(it.qty || 0) * Number(it.price || 0)), 0);

    const poNumber = await nextPoNumber();

    const { data, error } = await supabase
      .from('purchase_orders')
      .insert({
        org_id: await getCurrentOrgId(),
        po_number: poNumber,
        status: 'DRAFT',
        supplier: supplier || '',
        total_amount: total,
        total_items: items.length,
        items_json: items,
        created_by: session?.user?.name || session?.user?.email || 'System',
        notes: notes || '',
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase create PO Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      const { logAction } = await import('@/lib/auditTrail');
      await logAction({
        userId: session?.user?.email || 'System',
        userName: session?.user?.name || 'System',
        action: 'CREATE',
        module: 'PurchaseOrder',
        description: `Created purchase order ${poNumber} (${items.length} items, ${total})`,
        newValues: { poNumber, total } as any,
      });
    } catch (err) {
      console.warn('Audit Log Failed:', err);
    }

    return NextResponse.json({ success: true, po: data });
  } catch (error) {
    console.error('API create PO Error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// PO lifecycle: DRAFT → ORDERED (sent to supplier) → RECEIVED (set by the GRN
// commit), or CANCELLED from DRAFT/ORDERED. PATCH { id, status }.
const PO_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ORDERED', 'CANCELLED'],
  ORDERED: ['CANCELLED', 'RECEIVED'],
};

export async function PATCH(request: Request) {
  try {
    const { id, status } = await request.json();
    if (!id || !status) return NextResponse.json({ error: 'ต้องระบุ id และ status' }, { status: 400 });
    const orgId = await getCurrentOrgId();
    const { data: po } = await supabase.from('purchase_orders').select('id, status, po_number')
      .eq('org_id', orgId).eq('id', id).maybeSingle();
    if (!po) return NextResponse.json({ error: 'ไม่พบใบสั่งซื้อ' }, { status: 404 });
    if (!(PO_TRANSITIONS[po.status] || []).includes(status)) {
      return NextResponse.json({ error: `เปลี่ยนสถานะจาก ${po.status} เป็น ${status} ไม่ได้` }, { status: 409 });
    }
    const { data, error } = await supabase.from('purchase_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('org_id', orgId).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const session = await getServerSession(authOptions);
    const { logAction } = await import('@/lib/auditTrail');
    await logAction({
      userId: session?.user?.id || 'System', userName: session?.user?.name || 'System',
      action: 'UPDATE', module: 'PurchaseOrder',
      description: `${po.po_number}: ${po.status} → ${status}`,
    }).catch(() => {});

    return NextResponse.json({ success: true, po: data });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
