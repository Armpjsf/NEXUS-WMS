import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * B4 — Data retention housekeeping (call from cron-job.org / Vercel Cron).
 * Auth: Authorization: Bearer <CRON_SECRET>.
 *
 * Purges only TRANSIENT rows. It never touches the crown jewels:
 *   - stock_transactions      (the stock ledger)
 *   - audit_trail_enterprise  (immutable compliance log, 21 CFR Part 11)
 *   - products / stock_locations / product_uoms (live state)
 *
 * Retention windows are env-tunable (days).
 */
const days = (name: string, def: number) => Number(process.env[name]) || def;

async function purge(table: string, col: string, cutoffISO: string, statuses?: string[]) {
  const admin = getServiceSupabase();
  let countQ = admin.from(table).select('*', { count: 'exact', head: true }).lt(col, cutoffISO);
  if (statuses) countQ = countQ.in('status', statuses);
  const { count } = await countQ;
  let delQ = admin.from(table).delete().lt(col, cutoffISO);
  if (statuses) delQ = delQ.in('status', statuses);
  const { error } = await delQ;
  if (error) { log.warn('cleanup purge failed', { table, msg: error.message }); return { table, deleted: 0, error: error.message }; }
  return { table, deleted: count || 0 };
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const cutoff = (d: number) => new Date(now - d * 864e5).toISOString();

  const results = [];
  // fulfilled/cancelled reservations — transient, safe to drop after 30d
  results.push(await purge('stock_reservations', 'updated_at', cutoff(days('RESERVATION_RETENTION_DAYS', 30)), ['RELEASED', 'CONSUMED']));
  // finished robot missions
  results.push(await purge('wcs_missions', 'created_at', cutoff(days('WCS_RETENTION_DAYS', 30)), ['COMPLETED', 'FAILED', 'CANCELLED']));
  // simple activity log (NOT the immutable enterprise audit trail)
  results.push(await purge('audit_log', 'created_at', cutoff(days('AUDIT_LOG_RETENTION_DAYS', 90))));

  const total = results.reduce((s, r) => s + (r.deleted || 0), 0);
  log.info('cron cleanup done', { total });
  return NextResponse.json({ success: true, total, results, ts: new Date().toISOString() });
}

// convenience for schedulers that only send GET
export const GET = POST;
