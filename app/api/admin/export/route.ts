import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * B4 — DR / offsite backup snapshot of live warehouse state.
 * Management-only (enforced in middleware for /api/admin/*). Returns paged JSON
 * that a scheduler can pull and store offsite, complementing Supabase's own
 * automated backups / PITR.
 *
 *   GET /api/admin/export                 -> products + stock_locations + product_uoms + active reservations
 *   GET /api/admin/export?table=products  -> just one table (for big datasets)
 */
export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const table = new URL(request.url).searchParams.get('table');

    const grab = {
      products: () => fetchAllRows((f, t) => supabase.from('products').select('*').eq('org_id', orgId).range(f, t)),
      stock_locations: () => fetchAllRows((f, t) => supabase.from('stock_locations').select('*').eq('org_id', orgId).range(f, t)),
      product_uoms: () => fetchAllRows((f, t) => supabase.from('product_uoms').select('*').eq('org_id', orgId).range(f, t)),
      reservations: () => fetchAllRows((f, t) => supabase.from('stock_reservations').select('*').eq('org_id', orgId).eq('status', 'ACTIVE').range(f, t)),
    } as const;

    const meta = { orgId, exportedAt: new Date().toISOString(), commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || undefined };

    if (table && table in grab) {
      const rows = await (grab as any)[table]();
      return NextResponse.json({ ...meta, table, count: rows.length, rows });
    }

    const [products, stock_locations, product_uoms, reservations] = await Promise.all([
      grab.products(), grab.stock_locations(), grab.product_uoms(), grab.reservations(),
    ]);
    return NextResponse.json({
      ...meta,
      counts: { products: products.length, stock_locations: stock_locations.length, product_uoms: product_uoms.length, reservations: reservations.length },
      products, stock_locations, product_uoms, reservations,
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
