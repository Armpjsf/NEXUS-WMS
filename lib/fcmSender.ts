import { messaging } from './firebaseAdmin';
import { getDeviceTokens, removeDeviceTokens } from './data/wms';

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** In-app path to open when the notification is tapped, e.g. '/mobile/jobs'. */
  link?: string;
}

export async function sendFcmToDevices(
  payload: FcmPayload,
  opts: { tag?: string; spreadsheetId?: string; orgId?: string } = {}
): Promise<{ sent: number; failed: number }> {
  const tag = opts.tag || 'FCM';

  if (!messaging) {
    console.warn(`[${tag}] Firebase messaging not initialized.`);
    return { sent: 0, failed: 0 };
  }

  const tokens = await getDeviceTokens(opts.orgId);
  if (tokens.length === 0) {
    console.log(`[${tag}] No devices registered.`);
    return { sent: 0, failed: 0 };
  }

  const data = { ...(payload.data || {}), ...(payload.link ? { url: payload.link } : {}) };

  console.log(`[${tag}] Sending push to ${tokens.length} devices...`);
  const res = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data,
    android: {
      priority: 'high',
      notification: { sound: 'default', clickAction: 'FCM_PLUGIN_ACTIVITY' },
    },
    ...(payload.link && APP_BASE_URL
      ? { webpush: { fcmOptions: { link: `${APP_BASE_URL}${payload.link}` } } }
      : {}),
  });

  console.log(`[${tag}] FCM Result: ${res.successCount} sent, ${res.failureCount} failed.`);

  const deadTokens: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      console.error(`[${tag}] token #${i} failed:`, r.error?.code, r.error?.message);
      if (r.error?.code && DEAD_TOKEN_CODES.has(r.error.code)) deadTokens.push(tokens[i]);
    }
  });
  if (deadTokens.length > 0) {
    await removeDeviceTokens(deadTokens, opts.orgId);
  }

  return { sent: res.successCount, failed: res.failureCount };
}
