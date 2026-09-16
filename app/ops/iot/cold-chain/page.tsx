'use client';

import React, { useState, useEffect } from 'react';
import {
  ThermometerSnowflake,
  Droplets,
  Battery,
  AlertTriangle,
  Bell,
  RefreshCw,
  Send,
  CheckCircle2,
  ShieldCheck,
  Flame,
  Sparkles
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import toast from 'react-hot-toast';
import { SensorTelemetry } from '@/lib/iot/sensorEngine';
import { NotificationResult } from '@/lib/notifications/notificationGateway';

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
        fetch('/api/notifications/test')
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
          message: testMessage
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('จำลองส่งแจ้งเตือนเข้า Notification Queue สำเร็จ!');
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 font-mono text-[#dee2ec]">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">

        {/* Header Tactical Banner */}
        <div className="relative mx-auto flex flex-col gap-4 overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23]/90 p-5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
          <div className="relative z-10">
            <p className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4cd7f6] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#4cd7f6]" />
              COLD-CHAIN IOT TELEMETRY & MULTI-CHANNEL NOTIFICATION GATEWAY
            </p>
            <h1 className="font-headline text-2xl md:text-3xl font-black text-[#dee2ec] tracking-tight mb-1 flex items-center gap-3">
              <div className="bg-[#4cd7f6] text-[#042027] p-2 rounded-lg shadow-md">
                <ThermometerSnowflake className="w-6 h-6" />
              </div>
              Cold-Chain IoT Sensors & Alert Monitor
            </h1>
            <p className="text-[#8a92a6] font-mono text-xs">
              ตรวจวัดอุณหภูมิและความชื้นห้องเย็น/ยา/อาหารสดแบบ Real-Time พร้อมโครงสร้างระบบส่งต่อแจ้งเตือน
            </p>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] rounded-xl border border-[#30353d] transition flex items-center gap-2 text-xs font-bold relative z-10"
          >
            <RefreshCw className="w-4 h-4" /> รีเฟรชข้อมูล
          </button>
        </div>

        {/* Sensor Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sensors.map((sensor) => (
            <div
              key={sensor.sensorId}
              className={`p-6 rounded-2xl border shadow-xl backdrop-blur-md transition space-y-4 bg-[#171c23]/90 ${
                sensor.status === 'CRITICAL'
                  ? 'border-[#ff5449] ring-1 ring-[#ff5449]'
                  : sensor.status === 'WARNING'
                  ? 'border-[#facc15] ring-1 ring-[#facc15]'
                  : 'border-[#30353d]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
                <span className="font-mono text-xs font-bold text-[#8a92a6]">{sensor.sensorId}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  sensor.status === 'NORMAL' ? 'bg-[#57ec7f]/20 text-[#57ec7f] border border-[#57ec7f]/30' : 'bg-[#ff5449]/20 text-[#ffb4ab] border border-[#ff5449]/30'
                }`}>
                  {sensor.status === 'NORMAL' ? 'ปกติ (Normal)' : 'ผิดปกติ (Alert)'}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-black text-[#dee2ec]">{sensor.zoneName}</h3>
                <p className="text-[11px] text-[#8a92a6]">เกณฑ์ควบคุม: {sensor.minTempLimit}°C ถึง {sensor.maxTempLimit}°C</p>
              </div>

              {/* Giant Temperature Readout */}
              <div className="flex items-baseline justify-between pt-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black font-mono text-[#4cd7f6] tracking-tight">
                    {sensor.temperature > 0 ? `+${sensor.temperature}` : sensor.temperature}
                  </span>
                  <span className="text-lg font-bold text-[#8a92a6]">°C</span>
                </div>
                <div className="text-right text-xs text-[#8a92a6] space-y-1">
                  <div className="flex items-center gap-1 font-mono">
                    <Droplets className="w-3.5 h-3.5 text-[#4cd7f6]" /> {sensor.humidity}% RH
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <Battery className="w-3.5 h-3.5 text-[#57ec7f]" /> {sensor.batteryPct}%
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-[#8a92a6] pt-2 border-t border-[#262c36] flex justify-between">
                <span>อัปเดตล่าสุด:</span>
                <span className="font-mono text-[#dee2ec]">{new Date(sensor.recordedAt).toLocaleTimeString('th-TH')}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Notification Scaffolding Test & Audit Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Test Dispatcher Form */}
          <div className="bg-[#171c23]/90 p-5 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl space-y-4">
            <div className="border-b border-[#30353d] pb-3">
              <h3 className="font-bold text-[#dee2ec] text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#facc15]" />
                โครงสร้างระบบแจ้งเตือน (Notification Gateway Scaffolding)
              </h3>
              <p className="text-xs text-[#8a92a6]">
                รองรับ LINE Notify, Webhook, และ Staging Queue ป้องกันการ Error เมื่อยังไม่ใส่ Token จริง
              </p>
            </div>

            <form onSubmit={handleSendTestNotification} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#8a92a6] font-bold mb-1">หัวข้อแจ้งเตือน</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[#8a92a6] font-bold mb-1">ข้อความแจ้งเตือน</label>
                <textarea
                  rows={2}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-[#facc15]/10 border border-[#facc15]/30 rounded-xl text-[#facc15] text-[11px] leading-relaxed">
                💡 <strong>สถาปัตยกรรมพร้อมเชื่อมต่อ:</strong> ตัวจัดการ Notification Gateway (`lib/notifications/notificationGateway.ts`) ถูกออกแบบให้เชื่อมต่อ LINE Token หรือ Webhook URL ได้ทันทีในอนาคต
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2.5 bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#042027] rounded-xl font-black shadow flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" /> ทดสอบส่งเข้าคิวแจ้งเตือน (Simulate Dispatch)
              </button>
            </form>
          </div>

          {/* Right: Notification History Queue */}
          <div className="bg-[#171c23]/90 p-5 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl space-y-3">
            <h3 className="font-bold text-[#dee2ec] text-sm">ประวัติคิวการแจ้งเตือน (Event Queue Log)</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-[#8a92a6] text-xs">ยังไม่มีประวัติการส่งแจ้งเตือน</div>
              ) : (
                notifications.map((n, idx) => (
                  <div key={idx} className="p-3 bg-[#12161d] rounded-xl border border-[#30353d] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#4cd7f6]">{n.channel}</span>
                      <span className="font-mono text-[10px] text-[#8a92a6]">{new Date(n.timestamp).toLocaleTimeString('th-TH')}</span>
                    </div>
                    <div className="text-[#dee2ec] font-medium">{n.logMessage}</div>
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
