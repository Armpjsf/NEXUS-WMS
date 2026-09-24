import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dispatchNotification, notificationHistory } from '@/lib/notifications/notificationGateway';
import { errorMessage } from '@/lib/errors';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ success: true, history: notificationHistory });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const result = await dispatchNotification({
      channel: body.channel || 'MOCK_STAGING',
      eventType: body.eventType || 'LOW_STOCK',
      title: body.title || 'ทดสอบระบบแจ้งเตือน NEXUS WMS',
      message: body.message || 'ระบบแจ้งเตือนพร้อมเชื่อมต่อ LINE OA / Webhook'
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
