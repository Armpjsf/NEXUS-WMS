import { NextResponse } from 'next/server';
import { saveSubscription } from '@/lib/subscriptionRepository';
import { requireAuth } from '@/lib/apiAuth';

export async function POST(request: Request) {
  try {
    const guard = await requireAuth();
    if (guard.error) return guard.error;

    const sub = await request.json();
    if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const res = await saveSubscription(sub, {
      orgId: guard.user.orgId,
      userId: guard.user.id,
      deviceId: typeof sub.deviceId === 'string' ? sub.deviceId : undefined,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error || 'Failed to save subscription' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
