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

export const initialColdChainSensors: SensorTelemetry[] = [];

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
