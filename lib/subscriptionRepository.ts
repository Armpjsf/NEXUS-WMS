// Web Push subscription store (browser/PWA) — backed by Supabase push_subscriptions.
// Strictly scoped by org_id so Tenant A never receives Tenant B broadcasts or deletes Tenant B endpoints.

import { getServiceSupabase } from './supabase';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

export interface SubscriptionContext {
  orgId: string;
  userId?: string;
  deviceId?: string;
}

export async function saveSubscription(
  sub: PushSubscription,
  context: SubscriptionContext
): Promise<{ ok: boolean; error?: string }> {
  const orgId = (context?.orgId || '').trim();
  if (!orgId) {
    throw new Error('orgId is required to save a push subscription');
  }
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { ok: false, error: 'Invalid push subscription payload' };
  }

  try {
    const row: Record<string, unknown> = {
      org_id: orgId,
      user_id: context.userId || null,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    };
    if (context.deviceId) {
      row.device_id = context.deviceId;
    }

    const { error } = await getServiceSupabase()
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' });

    if (error) {
      console.warn('[WebPush] save failed:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error: any) {
    console.error('Failed to save subscription:', error);
    return { ok: false, error: error?.message || 'Save failed' };
  }
}

/**
 * Remove expired/gone push subscriptions strictly within the given organization.
 */
export async function removeSubscriptions(
  endpoints: string[],
  orgId: string
): Promise<number> {
  const cleanOrgId = (orgId || '').trim();
  const list = endpoints.filter(Boolean);
  if (!cleanOrgId || list.length === 0) return 0;

  try {
    const { error } = await getServiceSupabase()
      .from('push_subscriptions')
      .delete()
      .eq('org_id', cleanOrgId)
      .in('endpoint', list);

    if (error) {
      console.error('[WebPush] Failed to remove subscriptions:', error.message);
      return 0;
    }
    return list.length;
  } catch (error) {
    console.error('[WebPush] Failed to remove subscriptions:', error);
    return 0;
  }
}

/**
 * Unbinds a user's push subscription(s) upon logout or user switch within the org.
 */
export async function removeUserSubscriptionsOnLogout(
  orgId: string,
  userId: string,
  endpoint?: string
): Promise<number> {
  const cleanOrgId = (orgId || '').trim();
  const cleanUserId = (userId || '').trim();
  if (!cleanOrgId || (!cleanUserId && !endpoint)) return 0;

  try {
    let query = getServiceSupabase()
      .from('push_subscriptions')
      .delete()
      .eq('org_id', cleanOrgId);

    if (cleanUserId) {
      query = query.eq('user_id', cleanUserId);
    }
    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    }

    const { data, error } = await query.select('endpoint');
    if (error) {
      console.error('[WebPush] Failed to unbind subscriptions on logout:', error.message);
      return 0;
    }
    return Array.isArray(data) ? data.length : 0;
  } catch (error) {
    console.error('[WebPush] Failed to unbind subscriptions on logout:', error);
    return 0;
  }
}

export async function getSubscriptions(
  orgId: string,
  options?: { userId?: string }
): Promise<PushSubscription[]> {
  const cleanOrgId = (orgId || '').trim();
  if (!cleanOrgId) return [];

  try {
    let query = getServiceSupabase()
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, org_id, user_id')
      .eq('org_id', cleanOrgId);

    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }

    const { data, error } = await query;
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
