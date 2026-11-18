import webpush from 'web-push';
import { getSubscriptions, removeSubscriptions } from './subscriptionRepository';

// Initialize VAPID
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@inventory-app.com';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  orgId: string;
  userId?: string;
  redactLockScreen?: boolean;
}

export async function sendWebPush(payload: WebPushPayload) {
  if (!publicKey || !privateKey) return { success: 0, failed: 0 };

  const orgId = (payload?.orgId || '').trim();
  if (!orgId) {
    console.warn('[WebPush] Blocked push send without orgId');
    return { success: 0, failed: 0 };
  }

  const subscriptions = await getSubscriptions(orgId, { userId: payload.userId });
  if (subscriptions.length === 0) {
    return { success: 0, failed: 0 };
  }

  let successCount = 0;
  let failedCount = 0;
  const expiredEndpoints: string[] = [];

  const bodyText = payload.redactLockScreen
    ? 'คุณมีการแจ้งเตือนใหม่ — เปิดแอปเพื่อดูรายละเอียด'
    : payload.body;

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: bodyText,
    url: payload.url || '/',
    icon: '/icon512_maskable.png',
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          notificationPayload
        );
        successCount++;
      } catch (error: any) {
        console.error(
          `[WebPush] Failed to send to ${sub.endpoint.slice(0, 20)}...`,
          error?.statusCode
        );
        failedCount++;

        if (error?.statusCode === 410 || error?.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (expiredEndpoints.length > 0) {
    await removeSubscriptions(expiredEndpoints, orgId);
  }

  return { success: successCount, failed: failedCount };
}
