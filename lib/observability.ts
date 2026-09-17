/**
 * B1 — Error capture / alerting (dependency-free).
 *
 * captureError() always logs, and — when ERROR_WEBHOOK_URL is set — posts a
 * short alert to that webhook (Slack / Discord / Google Chat / Telegram-style
 * endpoints all accept a JSON body; we send both `text` and `content` keys so
 * the common ones render it). No SDK, no build-time coupling; if no webhook is
 * configured it degrades to logging only.
 *
 * Rate-limited so an error storm can't spam the channel.
 */

import { log } from '@/lib/logger';

const WEBHOOK = process.env.ERROR_WEBHOOK_URL || '';
const APP = process.env.NEXT_PUBLIC_APP_NAME || 'NEXUS WMS';
const ENV = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);

// simple in-process throttle: at most 1 alert / key / window
const WINDOW_MS = 60_000;
const lastSent = new Map<string, number>();

function throttled(key: string): boolean {
  const now = Date.now();
  const prev = lastSent.get(key) || 0;
  if (now - prev < WINDOW_MS) return true;
  lastSent.set(key, now);
  return false;
}

export interface ErrorContext {
  where?: string;          // e.g. "POST /api/outbound"
  orgId?: string;
  userId?: string;
  extra?: Record<string, any>;
}

export async function captureError(err: unknown, ctx: ErrorContext = {}): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err));
  const where = ctx.where || 'unknown';

  log.error(e.message, {
    where, stack: e.stack, orgId: ctx.orgId, userId: ctx.userId, ...ctx.extra,
  });

  if (!WEBHOOK) return;
  // throttle per (where + message) so repeats don't flood
  if (throttled(`${where}:${e.message}`)) return;

  const text = `🔴 *${APP}* [${ENV}${COMMIT ? ` ${COMMIT}` : ''}]\n*${where}*\n${e.message}` +
    (ctx.orgId ? `\norg: ${ctx.orgId}` : '') +
    (e.stack ? `\n\`\`\`${e.stack.split('\n').slice(0, 4).join('\n')}\`\`\`` : '');

  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, content: text }),
    });
  } catch (postErr) {
    log.warn('captureError: webhook post failed', { msg: (postErr as Error).message });
  }
}
