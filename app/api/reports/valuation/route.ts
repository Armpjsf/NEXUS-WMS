import { NextResponse } from 'next/server';
import { getInventoryValuation } from '@/lib/data/valuation';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getInventoryValuation();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Valuation report error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
