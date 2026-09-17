'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Users,
  Award,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  Flame,
  BarChart2,
  TrendingUp,
  RefreshCw,
  Boxes,
  ShieldCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

interface OperatorStat {
  userId: string;
  name: string;
  avatar?: string;
  totalPicks: number;
  activeHours: number;
  pph: number;
  rating: 'EXCELLENT' | 'GOOD' | 'ON_TRACK' | 'NEEDS_ATTENTION';
  accuracyRate: number;
}

interface CongestionZone {
  zone: string;
  operatorCount: number;
  status: 'OPTIMAL' | 'MODERATE' | 'CONGESTED';
  message: string;
}

export default function ProductivityDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    summary: {
      averagePph: number;
      targetPph: number;
      totalUnitsHandled: number;
      activeStaffCount: number;
      averageAccuracy: number;
    };
    leaderboard: OperatorStat[];
    congestions: CongestionZone[];
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/productivity');
      const json = await res.json();
      if (json.data) {
        setData(json.data);
      } else if (json.summary) {
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching productivity metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case 'EXCELLENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-[#57ec7f]/20 text-[#57ec7f] border border-[#57ec7f]/30">
            <Flame className="w-3.5 h-3.5 text-[#57ec7f]" /> ยอดเยี่ยม (TOP TIER)
          </span>
        );
      case 'GOOD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/30">
            <Award className="w-3.5 h-3.5 text-[#4cd7f6]" /> มาตรฐานดี (GOOD)
          </span>
        );
      case 'ON_TRACK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#facc15]/20 text-[#facc15] border border-[#facc15]/30">
            <Clock className="w-3.5 h-3.5 text-[#facc15]" /> ตามเกณฑ์ (ON TRACK)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ff5449]/20 text-[#ffb4ab] border border-[#ff5449]/30">
            <AlertTriangle className="w-3.5 h-3.5 text-[#ff5449]" /> ต้องปรับปรุง
          </span>
        );
    }
  };

  const getCongestionBadge = (status: string) => {
    switch (status) {
      case 'CONGESTED':
        return <span className="px-2 py-0.5 rounded bg-[#ff5449]/20 text-[#ffb4ab] text-xs font-bold border border-[#ff5449]/30">หนาแน่นสูง (BOTTLENECK)</span>;
      case 'MODERATE':
        return <span className="px-2 py-0.5 rounded bg-[#facc15]/20 text-[#facc15] text-xs font-bold border border-[#facc15]/30">ปานกลาง</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-[#57ec7f]/20 text-[#57ec7f] text-xs font-bold border border-[#57ec7f]/30">คล่องตัวดี</span>;
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
              LABOR MANAGEMENT SYSTEM & REAL-TIME OPERATOR ANALYTICS
            </p>
            <h1 className="font-headline text-2xl md:text-3xl font-black text-[#dee2ec] tracking-tight mb-1 flex items-center gap-3">
              <div className="bg-[#4cd7f6] text-[#042027] p-2 rounded-lg shadow-md">
                <Zap className="w-6 h-6" />
              </div>
              Labor Management System & Operator KPIs
            </h1>
            <p className="text-[#8a92a6] font-mono text-xs">
              วิเคราะห์ประสิทธิภาพการหยิบ/แพ็ค (Picks Per Hour - PPH), Leaderboard พนักงาน และตรวจจับความแออัดของโซนแบบ Real-Time
            </p>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] rounded-xl border border-[#30353d] transition flex items-center gap-2 text-xs font-bold relative z-10"
          >
            <RefreshCw className="w-4 h-4" />
            รีเฟรชข้อมูล
          </button>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#171c23]/90 p-5 rounded-xl border border-[#30353d] shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">ความเร็วหยิบเฉลี่ย (PPH)</span>
              <div className="p-2 bg-[#4cd7f6]/10 text-[#4cd7f6] rounded-xl border border-[#4cd7f6]/20">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-[#dee2ec] font-mono">{data?.summary?.averagePph ?? 0}</span>
              <span className="text-xs text-[#8a92a6]">ชิ้น / ชม.</span>
            </div>
            <div className="mt-2 text-xs font-bold flex items-center gap-1">
              {(data?.summary?.averagePph || 0) >= (data?.summary?.targetPph || 75) && (data?.summary?.averagePph || 0) > 0 ? (
                <span className="text-[#57ec7f] flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> บรรลุเป้าหมาย ({data?.summary?.targetPph ?? 75} PPH)</span>
              ) : (data?.summary?.averagePph || 0) > 0 ? (
                <span className="text-[#facc15] flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ต่ำกว่าเป้าหมาย ({data?.summary?.targetPph ?? 75} PPH)</span>
              ) : (
                <span className="text-[#8a92a6] flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> รอเริ่มกะปฏิบัติงาน</span>
              )}
            </div>
          </div>

          <div className="bg-[#171c23]/90 p-5 rounded-xl border border-[#30353d] shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">ยอดรวมสินค้าที่จัดการ</span>
              <div className="p-2 bg-[#facc15]/10 text-[#facc15] rounded-xl border border-[#facc15]/20">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-[#dee2ec] font-mono">{(data?.summary?.totalUnitsHandled ?? 0).toLocaleString()}</span>
              <span className="text-xs text-[#8a92a6]">ชิ้น</span>
            </div>
            <div className="mt-2 text-xs text-[#8a92a6]">
              นับรวม Pick, Pack & Putaway
            </div>
          </div>

          <div className="bg-[#171c23]/90 p-5 rounded-xl border border-[#30353d] shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">พนักงานที่ปฏิบัติงาน</span>
              <div className="p-2 bg-[#57ec7f]/10 text-[#57ec7f] rounded-xl border border-[#57ec7f]/20">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-[#dee2ec] font-mono">{data?.summary?.activeStaffCount ?? 0}</span>
              <span className="text-xs text-[#8a92a6]">คนในกะปัจจุบัน</span>
            </div>
            <div className="mt-2 text-xs text-[#57ec7f] font-bold flex items-center gap-1">
              {(data?.summary?.activeStaffCount || 0) > 0 ? (
                <><CheckCircle className="w-3.5 h-3.5" /> กำลังปฏิบัติงาน</>
              ) : (
                <span className="text-[#8a92a6] flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ยังไม่มีผู้เข้ากะ</span>
              )}
            </div>
          </div>

          <div className="bg-[#171c23]/90 p-5 rounded-xl border border-[#30353d] shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">ความแม่นยำ (Accuracy)</span>
              <div className="p-2 bg-[#4cd7f6]/10 text-[#4cd7f6] rounded-xl border border-[#4cd7f6]/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-[#dee2ec] font-mono">{data?.summary?.averageAccuracy ? `${data.summary.averageAccuracy}%` : '0%'}</span>
              <span className="text-xs text-[#8a92a6]">QC Pass</span>
            </div>
            <div className="mt-2 text-xs text-[#4cd7f6] font-bold">
              Zero-Error Verification Active
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operator Leaderboard (2 cols) */}
          <div className="lg:col-span-2 bg-[#171c23]/90 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="p-5 border-b border-[#30353d] flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#dee2ec] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#facc15]" />
                  ตารางอันดับประสิทธิภาพพนักงาน (Operator Leaderboard)
                </h2>
                <p className="text-xs text-[#8a92a6]">เรียงตามความเร็วเฉลี่ยในการหยิบ/จัดสินค้า (PPH)</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-[#12161d] text-[#facc15] border border-[#30353d] rounded-lg">
                เป้าหมาย: 75 PPH
              </span>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-[#8a92a6] text-xs">กำลังคำนวณ KPI ประสิทธิภาพ...</div>
              ) : !data?.leaderboard || data.leaderboard.length === 0 ? (
                <div className="p-8 text-center text-[#8a92a6] text-xs">ไม่พบข้อมูลการทำงานในกะปัจจุบัน</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#12161d] text-[#8a92a6] font-bold uppercase tracking-wider border-b border-[#30353d]">
                    <tr>
                      <th className="py-3 px-4 text-center w-12">#</th>
                      <th className="py-3 px-4">พนักงาน</th>
                      <th className="py-3 px-4 text-center">ชั่วโมงทำงาน</th>
                      <th className="py-3 px-4 text-center">ยอดที่หยิบได้</th>
                      <th className="py-3 px-4 text-center">ความเร็ว PPH</th>
                      <th className="py-3 px-4 text-center">ความแม่นยำ</th>
                      <th className="py-3 px-4 text-right">เกณฑ์ประเมิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262c36]">
                    {data.leaderboard.map((op, idx) => (
                      <tr key={op.userId} className="hover:bg-white/5 transition">
                        <td className="py-3 px-4 text-center font-bold">
                          {idx === 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#facc15] text-[#1b1600] font-black text-xs">1</span>
                          ) : idx === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#8a92a6] text-[#12161d] font-black text-xs">2</span>
                          ) : idx === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#d97706] text-white font-black text-xs">3</span>
                          ) : (
                            <span className="text-[#8a92a6] font-mono">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#dee2ec]">{op.name}</div>
                          <div className="text-[10px] text-[#8a92a6]">ID: {op.userId}</div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[#8a92a6]">
                          {op.activeHours} ชม.
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-[#dee2ec]">
                          {op.totalPicks.toLocaleString()} ชิ้น
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-sm text-[#4cd7f6]">
                          {op.pph} <span className="text-[10px] font-normal text-[#8a92a6]">PPH</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-[#57ec7f]">
                          {op.accuracyRate}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          {getRatingBadge(op.rating)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Zone Congestion Heatmap / Alerts (1 col) */}
          <div className="bg-[#171c23]/90 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl p-5 space-y-4">
            <div className="border-b border-[#30353d] pb-3">
              <h3 className="text-base font-black text-[#dee2ec] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#facc15]" />
                ตรวจจับความแออัดคลัง (Zone Congestion)
              </h3>
              <p className="text-xs text-[#8a92a6]">ตรวจสอบจุดคอขวดเพื่อกระจายงานใหม่ (Dynamic Balancing)</p>
            </div>

            <div className="space-y-3">
              {(!data?.congestions || data.congestions.length === 0) ? (
                <div className="p-6 text-center text-[#8a92a6] text-xs bg-[#12161d] rounded-xl border border-[#30353d]">
                  <CheckCircle className="w-8 h-8 text-[#57ec7f] mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-[#dee2ec]">การสัญจรในทุกโซนคล่องตัวดี</p>
                  <p>ไม่พบจุดคอขวดหรือความแออัดในพื้นที่จัดเก็บ</p>
                </div>
              ) : (
                data.congestions.map((c) => (
                <div
                  key={c.zone}
                  className={`p-3.5 rounded-xl border transition ${
                    c.status === 'CONGESTED'
                      ? 'bg-[#ff5449]/10 border-[#ff5449]/30 text-[#ffb4ab]'
                      : c.status === 'MODERATE'
                      ? 'bg-[#facc15]/10 border-[#facc15]/30 text-[#facc15]'
                      : 'bg-[#57ec7f]/10 border-[#57ec7f]/30 text-[#57ec7f]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-bold text-sm text-[#dee2ec]">โซน {c.zone}</div>
                    {getCongestionBadge(c.status)}
                  </div>
                  <div className="text-xs text-[#8a92a6]">
                    กำลังคนในโซน: <span className="font-mono font-bold text-[#dee2ec]">{c.operatorCount} คน</span>
                  </div>
                  <div className="text-xs mt-1 font-medium">{c.message}</div>
                </div>
              )))}
            </div>

            {/* Quick Recommendations */}
            <div className="p-4 bg-[#12161d] border border-[#30353d] rounded-xl space-y-2">
              <div className="font-bold text-xs text-[#4cd7f6] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#4cd7f6]" />
                คำแนะนำอัจฉริยะ (AI Slotting & LMS)
              </div>
              <p className="text-xs text-[#8a92a6] leading-relaxed">
                ระบบคำนวณความหนาแน่นแบบ Real-Time จากจำนวนการหยิบและพนักงานในแต่ละโซนเพื่อป้องกันการเบียดเสียด
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
