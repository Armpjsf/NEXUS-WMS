/**
 * Dock Appointment & Yard Scheduling Engine
 * Manages loading bays, time slots, and inbound/outbound carrier appointments.
 */

export interface DockAppointment {
  id: string;
  appointmentNumber: string;
  bayName: string; // e.g. BAY-01, BAY-02
  appointmentType: 'INBOUND' | 'OUTBOUND';
  supplierOrCarrier: string;
  vehiclePlate: string;
  driverName?: string;
  driverPhone?: string;
  scheduledStart: string;
  scheduledEnd: string;
  palletsCount: number;
  status: 'BOOKED' | 'CHECKED_IN' | 'AT_BAY' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
}

export const initialDockAppointments: DockAppointment[] = [
  {
    id: 'dock-001',
    appointmentNumber: 'APT-2026-0901',
    bayName: 'BAY-01 (Inbound)',
    appointmentType: 'INBOUND',
    supplierOrCarrier: 'บจก. สยามโลจิสติกส์ ขนส่ง',
    vehiclePlate: '70-1234 กทม.',
    driverName: 'นายสมศักดิ์ ขยันยิ่ง',
    driverPhone: '081-111-2233',
    scheduledStart: new Date(Date.now() - 30 * 60000).toISOString(),
    scheduledEnd: new Date(Date.now() + 60 * 60000).toISOString(),
    palletsCount: 14,
    status: 'AT_BAY',
    notes: 'ส่งมอบอินเวอร์เตอร์และสายไฟ เข้าตู้ A'
  },
  {
    id: 'dock-002',
    appointmentNumber: 'APT-2026-0902',
    bayName: 'BAY-02 (Outbound)',
    appointmentType: 'OUTBOUND',
    supplierOrCarrier: 'Flash Express (เข้ารับพัสดุรอบบ่าย)',
    vehiclePlate: '3ฒณ-8821 กทม.',
    driverName: 'นายวีระพล รวดเร็ว',
    driverPhone: '089-999-4455',
    scheduledStart: new Date(Date.now() + 90 * 60000).toISOString(),
    scheduledEnd: new Date(Date.now() + 150 * 60000).toISOString(),
    palletsCount: 22,
    status: 'BOOKED',
    notes: 'รับออเดอร์ E-Commerce Shopee/Lazada'
  }
];

export function checkBayConflict(
  existingAppointments: DockAppointment[],
  bayName: string,
  start: Date,
  end: Date,
  excludeId?: string
): boolean {
  return existingAppointments.some(apt => {
    if (apt.id === excludeId) return false;
    if (apt.bayName !== bayName) return false;
    if (apt.status === 'CANCELLED' || apt.status === 'COMPLETED') return false;

    const aptStart = new Date(apt.scheduledStart);
    const aptEnd = new Date(apt.scheduledEnd);

    // Overlap check
    return start < aptEnd && end > aptStart;
  });
}
