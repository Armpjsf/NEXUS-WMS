/**
 * Rate limiting.
 *
 * rateLimitShared() counts in Postgres (wms_rate_hit, sql/20260925) so every
 * serverless instance shares one counter — a real limit on login/signup.
 * rateLimit() is the per-instance in-memory fallback, used when the RPC isn't
 * available (SQL not run / DB unreachable) so auth never breaks on it.
 */
import { getServiceSupabase } from './supabase';

interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

// opportunistic cleanup so the map can't grow unbounded
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export interface RateResult { ok: boolean; remaining: number; retryAfterMs: number; }

/** Allow up to `limit` hits per `windowMs` for `key`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: b.resetAt - now };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, retryAfterMs: 0 };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** Allow up to `limit` hits per `windowMs` for `key`, shared across instances. */
export async function rateLimitShared(key: string, limit: number, windowMs: number): Promise<RateResult> {
  try {
    const { data, error } = await getServiceSupabase().rpc('wms_rate_hit', { p_key: key, p_window_ms: windowMs });
    if (error) throw error;
    const hits = Number(data) || 0;
    if (hits > limit) return { ok: false, remaining: 0, retryAfterMs: windowMs };
    return { ok: true, remaining: Math.max(0, limit - hits), retryAfterMs: 0 };
  } catch {
    return rateLimit(key, limit, windowMs);
  }
}
