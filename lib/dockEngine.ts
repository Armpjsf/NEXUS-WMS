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

export const initialDockAppointments: DockAppointment[] = [];

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
