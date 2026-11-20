'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Users,
  Award,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  Flame,
  TrendingUp,
  RefreshCw,
  Boxes,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/12 text-emerald-700 border border-emerald-500/20">
            <Flame className="w-3.5 h-3.5 text-emerald-600" /> ยอดเยี่ยม (TOP TIER)
          </span>
        );
      case 'GOOD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/12 text-sky-700 border border-sky-500/20">
            <Award className="w-3.5 h-3.5 text-sky-600" /> มาตรฐานดี (GOOD)
          </span>
        );
      case 'ON_TRACK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 border border-amber-500/25">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> ตามเกณฑ์ (ON TRACK)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/12 text-rose-700 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> ต้องปรับปรุง
          </span>
        );
    }
  };

  const getCongestionBadge = (status: string) => {
    switch (status) {
      case 'CONGESTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 text-xs font-semibold border border-rose-500/25">
            หนาแน่นสูง (BOTTLENECK)
          </span>
        );
      case 'MODERATE':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 text-xs font-semibold border border-amber-500/25">
            ปานกลาง
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 text-xs font-semibold border border-emerald-500/20">
            คล่องตัวดี
          </span>
        );
    }
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Open Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <Sparkles className="w-3 h-3 text-sky-600" />
                Labor Management & Operator KPIs
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12 border border-sky-500/20 text-sky-700">
                <Zap className="w-5 h-5" />
              </span>
              <span>Labor Management System & Operator KPIs</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              วิเคราะห์ประสิทธิภาพการหยิบ/แพ็ค (Picks Per Hour - PPH), Leaderboard พนักงาน และตรวจจับความแออัดของโซนแบบ Real-Time
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full border border-slate-200/80 shadow-xs transition flex items-center gap-2 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>

        {/* Summary KPI Cards (1 Dark Accent Hero Card + 3 Glass Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="nx-dark-accent-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">ความเร็วหยิบเฉลี่ย (PPH)</span>
              <div className="p-2 bg-sky-500/20 text-sky-300 rounded-xl border border-sky-400/30">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-bold text-white font-mono tabular-nums">{data?.summary?.averagePph ?? 0}</span>
              <span className="text-xs text-slate-300">ชิ้น / ชม.</span>
            </div>
            <div className="mt-2 text-xs font-semibold flex items-center gap-1">
              {(data?.summary?.averagePph || 0) >= (data?.summary?.targetPph || 75) && (data?.summary?.averagePph || 0) > 0 ? (
                <span className="text-emerald-300 flex items-center gap-1 tabular-nums">
                  <TrendingUp className="w-3.5 h-3.5" /> บรรลุเป้าหมาย ({data?.summary?.targetPph ?? 75} PPH)
                </span>
              ) : (data?.summary?.averagePph || 0) > 0 ? (
                <span className="text-amber-300 flex items-center gap-1 tabular-nums">
                  <Clock className="w-3.5 h-3.5" /> ต่ำกว่าเป้าหมาย ({data?.summary?.targetPph ?? 75} PPH)
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> รอเริ่มกะปฏิบัติงาน
                </span>
              )}
            </div>
          </div>

          <div className="nx-glass-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">ยอดรวมสินค้าที่จัดการ</span>
              <div className="p-2 bg-amber-500/15 text-amber-700 rounded-xl border border-amber-500/25">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                {(data?.summary?.totalUnitsHandled ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">ชิ้น</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">นับรวม Pick, Pack & Putaway</div>
          </div>

          <div className="nx-glass-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">พนักงานที่ปฏิบัติงาน</span>
              <div className="p-2 bg-emerald-500/12 text-emerald-700 rounded-xl border border-emerald-500/20">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                {data?.summary?.activeStaffCount ?? 0}
              </span>
              <span className="text-xs text-slate-500">คนในกะปัจจุบัน</span>
            </div>
            <div className="mt-2 text-xs text-emerald-700 font-semibold flex items-center gap-1">
              {(data?.summary?.activeStaffCount || 0) > 0 ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" /> กำลังปฏิบัติงาน
                </>
              ) : (
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> ยังไม่มีผู้เข้ากะ
                </span>
              )}
            </div>
          </div>

          <div className="nx-glass-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">ความแม่นยำ (Accuracy)</span>
              <div className="p-2 bg-sky-500/12 text-sky-700 rounded-xl border border-sky-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                {data?.summary?.averageAccuracy ? `${data.summary.averageAccuracy}%` : '0%'}
              </span>
              <span className="text-xs text-slate-500">QC Pass</span>
            </div>
            <div className="mt-2 text-xs text-sky-700 font-semibold">Zero-Error Verification Active</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operator Leaderboard (2 cols) */}
          <div className="lg:col-span-2 nx-glass-card overflow-hidden">
            <div className="p-5 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  ตารางอันดับประสิทธิภาพพนักงาน (Operator Leaderboard)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">เรียงตามความเร็วเฉลี่ยในการหยิบ/จัดสินค้า (PPH)</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-amber-500/15 text-amber-800 border border-amber-500/25 rounded-full tabular-nums">
                เป้าหมาย: 75 PPH
              </span>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-10 text-center text-slate-500 text-xs">กำลังคำนวณ KPI ประสิทธิภาพ...</div>
              ) : !data?.leaderboard || data.leaderboard.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs">ไม่พบข้อมูลการทำงานในกะปัจจุบัน</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200/80">
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
                  <tbody className="divide-y divide-slate-200/70">
                    {data.leaderboard.map((op, idx) => (
                      <tr key={op.userId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-center font-bold tabular-nums">
                          {idx === 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-900 font-bold text-xs">
                              1
                            </span>
                          ) : idx === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-900 font-bold text-xs">
                              2
                            </span>
                          ) : idx === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-bold text-xs">
                              3
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{op.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">ID: {op.userId}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-600 tabular-nums">
                          {op.activeHours} ชม.
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900 tabular-nums">
                          {op.totalPicks.toLocaleString()} ชิ้น
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-sm text-sky-700 tabular-nums">
                          {op.pph} <span className="text-[10px] font-normal text-slate-500">PPH</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-700 tabular-nums">
                          {op.accuracyRate}%
                        </td>
                        <td className="py-3.5 px-4 text-right">{getRatingBadge(op.rating)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Zone Congestion Heatmap / Alerts (1 col) */}
          <div className="nx-glass-card p-5 space-y-4">
            <div className="border-b border-slate-200/70 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                ตรวจจับความแออัดคลัง (Zone Congestion)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">ตรวจสอบจุดคอขวดเพื่อกระจายงานใหม่ (Dynamic Balancing)</p>
            </div>

            <div className="space-y-3">
              {!data?.congestions || data.congestions.length === 0 ? (
                <div className="p-6 text-center text-slate-600 text-xs bg-slate-50/80 rounded-2xl border border-slate-200/80">
                  <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="font-bold text-slate-900">การสัญจรในทุกโซนคล่องตัวดี</p>
                  <p className="mt-0.5">ไม่พบจุดคอขวดหรือความแออัดในพื้นที่จัดเก็บ</p>
                </div>
              ) : (
                data.congestions.map((c) => (
                  <div
                    key={c.zone}
                    className={`p-3.5 rounded-2xl border transition ${
                      c.status === 'CONGESTED'
                        ? 'bg-rose-500/8 border-rose-500/25 text-rose-800'
                        : c.status === 'MODERATE'
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-900'
                        : 'bg-emerald-500/8 border-emerald-500/20 text-emerald-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="font-bold text-sm text-slate-900">โซน {c.zone}</div>
                      {getCongestionBadge(c.status)}
                    </div>
                    <div className="text-xs text-slate-600">
                      กำลังคนในโซน: <span className="font-mono font-bold text-slate-900 tabular-nums">{c.operatorCount} คน</span>
                    </div>
                    <div className="text-xs mt-1 font-medium">{c.message}</div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Recommendations */}
            <div className="p-4 bg-sky-500/8 border border-sky-500/20 rounded-2xl space-y-1.5">
              <div className="font-bold text-xs text-sky-800 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-sky-600" />
                คำแนะนำอัจฉริยะ (AI Slotting & LMS)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                ระบบคำนวณความหนาแน่นแบบ Real-Time จากจำนวนการหยิบและพนักงานในแต่ละโซนเพื่อป้องกันการเบียดเสียด
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
