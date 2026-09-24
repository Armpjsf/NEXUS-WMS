import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { checkBayConflict, DockAppointment } from '@/lib/dockEngine';
import { nextDocNumber } from '@/lib/docNumber';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

function mapApt(r: any): DockAppointment {
  return {
    id: r.id,
    appointmentNumber: r.appointment_number,
    bayName: r.bay_name,
    appointmentType: r.appointment_type,
    supplierOrCarrier: r.supplier_or_carrier,
    vehiclePlate: r.vehicle_plate,
    driverName: r.driver_name || '',
    driverPhone: r.driver_phone || '',
    scheduledStart: r.scheduled_start,
    scheduledEnd: r.scheduled_end,
    palletsCount: Number(r.pallets_count || 1),
    status: r.status || 'BOOKED',
    notes: r.notes || '',
  } as DockAppointment;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await getServiceSupabase()
      .from('dock_appointments')
      .select('*')
      .eq('org_id', orgId)
      .order('scheduled_start', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, appointments: (data || []).map(mapApt) });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err), appointments: [] }, { status: 200 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const admin = getServiceSupabase();
    const body = await req.json();

    // อัปเดตสถานะ (เช็คอิน/เข้าเบย์/ปิดงาน)
    if (body.action === 'UPDATE_STATUS') {
      const { data, error } = await admin
        .from('dock_appointments')
        .update({ status: body.status })
        .eq('org_id', orgId).eq('id', body.id)
        .select().maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
      return NextResponse.json({ success: true, appointment: mapApt(data) });
    }

    // สร้างการจองใหม่ + เช็คชนช่วงเวลาเบย์
    const startTime = new Date(body.scheduledStart);
    const duration = Number(body.durationMinutes) || 60;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const { data: existingRows } = await admin
      .from('dock_appointments').select('*').eq('org_id', orgId).eq('bay_name', body.bayName);
    const existing = (existingRows || []).map(mapApt);
    if (checkBayConflict(existing, body.bayName, startTime, endTime)) {
      return NextResponse.json({
        error: `ช่วงเวลาดังกล่าวมีรถเทียบท่าหรือจองช่อง ${body.bayName} ไว้แล้ว กรุณาเลือกช่วงเวลาหรือเบย์อื่น`,
      }, { status: 409 });
    }

    const apptNumber = await nextDocNumber('APT', { date: 'yyyymmdd', pad: 4, existing: { table: 'dock_appointments', column: 'appointment_number' } });
    const { data, error } = await admin
      .from('dock_appointments')
      .insert({
        org_id: orgId,
        appointment_number: apptNumber,
        bay_name: body.bayName,
        appointment_type: body.appointmentType || 'INBOUND',
        supplier_or_carrier: body.supplierOrCarrier || '',
        vehicle_plate: body.vehiclePlate || '',
        driver_name: body.driverName || '',
        driver_phone: body.driverPhone || '',
        scheduled_start: startTime.toISOString(),
        scheduled_end: endTime.toISOString(),
        pallets_count: Number(body.palletsCount) || 1,
        status: 'BOOKED',
        notes: body.notes || '',
      })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, appointment: mapApt(data) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
