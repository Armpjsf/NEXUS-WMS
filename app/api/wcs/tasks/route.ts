import { NextRequest, NextResponse } from 'next/server';
import { 
  getFleetDevices, 
  getMissionQueue, 
  dispatchWcsMission, 
  simulateFleetMovement 
} from '@/lib/wcsEngine';

export async function GET() {
  try {
    const fleet = getFleetDevices();
    const missions = getMissionQueue();

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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Simulation step trigger
    if (body.action === 'SIMULATE_STEP') {
      const simResult = simulateFleetMovement();
      return NextResponse.json({
        success: true,
        simulation: simResult,
        fleet: getFleetDevices(),
        missions: getMissionQueue()
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

    const mission = dispatchWcsMission({
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
