'use client';

import { useState, useEffect } from 'react';
import {
  Bot,
  Cpu,
  Boxes,
  BatteryCharging,
  Battery,
  CheckCircle2,
  Play,
  RefreshCw,
  Send,
  ArrowRight,
  Code2,
  Radio,
  Plus,
  X,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import toast from 'react-hot-toast';
import { ExperimentalBanner } from '@/components/ui/ExperimentalBanner';
import { errorMessage } from '@/lib/errors';

interface RobotFleetDevice {
  id: string;
  code: string;
  name: string;
  type: 'AGV_PALLET_LIFT' | 'AMR_TOTE_RUNNER' | 'CONVEYOR_SORTER' | 'ASRS_SHUTTLE';
  status: 'IDLE' | 'NAVIGATING' | 'LIFTING' | 'CHARGING' | 'ERROR' | 'OFFLINE';
  batteryLevel: number;
  currentLocation: string;
  currentMissionCode?: string;
  ipAddress?: string;
  lastPing: string;
}

interface WcsMission {
  id: string;
  missionCode: string;
  taskType: 'PALLET_TRANSFER' | 'BIN_TO_PERSON' | 'CONVEYOR_DIVERT' | 'PUTAWAY_RUN';
  priority: number;
  sourceBin: string;
  targetBin: string;
  sku?: string;
  productName?: string;
  lpn?: string;
  qty?: number;
  status: 'QUEUED' | 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  assignedRobotCode?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export default function WcsRoboticsPage() {
  const [fleet, setFleet] = useState<RobotFleetDevice[]>([]);
  const [missions, setMissions] = useState<WcsMission[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showApiDocs, setShowApiDocs] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ code: '', name: '', type: 'AGV_PALLET_LIFT', currentLocation: '' });
  const [savingDevice, setSavingDevice] = useState(false);

  // Form state for dispatch
  const [formTaskType, setFormTaskType] = useState<WcsMission['taskType']>('BIN_TO_PERSON');
  const [formSourceBin, setFormSourceBin] = useState('A-01-02');
  const [formTargetBin, setFormTargetBin] = useState('STATION-PICK-01');
  const [formSku, setFormSku] = useState('SKU-1002');
  const [formProductName, setFormProductName] = useState('น้ำมันเครื่องสังเคราะห์ 100%');
  const [formQty, setFormQty] = useState(5);
  const [formRobotCode, setFormRobotCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchWcsData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wcs/tasks');
      const data = await res.json();
      if (data.success) {
        setFleet(data.fleet || []);
        setMissions(data.missions || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error('Failed to load WCS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWcsData();
    const interval = setInterval(fetchWcsData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulateStep = async () => {
    setSimulating(true);
    try {
      const res = await fetch('/api/wcs/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SIMULATE_STEP' })
      });
      const data = await res.json();
      if (data.success) {
        setFleet(data.fleet);
        setMissions(data.missions);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  const addDevice = async () => {
    if (!newDevice.code.trim() || !newDevice.name.trim()) { toast.error('ระบุรหัสและชื่อหุ่นยนต์'); return; }
    setSavingDevice(true);
    try {
      const res = await fetch('/api/wcs/devices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDevice),
      });
      const data = await res.json();
      if (data.success === false) throw new Error(data.error);
      toast.success(`ลงทะเบียน ${newDevice.code} แล้ว`);
      setNewDevice({ code: '', name: '', type: 'AGV_PALLET_LIFT', currentLocation: '' });
      setShowDeviceModal(false); fetchWcsData();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSavingDevice(false); }
  };

  const deleteDevice = async (code: string) => {
    if (!confirm(`ลบหุ่นยนต์ ${code}?`)) return;
    await fetch(`/api/wcs/devices?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
    fetchWcsData();
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/wcs/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: formTaskType,
          sourceBin: formSourceBin,
          targetBin: formTargetBin,
          sku: formSku,
          productName: formProductName,
          qty: Number(formQty),
          robotCode: formRobotCode || undefined
        })
      });
      const result = await res.json();
      if (result.success) {
        setShowDispatchModal(false);
        fetchWcsData();
      } else {
        alert(result.error || 'ไม่สามารถส่งคำสั่งงานหุ่นยนต์ได้');
      }
    } catch (err) {
      alert(errorMessage(err) || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        <ExperimentalBanner>
          ยังไม่ได้ต่อหุ่นยนต์/AGV จริง — ปุ่ม &quot;จำลองความคืบหน้า&quot; เดินภารกิจแทนอุปกรณ์ ใช้เพื่อทดสอบ flow เท่านั้น
        </ExperimentalBanner>

        {/* Navigation Breadcrumb */}
        <Link href="/ops/tasks" className="text-[#8a92a6] hover:text-cyan-400 flex items-center gap-2 mb-4 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> กลับไปยังระบบงานปฏิบัติการ
        </Link>

        {/* Header */}
        <header className="overflow-hidden rounded-[1.75rem] border border-cyan-500/30 bg-[#171c23] p-6 shadow-xl shadow-cyan-950/20 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 -mx-6 -mt-6 mb-6" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                  <Cpu className="w-7 h-7 text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#dee2ec] flex items-center gap-3">
                    WCS & Robotics API Gateway
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      GATEWAY ONLINE
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm text-[#8a92a6]">
                    ระบบเชื่อมต่อและสั่งการฝูงหุ่นยนต์ AGV, AMR (Hikrobot, Geek+, HaiPick) และสายพานลำเลียงอัตโนมัติ (Conveyor Sorters)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
              <button
                onClick={() => setShowApiDocs(!showApiDocs)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] border border-[#3c424d] text-xs font-semibold transition-all"
              >
                <Code2 className="w-4 h-4 text-cyan-400" />
                {showApiDocs ? 'ซ่อนสเปก API' : 'ดูสเปก API / Webhook'}
              </button>

              <button
                onClick={handleSimulateStep}
                disabled={simulating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                title="กดเพื่อจำลองสถานะการวิ่งของหุ่นยนต์ 1 ขั้นตอน (สำหรับทดสอบ Demo)"
              >
                {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                จำลองความคืบหน้า (Simulate Step)
              </button>

              <button
                onClick={() => setShowDeviceModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] border border-[#3c424d] text-xs font-semibold transition-all"
              >
                <Plus className="w-4 h-4 text-[#57ec7f]" />
                ลงทะเบียนหุ่นยนต์
              </button>

              <button
                onClick={() => setShowDispatchModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                สั่งงานหุ่นยนต์ (Dispatch)
              </button>
            </div>
          </div>
        </header>

        {/* API Integration Specs Drawer / Accordion */}
        {showApiDocs && (
          <div className="rounded-2xl border border-cyan-500/40 bg-[#171c23] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Radio className="w-4 h-4" />
                Open Robotics API & Webhook Specifications (Tier-1 Standard)
              </div>
              <button onClick={() => setShowApiDocs(false)} className="text-[#8a92a6] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-[#c2c8d6]">
              ระบบเปิดรับการเชื่อมต่อกับระบบควบคุมฮาร์ดแวร์ภายนอก (Fleet Management System / PLC) ผ่าน REST APIs และ Webhooks:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-[#111418] p-4 rounded-xl border border-[#30353d] space-y-2">
                <div className="text-emerald-400 font-bold">1. REST Endpoint: สร้างงานหุ่นยนต์ (Dispatch)</div>
                <div className="text-[#8a92a6]">POST /api/wcs/tasks</div>
                <pre className="text-[#dee2ec] overflow-x-auto p-2 bg-[#171c23] rounded border border-[#252a32]">
{`{
  "taskType": "BIN_TO_PERSON", // PALLET_TRANSFER, CONVEYOR_DIVERT
  "sourceBin": "A-01-02",
  "targetBin": "STATION-PICK-01",
  "sku": "SKU-1002",
  "qty": 5,
  "priority": 1
}`}
                </pre>
              </div>

              <div className="bg-[#111418] p-4 rounded-xl border border-[#30353d] space-y-2">
                <div className="text-cyan-400 font-bold">2. Webhook Callback: หุ่นยนต์รายงานสถานะ (Callback)</div>
                <div className="text-[#8a92a6]">POST /api/wcs/callback</div>
                <pre className="text-[#dee2ec] overflow-x-auto p-2 bg-[#171c23] rounded border border-[#252a32]">
{`{
  "missionCode": "WCS-20260917-001",
  "robotCode": "AMR-02",
  "status": "COMPLETED", // IN_TRANSIT, FAILED
  "batteryLevel": 76,
  "currentLocation": "STATION-PICK-01"
}`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Fleet KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#171c23] p-5 rounded-2xl border border-[#30353d] shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">หุ่นยนต์ในระบบ</span>
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#dee2ec]">{stats.totalRobots || fleet.length}</span>
              <span className="text-xs text-emerald-400 font-semibold">({stats.onlineRobots || fleet.length} ออนไลน์)</span>
            </div>
            <p className="text-xs text-[#8a92a6] mt-2">AGV, AMR, AS/RS Shuttles & Sorters</p>
          </div>

          <div className="bg-[#171c23] p-5 rounded-2xl border border-[#30353d] shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">ภารกิจกำลังดำเนินการ</span>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-indigo-400">{stats.activeMissions || 0}</span>
              <span className="text-xs text-[#8a92a6]">งานเคลื่อนที่</span>
            </div>
            <p className="text-xs text-[#8a92a6] mt-2">หุ่นยนต์กำลังนำส่งสินค้าตามราง/พิกัด</p>
          </div>

          <div className="bg-[#171c23] p-5 rounded-2xl border border-[#30353d] shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">สำเร็จแล้ววันนี้</span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400">{stats.completedToday || 0}</span>
              <span className="text-xs text-[#8a92a6]">รอบภารกิจ</span>
            </div>
            <p className="text-xs text-[#8a92a6] mt-2">อัตราความสำเร็จภารกิจ 100%</p>
          </div>

          <div className="bg-[#171c23] p-5 rounded-2xl border border-[#30353d] shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">แบตเตอรี่เฉลี่ยฝูง</span>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <BatteryCharging className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-400">
                {fleet.length ? Math.round(fleet.reduce((acc, r) => acc + r.batteryLevel, 0) / fleet.length) : 0}%
              </span>
              <span className="text-xs text-[#8a92a6]">พร้อมปฏิบัติการ</span>
            </div>
            <p className="text-xs text-[#8a92a6] mt-2">แท่นชาร์จอัตโนมัติ 1 เครื่องกำลังทำงาน</p>
          </div>
        </div>

        {/* Live Robot Fleet Devices Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#dee2ec] flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-400" />
              สถานะฝูงหุ่นยนต์เรียลไทม์ (Live Fleet Telemetry)
            </h2>
            <button onClick={fetchWcsData} className="text-xs text-[#8a92a6] hover:text-white flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              อัปเดตล่าสุด: {new Date().toLocaleTimeString()}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {fleet.map((robot) => (
              <div
                key={robot.id}
                className="group bg-[#171c23] rounded-2xl border border-[#30353d] p-5 shadow-lg flex flex-col justify-between hover:border-cyan-500/40 transition-all relative"
              >
                <button onClick={() => deleteDevice(robot.code)} title="ลบหุ่นยนต์"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-[#8a92a6] hover:text-rose-400 text-xs z-10">✕</button>
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/20">
                        {robot.code}
                      </span>
                      <h3 className="font-bold text-[#dee2ec] text-sm mt-1.5 line-clamp-1">{robot.name}</h3>
                      <p className="text-[11px] text-[#8a92a6]">
                        {robot.type === 'AGV_PALLET_LIFT' && 'หุ่นยนต์ยกพาเลท (Pallet Lift)'}
                        {robot.type === 'AMR_TOTE_RUNNER' && 'หุ่นยนต์นำส่งกล่อง (Tote Runner)'}
                        {robot.type === 'ASRS_SHUTTLE' && 'ระบบชัตเติลรางลึก (Shuttle)'}
                        {robot.type === 'CONVEYOR_SORTER' && 'สายพานคัดแยกความเร็วสูง'}
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                      robot.status === 'IDLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      robot.status === 'NAVIGATING' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 animate-pulse' :
                      robot.status === 'CHARGING' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {robot.status === 'NAVIGATING' && '● กำลังวิ่ง'}
                      {robot.status === 'IDLE' && '● สแตนด์บาย'}
                      {robot.status === 'CHARGING' && '⚡ กำลังชาร์จ'}
                      {robot.status === 'ERROR' && '✕ ขัดข้อง'}
                    </span>
                  </div>

                  {/* Coordinates & Mission */}
                  <div className="mt-3 p-2.5 rounded-xl bg-[#111418] border border-[#252a32] space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#8a92a6]">พิกัดปัจจุบัน:</span>
                      <span className="font-mono text-[#dee2ec] font-bold">{robot.currentLocation}</span>
                    </div>
                    {robot.currentMissionCode && (
                      <div className="flex justify-between">
                        <span className="text-[#8a92a6]">ภารกิจ:</span>
                        <span className="font-mono text-cyan-400 font-semibold">{robot.currentMissionCode}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] text-[#8a92a6]">
                      <span>IP Address:</span>
                      <span className="font-mono">{robot.ipAddress || '192.168.10.x'}</span>
                    </div>
                  </div>
                </div>

                {/* Battery bar */}
                <div className="mt-4 pt-3 border-t border-[#30353d]">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#8a92a6] flex items-center gap-1">
                      {robot.status === 'CHARGING' ? <BatteryCharging className="w-3.5 h-3.5 text-amber-400" /> : <Battery className="w-3.5 h-3.5" />}
                      พลังงานคงเหลือ
                    </span>
                    <span className="font-bold text-[#dee2ec]">{robot.batteryLevel}%</span>
                  </div>
                  <div className="w-full bg-[#252a32] rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        robot.batteryLevel > 50 ? 'bg-emerald-500' :
                        robot.batteryLevel > 20 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${robot.batteryLevel}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Mission Queue */}
        <div className="bg-[#171c23] rounded-2xl border border-[#30353d] shadow-xl overflow-hidden">
          <div className="p-5 border-b border-[#30353d] bg-[#1b2027] flex items-center justify-between">
            <h3 className="font-bold text-[#dee2ec] flex items-center gap-2 text-base">
              <Boxes className="w-5 h-5 text-cyan-400" />
              คิวภารกิจคำสั่งงานหุ่นยนต์ (Mission Dispatch Queue)
              <span className="ml-2 px-2.5 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                {missions.length} ภารกิจ
              </span>
            </h3>
            <span className="text-xs text-[#8a92a6]">
              ส่งตรงจาก WMS ไปยังตัวควบคุมฮาร์ดแวร์ WCS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs uppercase text-[#8a92a6] font-bold border-b border-[#30353d]">
                <tr>
                  <th className="py-3.5 pl-5">รหัสภารกิจ (Mission)</th>
                  <th className="py-3.5">ประเภทคำสั่ง</th>
                  <th className="py-3.5">สินค้า / SKU</th>
                  <th className="py-3.5">เส้นทาง (ต้นทาง ➔ ปลายทาง)</th>
                  <th className="py-3.5">หุ่นยนต์ที่รับมอบ</th>
                  <th className="py-3.5">สถานะ</th>
                  <th className="py-3.5 pr-5 text-right">เวลาสร้าง</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-[#30353d]">
                {missions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#8a92a6]">
                      ยังไม่มีภารกิจในคิว — สามารถกดปุ่ม &quot;สั่งงานหุ่นยนต์&quot; ด้านบนเพื่อทดสอบได้
                    </td>
                  </tr>
                ) : (
                  missions.map((m) => (
                    <tr key={m.id} className="hover:bg-[#1b2027] transition-colors">
                      <td className="py-4 pl-5">
                        <span className="font-mono font-bold text-cyan-300">{m.missionCode}</span>
                      </td>
                      <td className="py-4">
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-[#252a32] text-[#dee2ec] border border-[#3c424d] font-semibold">
                          {m.taskType === 'BIN_TO_PERSON' && 'Bin-to-Person (นำส่งสถานี)'}
                          {m.taskType === 'PALLET_TRANSFER' && 'ย้ายพาเลท (Pallet Transfer)'}
                          {m.taskType === 'CONVEYOR_DIVERT' && 'คัดแยกลงรางสายพาน'}
                          {m.taskType === 'PUTAWAY_RUN' && 'นำของไปจัดเก็บบนแร็ค'}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="font-medium text-[#dee2ec]">{m.productName || '-'}</div>
                        {m.sku && <div className="text-xs font-mono text-[#8a92a6]">{m.sku} (x{m.qty || 1})</div>}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono px-2 py-0.5 rounded bg-[#252a32] text-[#8a92a6]">{m.sourceBin}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-semibold">{m.targetBin}</span>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-xs font-bold text-[#dee2ec]">
                        {m.assignedRobotCode || <span className="text-[#8a92a6]">กำลังรอจัดคิว</span>}
                      </td>
                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          m.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          m.status === 'IN_TRANSIT' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 animate-pulse' :
                          m.status === 'DISPATCHED' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' :
                          'bg-[#252a32] text-[#8a92a6] border-[#3c424d]'
                        }`}>
                          {m.status === 'IN_TRANSIT' && 'กำลังเคลื่อนย้าย'}
                          {m.status === 'DISPATCHED' && 'จ่ายงานแล้ว'}
                          {m.status === 'COMPLETED' && 'เสร็จสมบูรณ์'}
                          {m.status === 'QUEUED' && 'รอจัดสรร'}
                        </span>
                      </td>
                      <td className="py-4 pr-5 text-right text-xs text-[#8a92a6]">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dispatch Mission Modal */}
        {showDispatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#171c23] border border-[#30353d] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
                <h3 className="text-lg font-bold text-[#dee2ec] flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  สั่งภารกิจหุ่นยนต์อัตโนมัติ (Dispatch WCS Mission)
                </h3>
                <button onClick={() => setShowDispatchModal(false)} className="text-[#8a92a6] hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDispatchSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#8a92a6] font-semibold mb-1">ประเภทงาน (Task Type)</label>
                  <select
                    value={formTaskType}
                    onChange={(e: any) => setFormTaskType(e.target.value)}
                    className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl px-3.5 py-2.5 text-[#dee2ec] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="BIN_TO_PERSON">Bin-to-Person (นำส่งกล่องสินค้ามาโต๊ะหยิบ)</option>
                    <option value="PALLET_TRANSFER">Pallet Transfer (ขนย้ายพาเลทไปจุดเทียบ)</option>
                    <option value="CONVEYOR_DIVERT">Conveyor Divert (สายพานคัดแยกลงช่องบรรจุ)</option>
                    <option value="PUTAWAY_RUN">Putaway Run (นำสินค้าขึ้นแร็คเก็บ)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#8a92a6] font-semibold mb-1">ตำแหน่งต้นทาง (Source Bin)</label>
                    <input
                      type="text"
                      value={formSourceBin}
                      onChange={(e) => setFormSourceBin(e.target.value)}
                      placeholder="เช่น A-01-02"
                      required
                      className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl px-3.5 py-2.5 text-[#dee2ec] font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-semibold mb-1">ตำแหน่งปลายทาง (Target Bin)</label>
                    <input
                      type="text"
                      value={formTargetBin}
                      onChange={(e) => setFormTargetBin(e.target.value)}
                      placeholder="เช่น STATION-PICK-01"
                      required
                      className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl px-3.5 py-2.5 text-[#dee2ec] font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[#8a92a6] font-semibold mb-1">ชื่อสินค้า / SKU</label>
                    <input
                      type="text"
                      value={formProductName}
                      onChange={(e) => setFormProductName(e.target.value)}
                      className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl px-3.5 py-2.5 text-[#dee2ec] focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-semibold mb-1">จำนวน</label>
                    <input
                      type="number"
                      value={formQty}
                      onChange={(e) => setFormQty(Number(e.target.value))}
                      min={1}
                      className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl px-3.5 py-2.5 text-[#dee2ec] focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#8a92a6] font-semibold mb-1">มอบหมายหุ่นยนต์ (เว้นว่างเพื่อให้ระบบจัดสรรอัตโนมัติ)</label>
                  <select
                    value={formRobotCode}
                    onChange={(e) => setFormRobotCode(e.target.value)}
                    className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl px-3.5 py-2.5 text-[#dee2ec] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- อัตโนมัติ (เลือกเครื่องที่ว่างและเหมาะสมที่สุด) --</option>
                    {fleet.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code} - {r.name} ({r.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#30353d]">
                  <button
                    type="button"
                    onClick={() => setShowDispatchModal(false)}
                    className="px-4 py-2 rounded-xl text-[#8a92a6] hover:bg-[#252a32] transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    ยืนยันส่งคำสั่งงาน WCS
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Register Device Modal */}
        {showDeviceModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowDeviceModal(false)}>
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-2xl p-6 text-xs text-[#dee2ec] space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#57ec7f] via-[#4cd7f6] to-[#facc15]" />
              <h3 className="text-base font-black">ลงทะเบียนหุ่นยนต์ (Register Robot)</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#8a92a6] font-bold mb-1">รหัส (Code) *</label>
                  <input value={newDevice.code} onChange={(e) => setNewDevice(d => ({ ...d, code: e.target.value }))} placeholder="เช่น AGV-05"
                    className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] font-mono focus:border-[#57ec7f] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[#8a92a6] font-bold mb-1">พิกัดเริ่มต้น</label>
                  <input value={newDevice.currentLocation} onChange={(e) => setNewDevice(d => ({ ...d, currentLocation: e.target.value }))} placeholder="DOCK-01"
                    className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] font-mono focus:border-[#57ec7f] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[#8a92a6] font-bold mb-1">ชื่อ (Name) *</label>
                <input value={newDevice.name} onChange={(e) => setNewDevice(d => ({ ...d, name: e.target.value }))} placeholder="เช่น Hikrobot Pallet Lifter #5"
                  className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#57ec7f] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[#8a92a6] font-bold mb-1">ประเภท</label>
                <select value={newDevice.type} onChange={(e) => setNewDevice(d => ({ ...d, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]">
                  <option value="AGV_PALLET_LIFT">AGV ยกพาเลท (Pallet Lift)</option>
                  <option value="AMR_TOTE_RUNNER">AMR ส่งลัง (Tote Runner)</option>
                  <option value="ASRS_SHUTTLE">ASRS Shuttle (แร็คแคบ)</option>
                  <option value="CONVEYOR_SORTER">สายพานคัดแยก (Conveyor Sorter)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#30353d]">
                <button onClick={() => setShowDeviceModal(false)} className="px-4 py-2 bg-[#252a32] text-[#8a92a6] hover:text-white rounded-xl">ยกเลิก</button>
                <button onClick={addDevice} disabled={savingDevice} className="px-5 py-2 bg-[#57ec7f] hover:bg-[#4bd66f] text-[#0a2012] rounded-xl font-black shadow flex items-center gap-1.5 disabled:opacity-50">
                  {savingDevice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} ลงทะเบียน
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
