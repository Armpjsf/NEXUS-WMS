import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// Returns enriched IN / OUT / DAMAGE logs from Supabase stock_transactions,
// shaped for the Transactions page ({ date, product, qty, location, status, reason }).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'IN' | 'OUT' | 'DAMAGE'

    if (type !== 'IN' && type !== 'OUT' && type !== 'DAMAGE') {
      return NextResponse.json({ error: "Invalid type. Use 'IN', 'OUT' or 'DAMAGE'" }, { status: 400 });
    }

    const orgId = await getCurrentOrgId();

    // Location fallback map (product name -> location) for rows missing a location.
    const { data: products } = await supabase
      .from('products')
      .select('name, location')
      .eq('org_id', orgId);
    const locMap = new Map<string, string>();
    (products || []).forEach((p: any) => {
      if (p.name) locMap.set(String(p.name).toLowerCase().trim(), p.location);
    });

    const { data: rows, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('org_id', orgId)
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase logs/transaction Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enrichedLogs = (rows || []).map((r: any) => {
      const productName = r.product_name || r.sku || '';
      const normalizedName = productName.toLowerCase().trim();
      return {
        date: r.created_at,
        product: productName,
        qty: Number(r.qty ?? 0),
        location: r.location || locMap.get(normalizedName) || '-',
        reason: r.notes || undefined,
        status: type === 'DAMAGE' ? (r.notes || '-') : undefined,
      };
    });

    return NextResponse.json(enrichedLogs);
  } catch (error: any) {
    console.error('API logs/transaction Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
