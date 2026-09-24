import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Distinct product categories from Supabase.
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    // B2: read all SKUs (paged) so no category is missed past 1000 products.
    const data = await fetchAllRows((f, t) => supabase
      .from('products').select('category').eq('org_id', orgId).range(f, t));

    const categories = Array.from(
      new Set((data || []).map((r: any) => (r.category || 'General').trim()).filter(Boolean))
    ).sort();

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Product Category Error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
