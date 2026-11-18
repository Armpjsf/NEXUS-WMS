import { NextResponse } from 'next/server';
import { sendFcmToDevices } from '@/lib/fcmSender';
import { requireManagement } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

async function handle(req: Request) {
  let orgId: string | undefined;
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  const hasCronKey = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`));

  if (!hasCronKey) {
    const guard = await requireManagement();
    if (guard.error) return guard.error;
    orgId = guard.user.orgId;
  } else {
    orgId = (url.searchParams.get('orgId') || req.headers.get('x-org-id') || '').trim() || undefined;
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required when calling with CRON_SECRET' }, { status: 400 });
    }
  }

  const { sent, failed } = await sendFcmToDevices({
    title: '🔔 ทดสอบแจ้งเตือน WMS',
    body: 'ถ้าเห็นข้อความนี้ แปลว่าระบบ push (APK) ทำงานปกติแล้ว ✅',
    data: { type: 'test' },
    link: '/mobile/jobs',
  }, { tag: 'TestFCM', orgId });

  return NextResponse.json({
    success: true,
    sent,
    failed,
    note: sent === 0
      ? 'ส่งได้ 0 เครื่อง — ตรวจว่ามี token ขององค์กรนี้หรือยัง (เปิดแอปบนมือถือ 1 รอบ)'
      : `ส่งแจ้งเตือนทดสอบไป ${sent} เครื่อง`,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
