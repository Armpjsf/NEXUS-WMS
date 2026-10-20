import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { updateWcsMissionFromWebhook } from '@/lib/wcsEngine';
import { getAuthSecret } from '@/lib/authSecret';
import { getSessionUser } from '@/lib/apiAuth';
import { errorMessage } from '@/lib/errors';

/**
 * Open Webhook Endpoint for Warehouse Control Systems (WCS) & Robotics Fleet Managers
 * (Compatible with Hikrobot RCS, Geek+ RMS, Hai Robotics ESS, Dematic & Conveyor PLCs)
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // External robot fleet managers have no session — authenticate with a shared
    // secret instead. When WCS_WEBHOOK_SECRET is set it is enforced; in production,
    // fail closed if unset unless the caller has a valid NextAuth session token.
    const secret = process.env.WCS_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers.get('x-wcs-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (provided !== secret) {
        const authSecret = getAuthSecret();
        const token = authSecret ? await getToken({ req, secret: authSecret }) : null;
        const user = token || (await getSessionUser());
        if (!user) {
          return NextResponse.json({ success: false, error: 'Unauthorized WCS callback' }, { status: 401 });
        }
      }
    } else if (process.env.NODE_ENV === 'production') {
      const authSecret = getAuthSecret();
      const token = authSecret ? await getToken({ req, secret: authSecret }) : null;
      const user = token || (await getSessionUser());
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'WCS webhook secret is not configured' },
          { status: 503 },
        );
      }
    } else {
      console.warn('[wcs/callback] WCS_WEBHOOK_SECRET not set — endpoint is unauthenticated');
    }

    const body = await req.json();
    const { missionCode, robotCode, status, batteryLevel, currentLocation, errorMessage: missionErr } = body;

    if (!missionCode || !status) {
      return NextResponse.json(
        { success: false, error: 'missionCode and status are required in callback payload' },
        { status: 400 }
      );
    }

    if (!['IN_TRANSIT', 'COMPLETED', 'FAILED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status "${status}". Allowed values: IN_TRANSIT, COMPLETED, FAILED` },
        { status: 400 }
      );
    }

    const result = await updateWcsMissionFromWebhook({
      missionCode,
      robotCode,
      status,
      batteryLevel: typeof batteryLevel === 'number' ? batteryLevel : undefined,
      currentLocation,
      errorMessage: missionErr,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `WCS callback for mission ${missionCode} processed successfully`,
      mission: result.mission
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}
