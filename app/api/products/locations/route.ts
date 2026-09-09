import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// Empty warehouse locations (bins not currently assigned to any product).
export async function GET() {
  try {
    const [{ data: locs, error: locErr }, { data: prods, error: prodErr }] = await Promise.all([
      supabase.from('warehouse_locations').select('bin_code, status').eq('org_id', await getCurrentOrgId()),
      supabase.from('products').select('location').eq('org_id', await getCurrentOrgId()),
    ]);

    if (locErr) {
      console.error('Empty Product Location Error:', locErr);
      return NextResponse.json({ error: locErr.message }, { status: 500 });
    }
    if (prodErr) {
      console.error('Empty Product Location (products) Error:', prodErr);
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    const used = new Set(
      (prods || [])
        .map((p: any) => String(p.location || '').trim())
        .filter((l) => l && l !== 'Unassigned')
    );

    const locations = (locs || [])
      .map((l: any) => String(l.bin_code || '').trim())
      .filter((code) => code && !used.has(code))
      .sort();

    return NextResponse.json({ locations });
  } catch (error: any) {
    console.error('Empty Product Location Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
