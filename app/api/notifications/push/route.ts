import { NextResponse } from 'next/server';
import { messaging } from '@/lib/firebaseAdmin';
import { getDeviceTokens } from '@/lib/data/wms';
import { errorMessage } from '@/lib/errors';
import { requireManagement } from '@/lib/apiAuth';

export async function POST(req: Request) {
  try {
    const guard = await requireManagement();
    if (guard.error) return guard.error;

    const body = await req.json();
    const { title, body: msgBody, type, data } = body;

    if (!title || !msgBody) {
      return NextResponse.json({ error: 'Title and body required' }, { status: 400 });
    }

    const tokens = await getDeviceTokens(guard.user.orgId);

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'No devices registered' });
    }

    if (messaging) {
      console.log(`[PushAPI] Sending '${title}' to ${tokens.length} devices...`);
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title,
          body: msgBody,
        },
        data: {
          type: type || 'general',
          ...data,
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FCM_PLUGIN_ACTIVITY',
          },
        },
      });

      return NextResponse.json({
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
      });
    } else {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }
  } catch (error) {
    console.error('[PushAPI] Error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
