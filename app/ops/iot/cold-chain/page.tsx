'use client';

import React, { useState, useEffect } from 'react';
import {
  ThermometerSnowflake,
  Droplets,
  Battery,
  Bell,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SensorTelemetry } from '@/lib/iot/sensorEngine';
import { NotificationResult } from '@/lib/notifications/notificationGateway';
import { ExperimentalBanner } from '@/components/ui/ExperimentalBanner';
import { errorMessage } from '@/lib/errors';

export default function ColdChainIotPage() {
  const [sensors, setSensors] = useState<SensorTelemetry[]>([]);
  const [notifications, setNotifications] = useState<NotificationResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Test notification form state
  const [testTitle, setTestTitle] = useState('อุณหภูมิห้องแช่แข็งผิดปกติ');
  const [testMessage, setTestMessage] = useState('ห้องแช่แข็งอาหารสด (Deep Freezer A) อุณหภูมิพุ่งแตะ -14.2°C');
  const [isSending, setIsSending] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, nRes] = await Promise.all([
        fetch('/api/iot/telemetry'),
        fetch('/api/notifications/test'),
      ]);
      const sData = await sRes.json();
      const nData = await nRes.json();
      if (sData.sensors) setSensors(sData.sensors);
      if (nData.history) setNotifications(nData.history);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'MOCK_STAGING',
          eventType: 'IOT_TEMP_ALERT',
          title: testTitle,
          message: testMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('จำลองส่งแจ้งเตือนเข้า Notification Queue สำเร็จ!');
        fetchData();
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <ExperimentalBanner>
          ยังไม่ได้ต่อเซนเซอร์จริง — ค่าอุณหภูมิมาจากการส่งทดสอบ และการแจ้งเตือนส่งเข้าคิว MOCK_STAGING ไม่ถึงผู้รับจริง
        </ExperimentalBanner>

        {/* Open Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <Sparkles className="w-3 h-3 text-sky-600" />
                Cold-Chain IoT Telemetry & Alerts
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12 border border-sky-500/20 text-sky-700">
                <ThermometerSnowflake className="w-5 h-5" />
              </span>
              <span>Cold-Chain IoT Sensors & Alert Monitor</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              ตรวจวัดอุณหภูมิและความชื้นห้องเย็น/ยา/อาหารสดแบบ Real-Time พร้อมโครงสร้างระบบส่งต่อแจ้งเตือน
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-white/85 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full border border-slate-200/80 shadow-xs transition flex items-center gap-2 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>

        {/* Sensor Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sensors.map((sensor) => (
            <div
              key={sensor.sensorId}
              className={`nx-glass-card p-6 transition space-y-4 ${
                sensor.status === 'CRITICAL'
                  ? 'ring-2 ring-rose-500/60 border-rose-500/40'
                  : sensor.status === 'WARNING'
                  ? 'ring-2 ring-amber-500/60 border-amber-500/40'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                <span className="font-mono text-xs font-bold text-slate-500">{sensor.sensorId}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    sensor.status === 'NORMAL'
                      ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20'
                      : sensor.status === 'WARNING'
                      ? 'bg-amber-500/15 text-amber-800 border-amber-500/25'
                      : 'bg-rose-500/12 text-rose-700 border-rose-500/20'
                  }`}
                >
                  {sensor.status === 'NORMAL' ? 'ปกติ (Normal)' : 'ผิดปกติ (Alert)'}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">{sensor.zoneName}</h3>
                <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                  เกณฑ์ควบคุม: {sensor.minTempLimit}°C ถึง {sensor.maxTempLimit}°C
                </p>
              </div>

              {/* Giant Temperature Readout */}
              <div className="flex items-baseline justify-between pt-2">
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-5xl font-bold font-mono tracking-tight tabular-nums ${
                      sensor.status === 'CRITICAL'
                        ? 'text-rose-600'
                        : sensor.status === 'WARNING'
                        ? 'text-amber-600'
                        : 'text-sky-700'
                    }`}
                  >
                    {sensor.temperature > 0 ? `+${sensor.temperature}` : sensor.temperature}
                  </span>
                  <span className="text-lg font-bold text-slate-500">°C</span>
                </div>
                <div className="text-right text-xs text-slate-600 space-y-1 tabular-nums">
                  <div className="flex items-center justify-end gap-1 font-mono">
                    <Droplets className="w-3.5 h-3.5 text-sky-600" /> {sensor.humidity}% RH
                  </div>
                  <div className="flex items-center justify-end gap-1 font-mono">
                    <Battery className="w-3.5 h-3.5 text-emerald-600" /> {sensor.batteryPct}%
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 pt-2.5 border-t border-slate-200/70 flex justify-between">
                <span>อัปเดตล่าสุด:</span>
                <span className="font-mono text-slate-800 font-semibold tabular-nums">
                  {new Date(sensor.recordedAt).toLocaleTimeString('th-TH')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Notification Scaffolding Test & Audit Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Test Dispatcher Form */}
          <div className="nx-glass-card p-6 space-y-4">
            <div className="border-b border-slate-200/70 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                โครงสร้างระบบแจ้งเตือน (Notification Gateway Scaffolding)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                รองรับ LINE Notify, Webhook, และ Staging Queue ป้องกันการ Error เมื่อยังไม่ใส่ Token จริง
              </p>
            </div>

            <form onSubmit={handleSendTestNotification} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">หัวข้อแจ้งเตือน</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200/80 rounded-xl bg-white/90 text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">ข้อความแจ้งเตือน</label>
                <textarea
                  rows={2}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200/80 rounded-xl bg-white/90 text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-900 text-[11px] leading-relaxed">
                💡 <strong>สถาปัตยกรรมพร้อมเชื่อมต่อ:</strong> ตัวจัดการ Notification Gateway
                (`lib/notifications/notificationGateway.ts`) ถูกออกแบบให้เชื่อมต่อ LINE Token หรือ Webhook URL
                ได้ทันทีในอนาคต
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-semibold shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> ทดสอบส่งเข้าคิวแจ้งเตือน (Simulate Dispatch)
              </button>
            </form>
          </div>

          {/* Right: Notification History Queue */}
          <div className="nx-glass-card p-6 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">ประวัติคิวการแจ้งเตือน (Event Queue Log)</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">ยังไม่มีประวัติการส่งแจ้งเตือน</div>
              ) : (
                notifications.map((n, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-white/80 rounded-2xl border border-slate-200/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-700">{n.channel}</span>
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {new Date(n.timestamp).toLocaleTimeString('th-TH')}
                      </span>
                    </div>
                    <div className="text-slate-800 font-medium">{n.logMessage}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
