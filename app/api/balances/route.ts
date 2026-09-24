import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getInventoryBalances } from '@/lib/inventoryBalances';
import { errorMessage } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku') || undefined;
    const locationCode = searchParams.get('location') || undefined;

    const balances = await getInventoryBalances(orgId, { sku, locationCode });
    return NextResponse.json({ success: true, data: balances });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}