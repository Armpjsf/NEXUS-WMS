import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { pastDailyStock } from '@/lib/ledger';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// GET /api/stock/history?sku=X&days=7
// Real end-of-day stock for the last N days, walked back from the current
// stock through stock_transactions (used by the dashboard depletion chart).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = (searchParams.get('sku') || '').trim();
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days')) || 7));
    if (!sku) return NextResponse.json({ error: 'sku is required' }, { status: 400 });

    const orgId = await getCurrentOrgId();
    const { data: prod } = await supabase.from('products').select('stock')
      .eq('org_id', orgId).eq('sku', sku).maybeSingle();
    const since = new Date(Date.now() - (days + 1) * 86_400_000).toISOString();
    const { data: rows, error } = await supabase.from('stock_transactions')
      .select('type, qty, created_at')
      .eq('org_id', orgId).eq('sku', sku).gte('created_at', since);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ sku, history: pastDailyStock(Number(prod?.stock || 0), rows || [], days) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
