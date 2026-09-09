import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// Distinct product categories from Supabase.
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('org_id', orgId);

    if (error) {
      console.error('Product Category Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const categories = Array.from(
      new Set((data || []).map((r: any) => (r.category || 'General').trim()).filter(Boolean))
    ).sort();

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('Product Category Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
