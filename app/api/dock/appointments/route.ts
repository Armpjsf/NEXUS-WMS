import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initialDockAppointments, DockAppointment, checkBayConflict } from '@/lib/dockEngine';

let memoryAppointments = [...initialDockAppointments];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ success: true, appointments: memoryAppointments });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    
    // Check if updating status
    if (body.action === 'UPDATE_STATUS') {
      const apt = memoryAppointments.find(a => a.id === body.id);
      if (!apt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
      apt.status = body.status;
      return NextResponse.json({ success: true, appointment: apt });
    }

    const startTime = new Date(body.scheduledStart);
    const duration = Number(body.durationMinutes) || 60;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const hasConflict = checkBayConflict(memoryAppointments, body.bayName, startTime, endTime);
    if (hasConflict) {
      return NextResponse.json({
        error: `ช่วงเวลาดังกล่าวมีรถเทียบท่าหรือจองช่อง ${body.bayName} ไว้แล้ว กรุณาเลือกช่วงเวลาหรือเบย์อื่น`
      }, { status: 409 });
    }

    const newApt: DockAppointment = {
      id: `dock-${Date.now()}`,
      appointmentNumber: `APT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      bayName: body.bayName,
      appointmentType: body.appointmentType || 'INBOUND',
      supplierOrCarrier: body.supplierOrCarrier,
      vehiclePlate: body.vehiclePlate,
      driverName: body.driverName || '',
      driverPhone: body.driverPhone || '',
      scheduledStart: startTime.toISOString(),
      scheduledEnd: endTime.toISOString(),
      palletsCount: Number(body.palletsCount) || 1,
      status: 'BOOKED',
      notes: body.notes || ''
    };

    memoryAppointments.unshift(newApt);
    return NextResponse.json({ success: true, appointment: newApt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
