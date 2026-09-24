import { NextResponse } from 'next/server';
import { recommendPutaway } from '@/lib/putawayEngine';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku') || 'SKU-GENERAL';
    const qty = Number(searchParams.get('qty') || 1);
    const weight = Number(searchParams.get('weight') || 2.5);

    const recommendation = await recommendPutaway({ sku, quantity: qty, weightKg: weight });
    return NextResponse.json({ success: true, data: recommendation });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}