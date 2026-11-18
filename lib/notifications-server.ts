import webpush from 'web-push';
import { sendWebPush } from './webPushSender';
import { requireCurrentOrgId } from './orgContext';

// Initialize web-push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendNotificationToAll(
  title: string,
  body: string,
  url: string = '/',
  orgId?: string
) {
  const targetOrgId = (orgId || '').trim() || await requireCurrentOrgId();
  const result = await sendWebPush({
    title,
    body,
    url,
    orgId: targetOrgId,
  });

  return result.success;
}
