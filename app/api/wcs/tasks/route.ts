import { NextRequest, NextResponse } from 'next/server';
import {
  getFleetDevices,
  getMissionQueue,
  dispatchWcsMission,
  simulateFleetMovement
} from '@/lib/wcsEngine';
import { getCurrentOrgId } from '@/lib/orgContext';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const [fleet, missions] = await Promise.all([
      getFleetDevices(orgId),
      getMissionQueue(orgId),
    ]);

    const activeMissions = missions.filter(m => m.status === 'DISPATCHED' || m.status === 'IN_TRANSIT');
    const completedToday = missions.filter(m => m.status === 'COMPLETED').length;
    const onlineRobots = fleet.filter(r => r.status !== 'OFFLINE' && r.status !== 'ERROR').length;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      fleet,
      missions,
      stats: {
        totalRobots: fleet.length,
        onlineRobots,
        activeMissions: activeMissions.length,
        completedToday
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await req.json();

    // 1. Simulation step trigger
    if (body.action === 'SIMULATE_STEP') {
      const simResult = await simulateFleetMovement(orgId);
      const [fleet, missions] = await Promise.all([getFleetDevices(orgId), getMissionQueue(orgId)]);
      return NextResponse.json({
        success: true,
        simulation: simResult,
        fleet,
        missions,
      });
    }

    // 2. Dispatch mission
    const { taskType, sourceBin, targetBin, sku, productName, lpn, qty, priority, robotCode } = body;

    if (!taskType || !sourceBin || !targetBin) {
      return NextResponse.json(
        { success: false, error: 'taskType, sourceBin, and targetBin are required' },
        { status: 400 }
      );
    }

    const mission = await dispatchWcsMission(orgId, {
      taskType,
      sourceBin,
      targetBin,
      sku,
      productName,
      lpn,
      qty: qty ? Number(qty) : 1,
      priority: priority ? Number(priority) : 2,
      robotCode
    });

    return NextResponse.json({
      success: true,
      message: `Mission ${mission.missionCode} dispatched successfully`,
      mission
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}
