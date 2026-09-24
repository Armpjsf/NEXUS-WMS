import { NextRequest, NextResponse } from 'next/server';
import { updateWcsMissionFromWebhook } from '@/lib/wcsEngine';
import { errorMessage } from '@/lib/errors';

/**
 * Open Webhook Endpoint for Warehouse Control Systems (WCS) & Robotics Fleet Managers
 * (Compatible with Hikrobot RCS, Geek+ RMS, Hai Robotics ESS, Dematic & Conveyor PLCs)
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // External robot fleet managers have no session — authenticate with a shared
    // secret instead. When WCS_WEBHOOK_SECRET is set it is enforced; if unset
    // (local/dev), the endpoint stays open but warns.
    const secret = process.env.WCS_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers.get('x-wcs-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (provided !== secret) {
        return NextResponse.json({ success: false, error: 'Unauthorized WCS callback' }, { status: 401 });
      }
    } else {
      console.warn('[wcs/callback] WCS_WEBHOOK_SECRET not set — endpoint is unauthenticated');
    }

    const body = await req.json();
    const { missionCode, robotCode, status, batteryLevel, currentLocation, errorMessage } = body;

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
      errorMessage
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
