import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { errorMessage } from '@/lib/errors';
import { fetchAllRows } from '@/lib/data/fetchAll';

export const dynamic = 'force-dynamic';

// Empty warehouse locations (bins not currently assigned to any product).
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    // Layouts can generate thousands of bins — page past the 1000-row cap.
    const [locs, prods] = await Promise.all([
      fetchAllRows((f, t) => supabase.from('warehouse_locations').select('*').eq('org_id', orgId).range(f, t)),
      fetchAllRows((f, t) => supabase.from('products').select('location').eq('org_id', orgId).range(f, t)),
    ]);

    const used = new Set(
      (prods || [])
        .map((p: any) => String(p.location || '').trim())
        .filter((l) => l && l !== 'Unassigned')
    );

    const locations = (locs || [])
      .filter((l: any) => l.active !== false) // bins removed from a warehouse layout
      .map((l: any) => String(l.bin_code || '').trim())
      .filter((code) => code && !used.has(code))
      .sort();

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Empty Product Location Error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
