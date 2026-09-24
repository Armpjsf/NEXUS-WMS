import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { evaluateSensorReading } from '@/lib/iot/sensorEngine';
import { dispatchNotification } from '@/lib/notifications/notificationGateway';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

function deriveStatus(temp: number, min: number, max: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  if (temp > max) return temp > max + 2 ? 'CRITICAL' : 'WARNING';
  if (temp < min) return temp < min - 2 ? 'CRITICAL' : 'WARNING';
  return 'NORMAL';
}

// GET — latest reading per sensor (from iot_sensor_telemetry).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const { data } = await getServiceSupabase()
      .from('iot_sensor_telemetry').select('*').eq('org_id', orgId)
      .order('recorded_at', { ascending: false }).limit(1000);
    const latest = new Map<string, any>();
    for (const r of data || []) if (!latest.has(r.sensor_id)) latest.set(r.sensor_id, r);
    const sensors = Array.from(latest.values()).map((r: any) => {
      const min = Number(r.min_temp_limit ?? -22), max = Number(r.max_temp_limit ?? -18), temp = Number(r.temperature);
      return {
        sensorId: r.sensor_id, zoneName: r.zone_name, temperature: temp, humidity: Number(r.humidity),
        batteryPct: Number(r.battery_pct ?? 100), minTempLimit: min, maxTempLimit: max,
        status: deriveStatus(temp, min, max), alertMessage: r.alert_message || undefined, recordedAt: r.recorded_at,
      };
    });
    return NextResponse.json({ success: true, sensors });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err), sensors: [] }, { status: 200 });
  }
}

// POST — a sensor (or manual entry) records a reading; persisted + alerts.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const body = await req.json();
    const reading = evaluateSensorReading(
      body.sensorId || 'IOT-CUSTOM',
      body.zoneName || 'ห้องควบคุมอุณหภูมิ',
      Number(body.temperature),
      Number(body.humidity) || 50,
      Number(body.minTempLimit) || -22,
      Number(body.maxTempLimit) || -18,
    );

    await getServiceSupabase().from('iot_sensor_telemetry').insert({
      org_id: orgId, sensor_id: reading.sensorId, zone_name: reading.zoneName,
      temperature: reading.temperature, humidity: reading.humidity,
      battery_pct: Number(body.batteryPct ?? reading.batteryPct),
      min_temp_limit: reading.minTempLimit, max_temp_limit: reading.maxTempLimit,
      alert_triggered: reading.status !== 'NORMAL', alert_message: reading.alertMessage || '',
      recorded_at: new Date().toISOString(),
    });

    if (reading.status !== 'NORMAL') {
      await dispatchNotification({
        eventType: 'IOT_TEMP_ALERT',
        title: `แจ้งเตือนอุณหภูมิห้องเย็นผิดปกติ: ${reading.zoneName}`,
        message: `${reading.alertMessage} (วัดได้: ${reading.temperature}°C) ตรวจสอบด่วน`,
      });
    }

    return NextResponse.json({ success: true, reading });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
