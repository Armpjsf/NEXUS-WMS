/**
 * Cold-Chain IoT Sensor Engine
 * Monitors temperature, humidity, and threshold violations in refrigerated rooms.
 */

export interface SensorTelemetry {
  sensorId: string;
  zoneName: string;
  temperature: number; // °C
  humidity: number;    // %RH
  batteryPct: number;
  minTempLimit: number;
  maxTempLimit: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  alertMessage?: string;
  recordedAt: string;
}

export const initialColdChainSensors: SensorTelemetry[] = [
  {
    sensorId: 'IOT-FREEZER-01',
    zoneName: 'ห้องแช่แข็งอาหารสด (Deep Freezer A)',
    temperature: -20.4,
    humidity: 45.2,
    batteryPct: 94,
    minTempLimit: -22.0,
    maxTempLimit: -18.0,
    status: 'NORMAL',
    recordedAt: new Date().toISOString()
  },
  {
    sensorId: 'IOT-CHILL-02',
    zoneName: 'ห้องเย็นเก็บเวชภัณฑ์และวัคซีน (Pharma Chiller B)',
    temperature: 3.8,
    humidity: 52.0,
    batteryPct: 88,
    minTempLimit: 2.0,
    maxTempLimit: 8.0,
    status: 'NORMAL',
    recordedAt: new Date().toISOString()
  },
  {
    sensorId: 'IOT-DRY-03',
    zoneName: 'ห้องควบคุมความชื้นอุปกรณ์อิเล็กทรอนิกส์ (Dry Room C)',
    temperature: 24.5,
    humidity: 38.0,
    batteryPct: 99,
    minTempLimit: 20.0,
    maxTempLimit: 26.0,
    status: 'NORMAL',
    recordedAt: new Date().toISOString()
  }
];

export function evaluateSensorReading(
  sensorId: string,
  zoneName: string,
  temp: number,
  humidity: number,
  minLimit: number,
  maxLimit: number
): SensorTelemetry {
  let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
  let alertMessage = '';

  if (temp > maxLimit) {
    status = temp > maxLimit + 2 ? 'CRITICAL' : 'WARNING';
    alertMessage = `อุณหภูมิสูงเกินเกณฑ์ (${temp}°C > พิกัดสูงสุด ${maxLimit}°C) เสี่ยงต่อคุณภาพสินค้า`;
  } else if (temp < minLimit) {
    status = temp < minLimit - 2 ? 'CRITICAL' : 'WARNING';
    alertMessage = `อุณหภูมิต่ำกว่าเกณฑ์ (${temp}°C < พิกัดต่ำสุด ${minLimit}°C)`;
  }

  return {
    sensorId,
    zoneName,
    temperature: temp,
    humidity,
    batteryPct: 92,
    minTempLimit: minLimit,
    maxTempLimit: maxLimit,
    status,
    alertMessage: alertMessage || undefined,
    recordedAt: new Date().toISOString()
  };
}
