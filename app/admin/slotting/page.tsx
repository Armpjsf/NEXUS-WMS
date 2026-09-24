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
import { AmbientBackground } from '@/components/ui/AmbientBackground';
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
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        
        {/* Navigation Breadcrumb */}
        <Link href="/admin" className="text-[#8a92a6] hover:text-indigo-400 flex items-center gap-2 mb-4 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> {t('back_to_admin')}
        </Link>

        {/* Header */}
        <header className="overflow-hidden rounded-[1.75rem] border border-indigo-500/30 bg-[#171c23] p-6 shadow-xl shadow-indigo-900/10 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-indigo-600 via-emerald-500 to-amber-500 -mx-6 -mt-6 mb-6" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#dee2ec] flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <LayoutGrid className="w-7 h-7 text-indigo-400" />
                </div>
                AI Smart Slotting (ABC Layout Advisory)
              </h1>
              <p className="text-[#8a92a6] mt-2 text-sm">
                วิเคราะห์การจัดวางตำแหน่งจัดเก็บสินค้าอัจฉริยะตามความถี่การเบิกจริง (Pick Frequency & ABC Velocity)
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-center">
              <button
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] font-semibold text-sm rounded-xl border border-[#3c424d] transition-all"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                คำนวณใหม่
              </button>
              <Link
                href="/inventory/map"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Warehouse className="w-4 h-4" />
                ดูแผนผังคลัง 2D (Visual Map)
              </Link>
            </div>
          </div>
        </header>

        {/* Human-in-the-Loop Operational Guardrail Banner */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#171c23] to-indigo-500/10 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 mt-0.5 shrink-0 border border-amber-500/30">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1 text-sm space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300 text-base">
                <span>ระบบแนะนำผังจัดเก็บอัจฉริยะ (Advisory Mode) — ไม่มีการย้ายสต็อกโดยอัตโนมัติ</span>
              </div>
              <p className="text-[#c2c8d6] leading-relaxed">
                การย้ายสต็อกในคลังสินค้ามีผลกระทบต่อตำแหน่งจริงหน้างาน AI ทำหน้าที่เพียง
                <strong className="text-white font-semibold"> เสนอแนะจุดที่ควรปรับปรุงเพื่อลดระยะเดินหยิบ</strong> 
                โดยหัวหน้าคลังสินค้าเป็นผู้ตัดสินใจอนุมัติ สามารถเลือก <strong className="text-amber-300">สร้างใบงานย้ายส่งเข้าเครื่อง PDA พนักงาน</strong> หรือ <strong className="text-emerald-300">อนุมัติเปลี่ยนพิกัดทันที</strong> หรือข้ามคำแนะนำได้ตามความพร้อมของหน้างาน
              </p>
            </div>
          </div>
        </div>

        {/* KPI ROI Impact Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-[#171c23] rounded-2xl border border-[#30353d] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">ระยะเดินหยิบที่ประหยัดได้</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Footprints className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400">
                {data?.estimatedWeeklyDistanceSavedKm ? `~${data.estimatedWeeklyDistanceSavedKm.toFixed(1)}` : '0'}
              </span>
              <span className="text-sm font-semibold text-[#8a92a6]">กม. / สัปดาห์</span>
            </div>
            <p className="mt-2 text-xs text-[#8a92a6]">
              หากจัดเรียง SKU ยอดนิยมมาไว้หน้าประตูหยิบสินค้า (Zone A)
            </p>
          </div>

          <div className="bg-[#171c23] rounded-2xl border border-[#30353d] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">Fast-Movers อยู่นอกโซนทอง</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Zap className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-400">
                {data?.fastMoversMisplaced || 0}
              </span>
              <span className="text-sm font-semibold text-[#8a92a6]">SKU ที่เบิกบ่อยแต่อยู่ลึก</span>
            </div>
            <p className="mt-2 text-xs text-[#8a92a6]">
              สินค้าขายดีแต่อยู่แถวหลัง ทำให้พนักงานต้องเดินไกลซ้ำซ้อน
            </p>
          </div>

          <div className="bg-[#171c23] rounded-2xl border border-[#30353d] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">Deadstock ขวางโซนหน้า</span>
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <Box className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-400">
                {data?.deadstockDeepZoneNeeded || 0}
              </span>
              <span className="text-sm font-semibold text-[#8a92a6]">SKU ไม่ขยับแต่จองที่ทอง</span>
            </div>
            <p className="mt-2 text-xs text-[#8a92a6]">
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
            color="blue"
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
        <div className="bg-[#171c23] rounded-2xl border border-[#30353d] shadow-xl overflow-hidden">
          <div className="p-5 border-b border-[#30353d] bg-[#1b2027] flex items-center justify-between">
            <h3 className="font-bold text-[#dee2ec] flex items-center gap-2 text-base">
              <MoveRight className="w-5 h-5 text-indigo-400" />
              รายการคำแนะนำปรับผังจัดเก็บ (Slotting Actions)
              {data?.recommendations && (
                <span className="ml-2 px-2.5 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  {data.recommendations.length} รายการ
                </span>
              )}
            </h3>
            <span className="text-xs text-[#8a92a6]">
              กดสร้าง Task เพื่อมอบหมายงานให้พนักงาน PDA สแกนย้าย
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[#8a92a6] flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span>กำลังวิเคราะห์ข้อมูลประวัติการเบิกและพิกัดคลังสินค้า...</span>
            </div>
          ) : !data?.recommendations || data.recommendations.length === 0 ? (
            <div className="py-16 text-center text-[#8a92a6]">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-[#dee2ec]">ผังจัดเก็บปัจจุบันเหมาะสมดีแล้ว</p>
              <p className="text-xs text-[#8a92a6] mt-1">สินค้าหมุนเวียนเร็วอยู่ในจุดที่หยิบง่าย และไม่มี Deadstock ขวางพื้นที่</p>
            </div>
          ) : (
            <div className="divide-y divide-[#30353d]">
              {data.recommendations.map((item) => {
                const key = item.productId || item.sku;
                const isWorking = actionLoading[key];
                const actionResult = actionResults[key];

                return (
                  <div key={key} className="p-5 hover:bg-[#1b2027]/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Item Information */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-xl mt-1 shrink-0 ${item.action === 'MOVE_FORWARD' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {item.action === 'MOVE_FORWARD' ? (
                          <ArrowUpCircle className="w-6 h-6" />
                        ) : (
                          <ArrowDownCircle className="w-6 h-6" />
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-[#dee2ec] text-base">{item.productName}</h4>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#252a32] text-[#8a92a6] border border-[#3c424d]">
                            SKU: {item.sku}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            item.class === 'A' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 
                            item.class === 'D' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            Class {item.class}
                          </span>
                          <span className="text-xs text-[#8a92a6]">
                            คงเหลือ: <strong className="text-white">{item.stock}</strong> ชิ้น
                          </span>
                        </div>

                        {/* Location transition */}
                        <div className="flex items-center gap-2 text-sm pt-1">
                          <span className="text-[#8a92a6]">พิกัดปัจจุบัน:</span>
                          <span className="font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-semibold">
                            {item.currentLocation || 'UNASSIGNED'}
                          </span>
                          <MoveRight className="w-4 h-4 text-[#8a92a6]" />
                          <span className="text-[#8a92a6]">พิกัดแนะนำ:</span>
                          <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                            {item.recommendedBin || item.idealZone}
                          </span>
                          {item.estimatedDistanceSavedMeters > 0 && (
                            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full ml-1">
                              ลดเดิน ~{item.estimatedDistanceSavedMeters} ม./ครั้ง
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#8a92a6]">{item.reason}</p>
                      </div>
                    </div>

                    {/* Operational Action Controls */}
                    <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                      {actionResult ? (
                        <div className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                          actionResult.type === 'TASK' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' :
                          actionResult.type === 'DIRECT' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                          'bg-[#252a32] text-[#8a92a6] border-[#3c424d]'
                        }`}>
                          {actionResult.type === 'TASK' && <Send className="w-4 h-4 text-indigo-400" />}
                          {actionResult.type === 'DIRECT' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          {actionResult.type === 'DISMISSED' && <XCircle className="w-4 h-4 text-[#8a92a6]" />}
                          <span>{actionResult.message}</span>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAction(item, 'DISPATCH_TASK')}
                            disabled={isWorking}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
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
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition-all disabled:opacity-50"
                            title="อนุมัติเปลี่ยนพิกัดทันที (กรณีพนักงานหน้างานจัดเรียงย้ายจริงเสร็จแล้ว)"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            อนุมัติเปลี่ยนพิกัดทันที
                          </button>

                          <button
                            onClick={() => handleAction(item, 'DISMISS')}
                            disabled={isWorking}
                            className="p-2 rounded-xl hover:bg-[#252a32] text-[#8a92a6] hover:text-white transition-colors"
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
        <div className="bg-[#171c23] rounded-2xl border border-[#30353d] p-6 shadow-xl">
          <h3 className="font-bold text-[#dee2ec] mb-4 text-base">การจัดกลุ่ม Velocity & ABC Analysis ของสินค้าทั้งหมด</h3>
          {loading ? (
            <div className="text-center py-10 text-[#8a92a6]">กำลังโหลดข้อมูล...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs uppercase text-[#8a92a6] font-bold border-b border-[#30353d]">
                  <tr>
                    <th className="pb-3 pl-4">สินค้า (SKU)</th>
                    <th className="pb-3">Class</th>
                    <th className="pb-3">ความถี่หยิบ (รอบ)</th>
                    <th className="pb-3">ยอดขายรวม (ชิ้น)</th>
                    <th className="pb-3">พิกัดปัจจุบัน</th>
                    <th className="pb-3">โซนที่ควรอยู่</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-[#30353d]">
                  {data?.all.slice(0, 25).map((row, i) => (
                    <tr key={i} className="hover:bg-[#1b2027] transition-colors">
                      <td className="py-3 pl-4 font-medium text-[#dee2ec]">
                        <div>{row.productName}</div>
                        <div className="text-xs text-[#8a92a6] font-mono">{row.sku}</div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          row.class === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                          row.class === 'B' ? 'bg-blue-500/20 text-blue-400' :
                          row.class === 'C' ? 'bg-amber-500/20 text-amber-400' : 'bg-[#252a32] text-[#8a92a6]'
                        }`}>
                          Class {row.class}
                        </span>
                      </td>
                      <td className="py-3 text-[#dee2ec]">{row.pickCount || 0}</td>
                      <td className="py-3 text-[#dee2ec]">{row.velocityScore.toLocaleString()}</td>
                      <td className="py-3 font-mono text-[#8a92a6]">{row.currentLocation || 'UNASSIGNED'}</td>
                      <td className="py-3 font-mono text-indigo-400 font-semibold">{row.idealZone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-center text-[#8a92a6] mt-4">แสดง 25 รายการแรกที่มียอดความเคลื่อนไหวสูงสุด</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function DistributionCard({ label, count = 0, desc, color, icon: Icon }: any) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    slate: 'bg-[#252a32] text-[#8a92a6] border border-[#3c424d]'
  } as any;

  return (
    <div className="bg-[#171c23] p-5 rounded-2xl border border-[#30353d] shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-3xl font-black text-[#dee2ec]">{count}</span>
      </div>
      <div>
        <h4 className="font-bold text-[#dee2ec] text-sm">{label}</h4>
        <p className="text-xs text-[#8a92a6] mt-1">{desc}</p>
      </div>
    </div>
  );
}

