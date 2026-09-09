import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// Generate a system PO number: PO-YYMMDD-XXX
async function nextPoNumber(): Promise<string> {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `PO-${ymd}-`;
  const { count } = await supabase
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
    .like('po_number', `${prefix}%`);
  return `${prefix}${String((count || 0) + 1).padStart(3, '0')}`;
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
    const status = searchParams.get('status') || undefined;
    let q = supabase.from('purchase_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(200);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orders: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    // @ts-ignore
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
  } catch (error: any) {
    console.error('API create PO Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
