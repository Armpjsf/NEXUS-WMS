import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getBins, getBinsForSkus } from '@/lib/stockLocations';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// GET /api/stock/bins?sku=ABC            -> bins for one SKU
// GET /api/stock/bins?skus=ABC,DEF,GHI   -> map of sku -> bins (for a list view)
export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const skus = searchParams.get('skus');

    if (sku) {
      return NextResponse.json({ success: true, sku, bins: await getBins(orgId, sku) });
    }
    if (skus) {
      const list = skus.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200);
      return NextResponse.json({ success: true, bins: await getBinsForSkus(orgId, list) });
    }
    return NextResponse.json({ success: false, error: 'ระบุ sku หรือ skus' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err), bins: [] }, { status: 200 });
  }
}
