import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initialColdChainSensors, evaluateSensorReading, SensorTelemetry } from '@/lib/iot/sensorEngine';
import { dispatchNotification } from '@/lib/notifications/notificationGateway';

let memorySensors: SensorTelemetry[] = [...initialColdChainSensors];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ success: true, sensors: memorySensors });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const reading = evaluateSensorReading(
      body.sensorId || 'IOT-CUSTOM',
      body.zoneName || 'ห้องควบคุมอุณหภูมิ',
      Number(body.temperature),
      Number(body.humidity) || 50,
      Number(body.minTempLimit) || -22,
      Number(body.maxTempLimit) || -18
    );

    // Update in-memory sensor reading
    const existingIndex = memorySensors.findIndex(s => s.sensorId === reading.sensorId);
    if (existingIndex >= 0) {
      memorySensors[existingIndex] = reading;
    } else {
      memorySensors.push(reading);
    }

    // Trigger Notification if Warning or Critical
    if (reading.status !== 'NORMAL') {
      await dispatchNotification({
        eventType: 'IOT_TEMP_ALERT',
        title: `แจ้งเตือนอุณหภูมิห้องเย็นผิดปกติ: ${reading.zoneName}`,
        message: `${reading.alertMessage} (วัดได้: ${reading.temperature}°C) ตรวจสอบด่วน`
      });
    }

    return NextResponse.json({ success: true, reading });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
