// Document numbers: PREFIX-DATE-SEQ (e.g. ORD-260924-001).
//
// The sequence comes from the atomic Postgres function wms_next_doc_seq
// (sql/20260924_doc_sequences.sql), so two concurrent requests can never get
// the same number. The date is the Bangkok calendar day (the server runs in
// UTC, which used to roll documents made 00:00–07:00 onto "yesterday").
//
// If the RPC is missing (SQL not run yet) we fall back to a time-based suffix
// that is unique in practice, and log a warning — never a random 3-4 digits.
import { getServiceSupabase } from './supabase';
import { errorMessage } from '@/lib/errors';

export type DocDateStyle = 'yymmdd' | 'yyyymmdd';

export interface DocNumberOptions {
  /** Date part style. Default 'yymmdd'. */
  date?: DocDateStyle;
  /** Zero-pad width of the sequence. Default 3. */
  pad?: number;
  /** Existing table/column holding these numbers — seeds the counter so it
   *  never re-issues a number created before the counter existed. */
  existing?: { table: string; column: string; orgId?: string };
  /** Override "now" (tests). */
  now?: Date;
}

/** Bangkok calendar date as yymmdd / yyyymmdd. */
export function bangkokDate(style: DocDateStyle = 'yymmdd', now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  const yyyy = get('year');
  return `${style === 'yymmdd' ? yyyy.slice(2) : yyyy}${get('month')}${get('day')}`;
}

export function formatDocNumber(prefix: string, date: string, seq: number, pad = 3): string {
  return `${prefix}-${date}-${String(seq).padStart(pad, '0')}`;
}

/** Highest sequence already used for this key (parses PREFIX-DATE-NNN). */
async function existingFloor(key: string, existing?: DocNumberOptions['existing']): Promise<number> {
  if (!existing) return 0;
  try {
    let q = getServiceSupabase()
      .from(existing.table).select(existing.column)
      .like(existing.column, `${key}%`);
    if (existing.orgId) q = q.eq('org_id', existing.orgId);
    const { data } = await q.order(existing.column, { ascending: false }).limit(200);
    let max = 0;
    for (const row of (data || []) as unknown as Record<string, unknown>[]) {
      const tail = String(row[existing.column] || '').slice(key.length);
      if (/^\d+$/.test(tail)) max = Math.max(max, Number(tail));
    }
    return max;
  } catch {
    return 0;
  }
}

function fallbackSuffix(now: Date): string {
  // seconds-of-day (5 digits) + 2 random digits — unique in practice for
  // human-paced document creation; only used when the RPC is unavailable.
  const bkk = new Date(now.getTime() + 7 * 3600_000);
  const secs = bkk.getUTCHours() * 3600 + bkk.getUTCMinutes() * 60 + bkk.getUTCSeconds();
  return `T${String(secs).padStart(5, '0')}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
}

export async function nextDocNumber(prefix: string, opts: DocNumberOptions = {}): Promise<string> {
  const now = opts.now || new Date();
  const date = bangkokDate(opts.date || 'yymmdd', now);
  const key = `${prefix}-${date}-`;
  try {
    const floor = await existingFloor(key, opts.existing);
    const { data, error } = await getServiceSupabase().rpc('wms_next_doc_seq', { p_key: key, p_floor: floor });
    if (error) throw error;
    const seq = Number(data);
    if (!Number.isFinite(seq) || seq <= 0) throw new Error(`bad sequence ${data}`);
    return formatDocNumber(prefix, date, seq, opts.pad ?? 3);
  } catch (e) {
    console.warn(`[docNumber] wms_next_doc_seq unavailable for ${prefix} (run sql/20260924_doc_sequences.sql):`, errorMessage(e) || e);
    return `${key}${fallbackSuffix(now)}`;
  }
}

/**
 * Master-data code without a date, numbered per org: CUST-0001, SUPP-0002 …
 * (replaces `${PREFIX}-${last 4 digits of Date.now()}`, which repeats every
 * 10 seconds). The counter key includes the org so tenants don't share it.
 */
export async function nextMasterCode(
  prefix: string,
  orgId: string,
  existing: { table: string; column: string },
  pad = 4,
): Promise<string> {
  const key = `${prefix}-`;
  try {
    const floor = await existingFloor(key, { ...existing, orgId });
    const { data, error } = await getServiceSupabase().rpc('wms_next_doc_seq', { p_key: `${key}@${orgId}`, p_floor: floor });
    if (error) throw error;
    return `${key}${String(Number(data)).padStart(pad, '0')}`;
  } catch (e) {
    console.warn(`[docNumber] wms_next_doc_seq unavailable for ${prefix}:`, errorMessage(e) || e);
    return `${key}${Date.now().toString(36).toUpperCase()}`;
  }
}
