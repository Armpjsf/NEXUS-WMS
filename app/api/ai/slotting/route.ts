
import { NextResponse } from 'next/server';
import { getProductsUncached, getTransactionsUncached } from '@/lib/data/wms';
import { performABCAnalysis } from '@/lib/slotting';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [products, outbound] = await Promise.all([
        getProductsUncached(),
        getTransactionsUncached('OUT')
    ]);

    const insights = performABCAnalysis(products, outbound);

    return NextResponse.json({
        totalAnalyzed: products.length,
        classDistribution: {
            A: insights.filter(i => i.class === 'A').length,
            B: insights.filter(i => i.class === 'B').length,
            C: insights.filter(i => i.class === 'C').length,
            D: insights.filter(i => i.class === 'D').length,
        },
        recommendations: insights.filter(i => i.action !== 'KEEP'),
        all: insights
    });

  } catch (error) {
    console.error('Error in Slotting Analysis:', error);
    return NextResponse.json({ error: 'Failed to analyze slotting' }, { status: 500 });
  }
}

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
