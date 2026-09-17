/**
 * WCS (Warehouse Control System) & Robotics API Gateway Engine
 * Standard Interface for AGV, AMR, AS/RS Pallet Shuttles & Sortation Conveyors
 * Supports Hikrobot, Geek+, HaiPick, Dematic, Swisslog & Modbus/PLC Controllers
 */

export interface RobotFleetDevice {
  id: string;
  code: string;
  name: string;
  type: 'AGV_PALLET_LIFT' | 'AMR_TOTE_RUNNER' | 'CONVEYOR_SORTER' | 'ASRS_SHUTTLE';
  status: 'IDLE' | 'NAVIGATING' | 'LIFTING' | 'CHARGING' | 'ERROR' | 'OFFLINE';
  batteryLevel: number; // 0 - 100
  currentLocation: string;
  currentMissionCode?: string;
  ipAddress?: string;
  lastPing: string;
}

export interface WcsMission {
  id: string;
  missionCode: string;
  taskType: 'PALLET_TRANSFER' | 'BIN_TO_PERSON' | 'CONVEYOR_DIVERT' | 'PUTAWAY_RUN';
  priority: number; // 1 (highest) to 5
  sourceBin: string;
  targetBin: string;
  sku?: string;
  productName?: string;
  lpn?: string;
  qty?: number;
  status: 'QUEUED' | 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  assignedRobotCode?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

// In-memory fleet registry (persisted during server session; can sync to Postgres)
let fleetDevices: RobotFleetDevice[] = [
  {
    id: 'dev-01',
    code: 'AGV-01',
    name: 'Hikrobot Pallet Lifter Alpha',
    type: 'AGV_PALLET_LIFT',
    status: 'IDLE',
    batteryLevel: 94,
    currentLocation: 'DOCK-01',
    ipAddress: '192.168.10.101',
    lastPing: new Date().toISOString()
  },
  {
    id: 'dev-02',
    code: 'AMR-02',
    name: 'Geek+ Tote Runner Bravo',
    type: 'AMR_TOTE_RUNNER',
    status: 'NAVIGATING',
    batteryLevel: 78,
    currentLocation: 'AISLE-B-02',
    currentMissionCode: 'WCS-20260917-001',
    ipAddress: '192.168.10.102',
    lastPing: new Date().toISOString()
  },
  {
    id: 'dev-03',
    code: 'AGV-03',
    name: 'HaiPick Narrow-Aisle Shuttle',
    type: 'ASRS_SHUTTLE',
    status: 'CHARGING',
    batteryLevel: 42,
    currentLocation: 'CHARGE-STN-1',
    ipAddress: '192.168.10.103',
    lastPing: new Date().toISOString()
  },
  {
    id: 'dev-04',
    code: 'CONV-01',
    name: 'High-Speed Sortation Conveyor A',
    type: 'CONVEYOR_SORTER',
    status: 'IDLE',
    batteryLevel: 100,
    currentLocation: 'PACK-LINE-01',
    ipAddress: '192.168.10.201',
    lastPing: new Date().toISOString()
  }
];

let missionQueue: WcsMission[] = [
  {
    id: 'mis-01',
    missionCode: 'WCS-20260917-001',
    taskType: 'BIN_TO_PERSON',
    priority: 1,
    sourceBin: 'B-02-04',
    targetBin: 'STATION-PICK-01',
    sku: 'SKU-SMC-001',
    productName: 'Air Filter Premium Grade',
    qty: 12,
    status: 'IN_TRANSIT',
    assignedRobotCode: 'AMR-02',
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    startedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString()
  }
];

export function getFleetDevices(): RobotFleetDevice[] {
  return [...fleetDevices];
}

export function getMissionQueue(): WcsMission[] {
  return [...missionQueue];
}

export function dispatchWcsMission(data: {
  taskType: WcsMission['taskType'];
  sourceBin: string;
  targetBin: string;
  sku?: string;
  productName?: string;
  lpn?: string;
  qty?: number;
  priority?: number;
  robotCode?: string;
}): WcsMission {
  const missionCode = `WCS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  // Auto-assign available idle robot if none explicitly selected
  let assignedCode = data.robotCode;
  if (!assignedCode) {
    const candidate = fleetDevices.find(
      d => d.status === 'IDLE' && (data.taskType === 'BIN_TO_PERSON' ? d.type === 'AMR_TOTE_RUNNER' : d.type === 'AGV_PALLET_LIFT')
    ) || fleetDevices.find(d => d.status === 'IDLE');

    if (candidate) {
      assignedCode = candidate.code;
    }
  }

  const mission: WcsMission = {
    id: `mis-${Date.now()}`,
    missionCode,
    taskType: data.taskType,
    priority: data.priority || 2,
    sourceBin: data.sourceBin,
    targetBin: data.targetBin,
    sku: data.sku,
    productName: data.productName,
    lpn: data.lpn,
    qty: data.qty || 1,
    status: assignedCode ? 'DISPATCHED' : 'QUEUED',
    assignedRobotCode: assignedCode,
    createdAt: new Date().toISOString(),
    startedAt: assignedCode ? new Date().toISOString() : undefined
  };

  missionQueue.unshift(mission);

  // Update robot state if assigned
  if (assignedCode) {
    fleetDevices = fleetDevices.map(d => {
      if (d.code === assignedCode) {
        return {
          ...d,
          status: 'NAVIGATING',
          currentMissionCode: missionCode,
          lastPing: new Date().toISOString()
        };
      }
      return d;
    });
  }

  return mission;
}

export function updateWcsMissionFromWebhook(payload: {
  missionCode: string;
  robotCode?: string;
  status: 'IN_TRANSIT' | 'COMPLETED' | 'FAILED';
  batteryLevel?: number;
  currentLocation?: string;
  errorMessage?: string;
}): { success: boolean; mission?: WcsMission; error?: string } {
  const missionIndex = missionQueue.findIndex(m => m.missionCode === payload.missionCode);
  if (missionIndex === -1) {
    return { success: false, error: `Mission code ${payload.missionCode} not found` };
  }

  const currentMission = missionQueue[missionIndex];
  const updatedMission: WcsMission = {
    ...currentMission,
    status: payload.status,
    completedAt: payload.status === 'COMPLETED' ? new Date().toISOString() : currentMission.completedAt,
    errorMessage: payload.errorMessage
  };

  missionQueue[missionIndex] = updatedMission;

  // Update fleet device status
  const robotCode = payload.robotCode || currentMission.assignedRobotCode;
  if (robotCode) {
    fleetDevices = fleetDevices.map(d => {
      if (d.code === robotCode) {
        return {
          ...d,
          status: payload.status === 'COMPLETED' ? 'IDLE' : payload.status === 'FAILED' ? 'ERROR' : 'NAVIGATING',
          currentMissionCode: payload.status === 'COMPLETED' ? undefined : d.currentMissionCode,
          batteryLevel: typeof payload.batteryLevel === 'number' ? payload.batteryLevel : Math.max(10, d.batteryLevel - 2),
          currentLocation: payload.currentLocation || (payload.status === 'COMPLETED' ? currentMission.targetBin : d.currentLocation),
          lastPing: new Date().toISOString()
        };
      }
      return d;
    });
  }

  return { success: true, mission: updatedMission };
}

/**
 * Simulate Robot Step (for client live demos without physical AGVs plugged in)
 */
export function simulateFleetMovement(): { message: string; updatedMissions: number } {
  let updatedCount = 0;

  missionQueue = missionQueue.map(m => {
    if (m.status === 'DISPATCHED') {
      updatedCount++;
      return { ...m, status: 'IN_TRANSIT' };
    }
    if (m.status === 'IN_TRANSIT') {
      updatedCount++;
      // Complete mission
      if (m.assignedRobotCode) {
        fleetDevices = fleetDevices.map(d => {
          if (d.code === m.assignedRobotCode) {
            return {
              ...d,
              status: 'IDLE',
              currentLocation: m.targetBin,
              currentMissionCode: undefined,
              batteryLevel: Math.max(15, d.batteryLevel - 3),
              lastPing: new Date().toISOString()
            };
          }
          return d;
        });
      }
      return { ...m, status: 'COMPLETED', completedAt: new Date().toISOString() };
    }
    return m;
  });

  return {
    message: updatedCount > 0 ? 'Simulated next robot trajectory step successfully' : 'No active missions in progress',
    updatedMissions: updatedCount
  };
}
