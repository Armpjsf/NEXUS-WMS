/**
 * B3 — Lightweight in-memory rate limiter (dependency-free).
 *
 * Best-effort: state lives per serverless instance, so it slows brute-force /
 * abuse without being a distributed guarantee. For a hard global limit, back it
 * with Upstash/Redis later — the call sites stay the same.
 */

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
