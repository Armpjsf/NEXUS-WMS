import { NextResponse } from 'next/server';
import { getPendingFulfillment } from '@/lib/data/orders';

export const dynamic = 'force-dynamic';

// Feeds Wave Picking's "load pending orders". ?action=check_pending
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'check_pending';
    if (action === 'check_pending') {
      const result = await getPendingFulfillment();
      return NextResponse.json(result);
    }
    return NextResponse.json({ pending_tasks: [] });
  } catch (error: any) {
    console.error('API fulfillment error:', error);
    return NextResponse.json({ error: error.message, pending_tasks: [] }, { status: 500 });
  }
}
