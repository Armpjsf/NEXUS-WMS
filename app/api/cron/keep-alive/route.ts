import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Supabase Keep-Alive Cron Endpoint
 * Prevents Supabase Free Tier from auto-pausing after 7 days of inactivity.
 * Triggered automatically by Vercel Cron or GitHub Actions every 3-5 days.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const queryKey = searchParams.get('key');

    // If CRON_SECRET is set, verify authorization (allows Vercel Cron, GitHub Actions, or query param)
    if (cronSecret && authHeader !== cronSecret && queryKey !== cronSecret) {
      // If called by Vercel Cron directly, check user-agent or Vercel signature
      const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');
      if (!isVercelCron) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const admin = getServiceSupabase();
    const nowISO = new Date().toISOString();

    // 1. Get Default Organization
    const { data: orgs } = await admin
      .from('organizations')
      .select('id, name')
      .limit(1);

    const orgId = orgs?.[0]?.id || '00000000-0000-0000-0000-000000000001';

    // 2. Write Heartbeat Log to Supabase (Guaranteed DB activity)
    const { error: insertError } = await admin.from('audit_log').insert({
      user_id: 'system',
      user_name: 'Keep-Alive Bot',
      action: 'HEARTBEAT',
      module: 'System',
      description: 'Automated keep-alive ping to prevent Supabase auto-pause',
      org_id: orgId,
    });

    if (insertError) {
      console.warn('[Keep-Alive] Heartbeat insert warning:', insertError.message);
    }

    // 3. Housekeeping: remove old heartbeat records older than 30 days to avoid clutter
    const cutoff30d = new Date(Date.now() - 30 * 864e5).toISOString();
    await admin
      .from('audit_log')
      .delete()
      .eq('action', 'HEARTBEAT')
      .lt('ts', cutoff30d);

    return NextResponse.json({
      status: 'active',
      supabase: 'awake',
      timestamp: nowISO,
      organization: orgs?.[0]?.name || 'WMS 360',
      message: 'Supabase keep-alive ping executed successfully.',
    });
  } catch (error: any) {
    console.error('[Keep-Alive] Error:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Keep-alive ping failed' },
      { status: 500 }
    );
  }
}

export const POST = GET;
