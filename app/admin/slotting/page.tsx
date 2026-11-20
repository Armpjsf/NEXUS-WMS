'use client';

import { useState, useEffect } from 'react';
import {
  LayoutGrid,
  MoveRight,
  ArrowUpCircle,
  ArrowDownCircle,
  Box,
  Zap,
  Warehouse,
  ArrowLeft,
  ShieldAlert,
  Send,
  CheckCircle2,
  XCircle,
  Footprints,
  Info,
  Loader2,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { errorMessage } from '@/lib/errors';

interface SlottingInsight {
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  currentLocation: string;
  velocityScore: number;
  pickCount: number;
  class: 'A' | 'B' | 'C' | 'D';
  idealZone: string;
  recommendedBin: string;
  action: 'MOVE_FORWARD' | 'MOVE_BACK' | 'KEEP';
  reason: string;
  estimatedDistanceSavedMeters: number;
}

interface SlottingSummary {
  classDistribution: Record<'A' | 'B' | 'C' | 'D', number>;
  recommendations: SlottingInsight[];
  all: SlottingInsight[];
  totalRecommendations: number;
  estimatedWeeklyDistanceSavedKm: number;
  fastMoversMisplaced: number;
  deadstockDeepZoneNeeded: number;
}

export default function SlottingPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<SlottingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionResults, setActionResults] = useState<Record<string, { type: 'TASK' | 'DIRECT' | 'DISMISSED'; message: string }>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/slotting');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load slotting insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fastMoversMisplaced =
    data?.fastMoversMisplaced ??
    (data?.recommendations || []).filter(
      (r: any) =>
        (r.abcClass === 'A' || r.class === 'A') &&
        (r.recommendedAction === 'MOVE_TO_GOLDEN_ZONE' || r.action === 'MOVE_FORWARD')
    ).length;

  const deadstockDeepZoneNeeded =
    data?.deadstockDeepZoneNeeded ??
    (data?.recommendations || []).filter(
      (r: any) =>
        (r.abcClass === 'C' || r.abcClass === 'D' || r.class === 'C' || r.class === 'D') &&
        (r.recommendedAction === 'MOVE_TO_DEEP_STORAGE' || r.action === 'MOVE_BACK')
    ).length;

  const handleAction = async (item: SlottingInsight, actionType: 'DISPATCH_TASK' | 'DIRECT_APPLY' | 'DISMISS') => {
    const key = item.productId || item.sku;

    if (actionType === 'DISMISS') {
      setActionResults(prev => ({
        ...prev,
        [key]: { type: 'DISMISSED', message: 'ข้ามคำแนะนำแล้ว (ไม่ย้าย)' }
      }));
      return;
    }

    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/ai/slotting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          sku: item.sku,
          productName: item.productName,
          sourceLocation: item.currentLocation,
          targetLocation: item.recommendedBin || item.idealZone,
          qty: item.stock,
          notes: `AI Slotting: ${item.reason}`
        })
      });
      const result = await res.json();
      if (result.success) {
        setActionResults(prev => ({
          ...prev,
          [key]: {
            type: actionType === 'DISPATCH_TASK' ? 'TASK' : 'DIRECT',
            message: actionType === 'DISPATCH_TASK'
              ? `สร้างใบงานย้าย (Task #${result.taskId?.slice(0, 8) || 'PDA'}) ส่งเข้าเครื่องพนักงานแล้ว`
              : 'อนุมัติเปลี่ยนพิกัดในระบบเรียบร้อยแล้ว'
          }
        }));
      } else {
        alert(result.error || 'เกิดข้อผิดพลาดในการดำเนินการ');
      }
    } catch (err) {
      alert(errorMessage(err) || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Navigation Breadcrumb */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> {t('back_to_admin')}
        </Link>

        {/* Open Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <LayoutGrid className="w-3 h-3 text-emerald-600" />
                ABC Layout Advisory
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              AI Smart Slotting (ABC Layout Advisory)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              วิเคราะห์การจัดวางตำแหน่งจัดเก็บสินค้าอัจฉริยะตามความถี่การเบิกจริง (Pick Frequency &amp; ABC Velocity)
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 font-semibold text-xs rounded-full border border-white/90 shadow-xs transition-all"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
              คำนวณใหม่
            </button>
            <Link
              href="/inventory/map"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-full shadow-sm transition-all"
            >
              <Warehouse className="w-3.5 h-3.5" />
              ดูแผนผังคลัง 2D (Visual Map)
            </Link>
          </div>
        </header>

        {/* Human-in-the-Loop Operational Guardrail Banner */}
        <div className="nx-glass-card p-5 border-l-4 border-l-amber-500">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-amber-500/15 rounded-xl text-amber-700 mt-0.5 shrink-0 border border-amber-500/25">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1 text-sm space-y-1">
              <div className="font-bold text-slate-900 text-base">
                ระบบแนะนำผังจัดเก็บอัจฉริยะ (Advisory Mode) — ไม่มีการย้ายสต็อกโดยอัตโนมัติ
              </div>
              <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                การย้ายสต็อกในคลังสินค้ามีผลกระทบต่อตำแหน่งจริงหน้างาน AI ทำหน้าที่เพียง
                <strong className="text-slate-900 font-semibold"> เสนอแนะจุดที่ควรปรับปรุงเพื่อลดระยะเดินหยิบ</strong>
                โดยหัวหน้าคลังสินค้าเป็นผู้ตัดสินใจอนุมัติ สามารถเลือก <strong className="text-amber-700">สร้างใบงานย้ายส่งเข้าเครื่อง PDA พนักงาน</strong> หรือ <strong className="text-emerald-700">อนุมัติเปลี่ยนพิกัดทันที</strong> หรือข้ามคำแนะนำได้ตามความพร้อมของหน้างาน
              </p>
            </div>
          </div>
        </div>

        {/* KPI ROI Impact Metrics (with 1 Hero Dark Accent Card) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="nx-dark-accent-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">ระยะเดินหยิบที่ประหยัดได้</span>
              <div className="p-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <Footprints className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-300 tabular-nums">
                {data?.estimatedWeeklyDistanceSavedKm ? `~${data.estimatedWeeklyDistanceSavedKm.toFixed(1)}` : '0'}
              </span>
              <span className="text-sm font-medium text-slate-400">กม. / สัปดาห์</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              หากจัดเรียง SKU ยอดนิยมมาไว้หน้าประตูหยิบสินค้า (Zone A)
            </p>
          </div>

          <div className="nx-glass-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fast-Movers อยู่นอกโซนทอง</span>
              <div className="p-2 bg-amber-500/15 text-amber-700 border border-amber-500/25 rounded-xl">
                <Zap className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-amber-600 tabular-nums">
                {fastMoversMisplaced.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-slate-500">SKU ที่เบิกบ่อยแต่อยู่ลึก</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              สินค้าขายดีแต่อยู่แถวหลัง ทำให้พนักงานต้องเดินไกลซ้ำซ้อน
            </p>
          </div>

          <div className="nx-glass-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deadstock ขวางโซนหน้า</span>
              <div className="p-2 bg-rose-500/12 text-rose-600 border border-rose-500/20 rounded-xl">
                <Box className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-rose-600 tabular-nums">
                {deadstockDeepZoneNeeded.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-slate-500">SKU ไม่ขยับแต่จองที่ทอง</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              ควรย้ายไปเก็บโซนลึก (Deep Storage) เพื่อเปิดพื้นที่ให้สินค้าหมุนไว
            </p>
          </div>
        </div>

        {/* ABC Distribution Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <DistributionCard
            label="Class A (Fast Movers)"
            count={data?.classDistribution?.A || 0}
            desc="ยอดเบิกสูงสุด 20% แรก — ควรวางใกล้ประตูจ่าย"
            color="emerald"
            icon={Zap}
          />
          <DistributionCard
            label="Class B (Medium Movers)"
            count={data?.classDistribution?.B || 0}
            desc="ยอดเบิกปานกลาง 30% — เก็บชั้นกลาง"
            color="sky"
            icon={Box}
          />
          <DistributionCard
            label="Class C (Slow Movers)"
            count={data?.classDistribution?.C || 0}
            desc="ยอดเบิกช้า 50% — เก็บโซนลึกหลังคลัง"
            color="amber"
            icon={Warehouse}
          />
          <DistributionCard
            label="Class D (Deadstock)"
            count={data?.classDistribution?.D || 0}
            desc="ไม่มีการเคลื่อนไหว — พิจารณาเคลียร์สต็อก"
            color="slate"
            icon={ShieldAlert}
          />
        </div>

        {/* Actionable Recommendations List */}
        <div className="nx-glass-card overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 bg-white/60 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
              <MoveRight className="w-5 h-5 text-emerald-600" />
              รายการคำแนะนำปรับผังจัดเก็บ (Slotting Actions)
              {data?.recommendations && (
                <span className="ml-1 px-2.5 py-0.5 text-xs rounded-full bg-slate-900 text-white font-semibold tabular-nums">
                  {data.recommendations.length} รายการ
                </span>
              )}
            </h3>
            <span className="text-xs text-slate-500">
              กดสร้าง Task เพื่อมอบหมายงานให้พนักงาน PDA สแกนย้าย
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-3 text-sm">
              <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
              <span>กำลังวิเคราะห์ข้อมูลประวัติการเบิกและพิกัดคลังสินค้า...</span>
            </div>
          ) : !data?.recommendations || data.recommendations.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-900">ผังจัดเก็บปัจจุบันเหมาะสมดีแล้ว</p>
              <p className="text-xs text-slate-500 mt-1">สินค้าหมุนเวียนเร็วอยู่ในจุดที่หยิบง่าย และไม่มี Deadstock ขวางพื้นที่</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/70">
              {data.recommendations.map((item) => {
                const key = item.productId || item.sku;
                const isWorking = actionLoading[key];
                const actionResult = actionResults[key];

                return (
                  <div key={key} className="p-5 hover:bg-white/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Item Information */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-2xl mt-0.5 shrink-0 border ${item.action === 'MOVE_FORWARD' ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' : 'bg-amber-500/15 text-amber-700 border-amber-500/25'}`}>
                        {item.action === 'MOVE_FORWARD' ? (
                          <ArrowUpCircle className="w-5 h-5" />
                        ) : (
                          <ArrowDownCircle className="w-5 h-5" />
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">{item.productName}</h4>
                          <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            SKU: {item.sku}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            item.class === 'A' ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' :
                            item.class === 'D' ? 'bg-rose-500/12 text-rose-700 border-rose-500/20' : 'bg-sky-500/12 text-sky-700 border-sky-500/20'
                          }`}>
                            Class {item.class}
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums">
                            คงเหลือ: <strong className="text-slate-900">{item.stock.toLocaleString()}</strong> ชิ้น
                          </span>
                        </div>

                        {/* Location transition */}
                        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                          <span className="text-slate-500">พิกัดปัจจุบัน:</span>
                          <span className="font-mono px-2.5 py-0.5 rounded-full bg-rose-500/12 text-rose-700 border border-rose-500/20 font-semibold">
                            {item.currentLocation || 'UNASSIGNED'}
                          </span>
                          <MoveRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-500">พิกัดแนะนำ:</span>
                          <span className="font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 border border-emerald-500/20 font-bold">
                            {item.recommendedBin || item.idealZone}
                          </span>
                          {item.estimatedDistanceSavedMeters > 0 && (
                            <span className="text-xs text-emerald-700 bg-emerald-500/12 border border-emerald-500/20 px-2.5 py-0.5 rounded-full ml-1 tabular-nums font-medium">
                              ลดเดิน ~{item.estimatedDistanceSavedMeters} ม./ครั้ง
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600">{item.reason}</p>
                      </div>
                    </div>

                    {/* Operational Action Controls */}
                    <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                      {actionResult ? (
                        <div className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 border ${
                          actionResult.type === 'TASK' ? 'bg-sky-500/12 text-sky-700 border-sky-500/20' :
                          actionResult.type === 'DIRECT' ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {actionResult.type === 'TASK' && <Send className="w-3.5 h-3.5 text-sky-600" />}
                          {actionResult.type === 'DIRECT' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                          {actionResult.type === 'DISMISSED' && <XCircle className="w-3.5 h-3.5 text-slate-500" />}
                          <span>{actionResult.message}</span>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAction(item, 'DISPATCH_TASK')}
                            disabled={isWorking}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm disabled:opacity-50"
                            title="สร้างใบงานย้ายพิกัดแล้วส่งเข้าเมนู Tasks บนเครื่อง PDA ของพนักงาน"
                          >
                            {isWorking ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            สร้าง Task ส่งเข้า PDA
                          </button>

                          <button
                            onClick={() => handleAction(item, 'DIRECT_APPLY')}
                            disabled={isWorking}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/25 font-semibold text-xs transition-all disabled:opacity-50"
                            title="อนุมัติเปลี่ยนพิกัดทันที (กรณีพนักงานหน้างานจัดเรียงย้ายจริงเสร็จแล้ว)"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            อนุมัติเปลี่ยนพิกัดทันที
                          </button>

                          <button
                            onClick={() => handleAction(item, 'DISMISS')}
                            disabled={isWorking}
                            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                            title="ข้ามคำแนะนำนี้"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Velocity ABC Table */}
        <div className="nx-glass-card overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 bg-white/60">
            <h3 className="font-bold text-slate-900 text-base">การจัดกลุ่ม Velocity &amp; ABC Analysis ของสินค้าทั้งหมด</h3>
          </div>
          {loading ? (
            <div className="text-center py-10 text-slate-500 text-sm">กำลังโหลดข้อมูล...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[11px] uppercase text-slate-500 font-bold border-b border-slate-200/80 bg-slate-50/80 tracking-wider">
                  <tr>
                    <th className="py-3.5 pl-5 pr-4">สินค้า (SKU)</th>
                    <th className="py-3.5 px-4">Class</th>
                    <th className="py-3.5 px-4">ความถี่หยิบ (รอบ)</th>
                    <th className="py-3.5 px-4">ยอดขายรวม (ชิ้น)</th>
                    <th className="py-3.5 px-4">พิกัดปัจจุบัน</th>
                    <th className="py-3.5 px-4">โซนที่ควรอยู่</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-200/70">
                  {data?.all.slice(0, 25).map((row, i) => (
                    <tr key={i} className="hover:bg-white/80 transition-colors">
                      <td className="py-3 pl-5 pr-4 font-medium text-slate-900">
                        <div className="font-semibold">{row.productName}</div>
                        <div className="text-xs text-slate-500 font-mono">{row.sku}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          row.class === 'A' ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' :
                          row.class === 'B' ? 'bg-sky-500/12 text-sky-700 border-sky-500/20' :
                          row.class === 'C' ? 'bg-amber-500/15 text-amber-800 border-amber-500/25' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          Class {row.class}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-900 tabular-nums font-semibold">{(row.pickCount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-slate-900 tabular-nums font-semibold">{row.velocityScore.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{row.currentLocation || 'UNASSIGNED'}</td>
                      <td className="py-3 px-4 font-mono text-sky-700 font-semibold">{row.idealZone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-center text-slate-500 py-4 border-t border-slate-200/70">แสดง 25 รายการแรกที่มียอดความเคลื่อนไหวสูงสุด</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function DistributionCard({ label, count = 0, desc, color, icon: Icon }: any) {
  const colors = {
    emerald: 'bg-emerald-500/12 text-emerald-700 border border-emerald-500/20',
    sky: 'bg-sky-500/12 text-sky-700 border border-sky-500/20',
    amber: 'bg-amber-500/15 text-amber-700 border border-amber-500/25',
    slate: 'bg-slate-100 text-slate-600 border border-slate-200'
  } as any;

  return (
    <div className="nx-glass-card p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-3xl font-bold text-slate-900 tabular-nums">{count.toLocaleString()}</span>
      </div>
      <div>
        <h4 className="font-bold text-slate-900 text-sm">{label}</h4>
        <p className="text-xs text-slate-500 mt-1">{desc}</p>
      </div>
    </div>
  );
}
