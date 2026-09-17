import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { calculateLiveProductivity } from '@/lib/productivityEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const { data: transactions, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('Could not query stock_transactions for productivity:', error.message);
    }

    const analytics = calculateLiveProductivity(transactions || []);
    return NextResponse.json({ success: true, data: analytics });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
