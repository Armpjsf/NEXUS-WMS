// Web Push subscription store (browser/PWA) — backed by Supabase push_subscriptions.

import { getServiceSupabase } from './supabase';

export interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    expirationTime?: number | null;
}

export async function saveSubscription(sub: PushSubscription) {
    try {
        const { error } = await getServiceSupabase()
            .from('push_subscriptions')
            .upsert(
                { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
                { onConflict: 'endpoint' },
            );
        if (error) console.warn('[WebPush] save failed:', error.message);
        else console.log('Saved subscription:', sub.endpoint);
    } catch (error) {
        console.error('Failed to save subscription:', error);
    }
}

/**
 * Remove expired/gone push subscriptions. Called after web-push returns 410/404
 * so stale endpoints don't accumulate.
 */
export async function removeSubscriptions(endpoints: string[]): Promise<number> {
    const list = endpoints.filter(Boolean);
    if (list.length === 0) return 0;
    try {
        const { error } = await getServiceSupabase()
            .from('push_subscriptions')
            .delete()
            .in('endpoint', list);
        if (error) {
            console.error('[WebPush] Failed to remove subscriptions:', error.message);
            return 0;
        }
        console.log(`[WebPush] Removed ${list.length} expired subscription(s).`);
        return list.length;
    } catch (error) {
        console.error('[WebPush] Failed to remove subscriptions:', error);
        return 0;
    }
}

export async function getSubscriptions(): Promise<PushSubscription[]> {
    try {
        const { data, error } = await getServiceSupabase()
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth');
        if (error) {
            console.error('Failed to get subscriptions:', error.message);
            return [];
        }
        return (data || []).map((r: any) => ({
            endpoint: r.endpoint,
            keys: { p256dh: r.p256dh, auth: r.auth },
        }));
    } catch (error) {
        console.error('Failed to get subscriptions:', error);
        return [];
    }
}
