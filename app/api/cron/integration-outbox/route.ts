import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase';
import { validateIntegrationUrl } from '@/lib/urlSecurity';
import {
  processOutboxBatch,
  signWebhookPayload,
  SupabaseOutboxInboxRepository,
  type OutboxEventRecord,
} from '@/lib/integrationOutboxInbox';

export const dynamic = 'force-dynamic';

function isAuthorizedCron(request: Request): boolean {
  const expected = String(process.env.CRON_SECRET || '').trim();
  if (!expected) return false;
  const auth = String(request.headers.get('authorization') || '');
  const provided = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();
  if (!provided) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function resolveTargetForEvent(event: OutboxEventRecord): Promise<{ url?: string; error?: string }> {
  let targetUrl = (process.env.TMS_API_URL || '').trim();
  try {
    const db = getServiceSupabase();
    // org-scope-ok: integration_connections scopes by tenant_id
    const { data: conn } = await db
      .from('integration_connections')
      .select('target_base_url, status')
      .eq('connection_id', event.connectionId)
      .eq('tenant_id', event.tenantId)
      .maybeSingle();
    if (conn) {
      if (conn.status !== 'active') {
        return { error: `Connection ${event.connectionId} is ${conn.status}` };
      }
      if (conn.target_base_url) {
        targetUrl = String(conn.target_base_url).trim();
      }
    }
  } catch {
    // fallback to TMS_API_URL if integration_connections table is absent
  }

  const check = validateIntegrationUrl(targetUrl);
  if (!check.valid || !check.url) {
    return { error: check.error || 'Invalid integration target URL' };
  }
  return { url: check.url };
}

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerId = `wms-outbox-worker-${process.pid}-${Date.now()}`;
  const signingSecret = (process.env.NEXUS_SIGNING_SECRET || process.env.TMS_WEBHOOK_SECRET || '').trim();
  const keyId = (process.env.NEXUS_SIGNING_KEY_ID || 'key-v1').trim();
  const apiKey = (process.env.TMS_API_KEY || '').trim();
  const repo = new SupabaseOutboxInboxRepository(getServiceSupabase());

  try {
    const result = await processOutboxBatch(
      {
        workerId,
        limit: 25,
        leaseDurationMs: 30000,
        deliverFn: async (event, { rawBody, attemptTimestampSec }) => {
          const target = await resolveTargetForEvent(event);
          if (target.error || !target.url) {
            return { ok: false, httpStatus: 422, permanent: true, error: target.error || 'Missing target URL' };
          }
          const sigHeaders = signingSecret
            ? signWebhookPayload(rawBody, signingSecret, keyId, attemptTimestampSec)
            : {};
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Idempotency-Key': event.eventId,
            'X-Nexus-Event-Id': event.eventId,
            'X-Nexus-Connection-Id': event.connectionId,
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            ...sigHeaders,
          };
          const res = await fetch(target.url, {
            method: 'POST',
            headers,
            body: rawBody,
            redirect: 'error',
            signal: AbortSignal.timeout(8000),
          });
          const errText = res.ok ? undefined : await res.text().catch(() => `HTTP ${res.status}`);
          return { ok: res.ok, httpStatus: res.status, error: errText };
        },
      },
      repo,
    );

    return NextResponse.json({ success: true, workerId, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Outbox worker failed' },
      { status: 500 },
    );
  }
}

export const GET = POST;
