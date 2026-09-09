import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// Recent IN/OUT transactions from Supabase, newest first.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'IN' | 'OUT';
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    if (!type || (type !== 'IN' && type !== 'OUT')) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const orgId = await getCurrentOrgId();
    const { data: rows, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('org_id', orgId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase recent transactions Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const recent = (rows || []).map((r: any) => ({
      date: r.created_at,
      product: r.product_name || r.sku || '',
      qty: Number(r.qty ?? 0),
      docRef: r.doc_ref || '-',
      location: r.location || '-',
      type: r.type,
    }));

    return NextResponse.json(recent);
  } catch (error) {
    console.error('Recent transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
