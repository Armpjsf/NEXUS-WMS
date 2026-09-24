// Auth for the machine-facing /api/erp/* endpoints. proxy.ts lets /api/erp
// through without a session (an ERP server has no cookie), so each route MUST
// call resolveErpOrg() — otherwise it is readable/writable by anyone.
//
// Accepted credentials, in order:
//  1. A logged-in NextAuth session (the in-app ERP test console) → session org.
//  2. Header `x-api-key` (or `Authorization: Bearer <key>`) matching
//       ERP_API_KEYS = "key1:<orgId>,key2:<orgId>"   (one key per tenant), or
//       ERP_API_KEY  = "<key>"                        (single-tenant → default org)
// No key configured = only sessions work (fail closed).
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getSessionUser } from './apiAuth';
import { DEFAULT_ORG } from './orgContext';

type ErpAuth = { orgId: string; via: 'session' | 'api-key'; error: null } | { orgId: null; via: null; error: NextResponse };

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Parse the configured keys into [key, orgId] pairs (exported for tests). */
export function parseErpKeys(multi: string | undefined, single: string | undefined): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const entry of (multi || '').split(',')) {
    const idx = entry.indexOf(':');
    if (idx <= 0) continue;
    const key = entry.slice(0, idx).trim();
    const org = entry.slice(idx + 1).trim();
    if (key.length >= 16 && org) pairs.push([key, org]);
  }
  const one = (single || '').trim();
  if (one.length >= 16) pairs.push([one, DEFAULT_ORG]);
  return pairs;
}

/** Match a presented key against configured pairs; returns the org or null. */
export function matchErpKey(presented: string, pairs: Array<[string, string]>): string | null {
  if (!presented) return null;
  let found: string | null = null;
  // Compare against every entry (no early exit) to keep timing uniform.
  for (const [key, org] of pairs) {
    if (safeEqual(presented, key) && !found) found = org;
  }
  return found;
}

export async function resolveErpOrg(request: Request): Promise<ErpAuth> {
  const user = await getSessionUser().catch(() => null);
  if (user) return { orgId: user.orgId || DEFAULT_ORG, via: 'session', error: null };

  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const presented = (request.headers.get('x-api-key') || bearer).trim();
  const orgId = matchErpKey(presented, parseErpKeys(process.env.ERP_API_KEYS, process.env.ERP_API_KEY));
  if (orgId) return { orgId, via: 'api-key', error: null };

  return {
    orgId: null,
    via: null,
    error: NextResponse.json({ success: false, error: 'Unauthorized: missing or invalid x-api-key' }, { status: 401 }),
  };
}
