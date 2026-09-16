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

/**
 * ระบบยังไม่มีการเก็บสถิติประสิทธิภาพรายบุคคล (stock_transactions ไม่มี field ผู้ทำรายการ)
 * จึงคืนค่าว่างตามจริง แทนการโชว์ข้อมูลตัวอย่าง เมื่อเปิดใช้การบันทึกผู้ปฏิบัติงานแล้ว
 * ค่อยผูกกับข้อมูลจริงที่นี่
 */
export function getStaffPerformanceData(): StaffPerformanceSummary {
  const staffList: StaffMetric[] = [];

  const activeStaff = staffList.filter(s => s.status === 'ACTIVE');
  const avgPicksHr = staffList.length ? Math.round(staffList.reduce((a, b) => a + b.picksPerHour, 0) / staffList.length) : 0;
  const avgAccuracy = staffList.length ? +(staffList.reduce((a, b) => a + b.accuracyRate, 0) / staffList.length).toFixed(1) : 0;
  const avgMinutes = staffList.length ? +(staffList.reduce((a, b) => a + b.avgTurnaroundMinutes, 0) / staffList.length).toFixed(1) : 0;

  return {
    activeStaffCount: activeStaff.length,
    warehousePicksPerHour: avgPicksHr,
    overallAccuracyRate: avgAccuracy,
    avgOrderFulfillmentMinutes: avgMinutes,
    topPerformers: staffList.slice(0, 3),
    staffList,
  };
}
