import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * B1 — Health check for uptime monitors (UptimeRobot, Better Uptime, etc.).
 * Public (no session) so external monitors can poll it; returns 200 only when
 * the app can reach the database. Add /api/health to the middleware public list.
 */
export async function GET() {
  const started = Date.now();
  let db: 'ok' | 'down' = 'down';
  let dbError: string | undefined;
  try {
    const { error } = await getServiceSupabase().from('products').select('sku').limit(1);
    if (!error) db = 'ok'; else dbError = error.message;
  } catch (e: any) {
    dbError = e?.message;
  }

  const ok = db === 'ok';
  return NextResponse.json({
    status: ok ? 'ok' : 'degraded',
    db,
    ...(dbError ? { dbError } : {}),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || undefined,
    latencyMs: Date.now() - started,
    ts: new Date().toISOString(),
  }, { status: ok ? 200 : 503 });
}
