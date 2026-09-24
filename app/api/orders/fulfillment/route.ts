import { NextResponse } from 'next/server';
import { getPendingFulfillment } from '@/lib/data/orders';
import { errorMessage } from '@/lib/errors';

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
  } catch (error) {
    console.error('API fulfillment error:', error);
    return NextResponse.json({ error: errorMessage(error), pending_tasks: [] }, { status: 500 });
  }
}
