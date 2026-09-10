// Staff Performance and Warehouse Productivity Analytics

export interface StaffMetric {
  id: string;
  name: string;
  avatar: string;
  role: string;
  branch: string;
  totalPicks: number;
  picksPerHour: number;
  packedOrders: number;
  cycleCountsCompleted: number;
  accuracyRate: number; // e.g. 99.4%
  avgTurnaroundMinutes: number;
  status: 'ACTIVE' | 'BREAK' | 'OFFLINE';
  score: number; // 0-100
  badge?: string;
}

export interface StaffPerformanceSummary {
  activeStaffCount: number;
  warehousePicksPerHour: number;
  overallAccuracyRate: number;
  avgOrderFulfillmentMinutes: number;
  topPerformers: StaffMetric[];
  staffList: StaffMetric[];
}

export function getStaffPerformanceData(): StaffPerformanceSummary {
  const staffList: StaffMetric[] = [
    {
      id: 'st-01',
      name: 'สมชาย ใจมั่นคง',
      avatar: '👨‍💼',
      role: 'Lead Picker',
      branch: 'สำนักงานใหญ่ (HQ)',
      totalPicks: 342,
      picksPerHour: 48,
      packedOrders: 92,
      cycleCountsCompleted: 14,
      accuracyRate: 99.8,
      avgTurnaroundMinutes: 8.5,
      status: 'ACTIVE',
      score: 98,
      badge: '🏆 Top Picker',
    },
    {
      id: 'st-02',
      name: 'วิภาดา รุ่งอรุณ',
      avatar: '👩‍💼',
      role: 'Picker & Packer',
      branch: 'สำนักงานใหญ่ (HQ)',
      totalPicks: 298,
      picksPerHour: 42,
      packedOrders: 118,
      cycleCountsCompleted: 9,
      accuracyRate: 99.5,
      avgTurnaroundMinutes: 9.2,
      status: 'ACTIVE',
      score: 95,
      badge: '⚡ Speed Master',
    },
    {
      id: 'st-03',
      name: 'ธีรศักดิ์ สุขประเสริฐ',
      avatar: '👨‍🔧',
      role: 'Inventory Controller',
      branch: 'สาขาสุราษฎร์ธานี (URT)',
      totalPicks: 245,
      picksPerHour: 36,
      packedOrders: 64,
      cycleCountsCompleted: 28,
      accuracyRate: 100.0,
      avgTurnaroundMinutes: 11.0,
      status: 'ACTIVE',
      score: 94,
      badge: '🎯 Zero Error',
    },
    {
      id: 'st-04',
      name: 'กานดา ชูเชิด',
      avatar: '👩‍🔧',
      role: 'Picker',
      branch: 'สาขาสมุทรสาคร (SKN)',
      totalPicks: 215,
      picksPerHour: 32,
      packedOrders: 51,
      cycleCountsCompleted: 12,
      accuracyRate: 98.9,
      avgTurnaroundMinutes: 12.4,
      status: 'BREAK',
      score: 89,
    },
    {
      id: 'st-05',
      name: 'อนุชา เพชรดี',
      avatar: '👨‍💼',
      role: 'Warehouse Assistant',
      branch: 'สำนักงานใหญ่ (HQ)',
      totalPicks: 180,
      picksPerHour: 28,
      packedOrders: 45,
      cycleCountsCompleted: 8,
      accuracyRate: 98.2,
      avgTurnaroundMinutes: 14.2,
      status: 'ACTIVE',
      score: 84,
    },
    {
      id: 'st-06',
      name: 'ปรีชา วงศ์สว่าง',
      avatar: '👨‍🔧',
      role: 'Forklift & Putaway',
      branch: 'สาขาเชียงใหม่ (CMI)',
      totalPicks: 165,
      picksPerHour: 25,
      packedOrders: 38,
      cycleCountsCompleted: 22,
      accuracyRate: 99.1,
      avgTurnaroundMinutes: 15.0,
      status: 'OFFLINE',
      score: 86,
    },
  ];

  const activeStaff = staffList.filter(s => s.status === 'ACTIVE');
  const avgPicksHr = Math.round(staffList.reduce((a, b) => a + b.picksPerHour, 0) / staffList.length);
  const avgAccuracy = +(staffList.reduce((a, b) => a + b.accuracyRate, 0) / staffList.length).toFixed(1);
  const avgMinutes = +(staffList.reduce((a, b) => a + b.avgTurnaroundMinutes, 0) / staffList.length).toFixed(1);

  return {
    activeStaffCount: activeStaff.length,
    warehousePicksPerHour: avgPicksHr,
    overallAccuracyRate: avgAccuracy,
    avgOrderFulfillmentMinutes: avgMinutes,
    topPerformers: staffList.slice(0, 3),
    staffList,
  };
}
