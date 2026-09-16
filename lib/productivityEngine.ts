/**
 * Labor Management & Warehouse Productivity Engine (LMS)
 * WMS Smart Enterprise - Phase 2
 */

export interface OperatorKPI {
  userId: string;
  userName: string;
  tasksCompleted: number;
  totalUnitsProcessed: number;
  activeHours: number;
  picksPerHour: number;
  accuracyRate: number;
  rating: 'EXCELLENT' | 'GOOD' | 'ON_TRACK' | 'NEEDS_IMPROVEMENT';
}

export interface ProductivitySummary {
  overallThroughputUnits: number;
  averagePph: number;
  activeOperatorsCount: number;
  pickPphAverage: number;
  putawayPphAverage: number;
  accuracyRateOverall: number;
  topPerformers: OperatorKPI[];
  zoneCongestionAlerts: Array<{ zone: string; status: 'NORMAL' | 'HEAVY' | 'CONGESTED'; activeWorkers: number; bottleneckReason: string }>;
}

export function calculatePPH(units: number, seconds: number): number {
  if (seconds <= 0) return 0;
  const hours = seconds / 3600;
  return Number((units / hours).toFixed(1));
}

export function evaluateOperatorRating(pph: number, accuracy: number): OperatorKPI['rating'] {
  if (pph >= 110 && accuracy >= 99) return 'EXCELLENT';
  if (pph >= 80 && accuracy >= 97) return 'GOOD';
  if (pph >= 50 && accuracy >= 95) return 'ON_TRACK';
  return 'NEEDS_IMPROVEMENT';
}

export function getProductivityAnalytics(): ProductivitySummary {
  const operators: OperatorKPI[] = [
    {
      userId: 'OPR-01',
      userName: 'สมศักดิ์ ขยันยิ่ง (หัวหน้าทีมหยิบ A)',
      tasksCompleted: 48,
      totalUnitsProcessed: 680,
      activeHours: 5.5,
      picksPerHour: 123.6,
      accuracyRate: 99.8,
      rating: 'EXCELLENT'
    },
    {
      userId: 'OPR-02',
      userName: 'วิชัย รวดเร็ว (Forklift Driver)',
      tasksCompleted: 34,
      totalUnitsProcessed: 510,
      activeHours: 5.2,
      picksPerHour: 98.1,
      accuracyRate: 99.2,
      rating: 'GOOD'
    },
    {
      userId: 'OPR-03',
      userName: 'อนุชา จัดวาง (พนักงานรับของ GRN)',
      tasksCompleted: 26,
      totalUnitsProcessed: 390,
      activeHours: 4.8,
      picksPerHour: 81.3,
      accuracyRate: 98.5,
      rating: 'GOOD'
    },
    {
      userId: 'OPR-04',
      userName: 'กิตติศักดิ์ พึ่งเริ่มงาน (Operator)',
      tasksCompleted: 15,
      totalUnitsProcessed: 180,
      activeHours: 4.0,
      picksPerHour: 45.0,
      accuracyRate: 96.0,
      rating: 'ON_TRACK'
    }
  ];

  return {
    overallThroughputUnits: 1760,
    averagePph: 87.0,
    activeOperatorsCount: 4,
    pickPphAverage: 110.8,
    putawayPphAverage: 74.2,
    accuracyRateOverall: 98.4,
    topPerformers: operators,
    zoneCongestionAlerts: [
      { zone: 'Zone A (Fast-Moving)', status: 'HEAVY', activeWorkers: 3, bottleneckReason: 'มีงานหยิบ Wave และออเดอร์เร่งด่วนเบียดกันในซอย 01' },
      { zone: 'Zone B (Normal Storage)', status: 'NORMAL', activeWorkers: 1, bottleneckReason: 'การจราจรคล่องตัว' },
      { zone: 'Receiving Dock', status: 'NORMAL', activeWorkers: 1, bottleneckReason: 'รอรับตู้คอนเทนเนอร์ช่วงบ่าย' }
    ]
  };
}
