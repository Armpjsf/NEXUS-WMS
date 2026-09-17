import { NextRequest, NextResponse } from 'next/server';
import { updateWcsMissionFromWebhook } from '@/lib/wcsEngine';

/**
 * Open Webhook Endpoint for Warehouse Control Systems (WCS) & Robotics Fleet Managers
 * (Compatible with Hikrobot RCS, Geek+ RMS, Hai Robotics ESS, Dematic & Conveyor PLCs)
 */
export async function POST(req: NextRequest) {
  try {
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

    const result = updateWcsMissionFromWebhook({
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
