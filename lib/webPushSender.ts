import webpush from 'web-push';
import { getSubscriptions, removeSubscriptions } from './subscriptionRepository';

// Initialize VAPID
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@inventory-app.com';

if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
} else {
    console.warn("VAPID Keys missing! Push notifications will not work.");
}

export async function sendWebPush(payload: { title: string, body: string, url?: string }) {
    if (!publicKey || !privateKey) return { success: 0, failed: 0 };

    console.log(`[WebPush] Preparing to send '${payload.title}'...`);
    
    // 1. Get all subscriptions
    const subscriptions = await getSubscriptions();
    if (subscriptions.length === 0) {
        console.log("[WebPush] No subscriptions found.");
        return { success: 0, failed: 0 };
    }

    console.log(`[WebPush] Found ${subscriptions.length} subscriptions.`);

    // 2. Send in parallel
    let successCount = 0;
    let failedCount = 0;
    const expiredEndpoints: string[] = [];

    const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/',
        icon: '/icon512_maskable.png'
    });

    await Promise.all(subscriptions.map(async (sub) => {
        try {
            await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: sub.keys
            }, notificationPayload);
            successCount++;
        } catch (error: any) {
            console.error(`[WebPush] Failed to send to ${sub.endpoint.slice(0, 20)}...`, error.statusCode);
            failedCount++;

            // 410 Gone / 404 Not Found => subscription expired, mark for removal
            if (error.statusCode === 410 || error.statusCode === 404) {
                expiredEndpoints.push(sub.endpoint);
            }
        }
    }));

    // 3. Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
        await removeSubscriptions(expiredEndpoints);
    }

    console.log(`[WebPush] Result: ${successCount} sent, ${failedCount} failed.`);
    return { success: successCount, failed: failedCount };
}
