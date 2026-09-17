import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getUoms, setUom } from '@/lib/uom';

export const dynamic = 'force-dynamic';

// GET /api/products/uoms?sku=ABC  -> [{code,name,factor,isBase}]
export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const sku = new URL(request.url).searchParams.get('sku');
    if (!sku) return NextResponse.json({ success: false, error: 'ระบุ sku' }, { status: 400 });
    return NextResponse.json({ success: true, sku, uoms: await getUoms(orgId, sku) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, uoms: [] }, { status: 200 });
  }
}

// POST { sku, code, name, factor, barcode? } -> define/update an alternate unit
export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const b = await request.json();
    if (!b.sku || !b.code || !(Number(b.factor) > 0)) {
      return NextResponse.json({ success: false, error: 'ต้องระบุ sku, code และ factor (> 0)' }, { status: 400 });
    }
    await setUom(orgId, b.sku, { code: b.code, name: b.name, factor: Number(b.factor), barcode: b.barcode });
    return NextResponse.json({ success: true, uoms: await getUoms(orgId, b.sku) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
