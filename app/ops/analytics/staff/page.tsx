'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Award,
  Zap,
  Clock,
  Search,
  ShieldCheck,
  Printer,
} from 'lucide-react';
import { getStaffPerformanceData, StaffMetric, StaffPerformanceSummary } from '@/lib/data/staff-analytics';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';

export default function StaffPerformancePage() {
  const [data, setData] = useState<StaffPerformanceSummary>(() => getStaffPerformanceData());
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('ALL');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/staff-performance'), { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const list: StaffMetric[] = json.staffList || [];
        if (!active) return;
        const activeStaff = list.filter((s) => s.status === 'ACTIVE');
        const avg = (fn: (s: StaffMetric) => number) =>
          list.length ? +(list.reduce((a, b) => a + fn(b), 0) / list.length).toFixed(1) : 0;
        setData({
          activeStaffCount: activeStaff.length,
          warehousePicksPerHour: Math.round(avg((s) => s.picksPerHour)),
          overallAccuracyRate: avg((s) => s.accuracyRate),
          avgOrderFulfillmentMinutes: avg((s) => s.avgTurnaroundMinutes),
          topPerformers: [...list].sort((a, b) => b.score - a.score).slice(0, 3),
          staffList: list,
        });
      } catch {
        /* เงียบไว้ — คงค่าว่าง (empty-state) */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredStaff = data.staffList.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase());
    const matchBranch = filterBranch === 'ALL' || s.branch.includes(filterBranch);
    return matchSearch && matchBranch;
  });

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Open Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Workforce KPI Analytics
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-700">
                <Users className="w-5 h-5" />
              </span>
              <span>Dashboard ประสิทธิภาพพนักงาน (Staff Performance)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              ติดตามสถิติการหยิบสินค้า (Picks/ชม.), ความเร็วแพ็ก, ความแม่นยำ และการตรวจนับสต็อกรายบุคคล
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-white/85 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 rounded-full font-semibold text-xs shadow-xs transition-all print:hidden"
          >
            <Printer className="w-4 h-4 text-amber-600" />
            <span>พิมพ์รายงาน KPI</span>
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="nx-glass-card p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/12 text-sky-700 border border-sky-500/20 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-600 uppercase">พนักงานกำลังปฏิบัติงาน</div>
              <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                {data.activeStaffCount}{' '}
                <span className="text-xs text-slate-500 font-sans font-normal">/ {data.staffList.length} คน</span>
              </div>
            </div>
          </div>

          <div className="nx-dark-accent-card p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-300 uppercase">อัตราการหยิบเฉลี่ย</div>
              <div className="text-2xl font-mono font-bold text-amber-300 tabular-nums mt-0.5">
                {data.warehousePicksPerHour}{' '}
                <span className="text-xs text-slate-300 font-sans font-normal">picks/ชม.</span>
              </div>
            </div>
          </div>

          <div className="nx-glass-card p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/12 text-emerald-700 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-600 uppercase">ความแม่นยำ (Accuracy)</div>
              <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums mt-0.5">
                {data.overallAccuracyRate}%
              </div>
            </div>
          </div>

          <div className="nx-glass-card p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/12 text-sky-700 border border-sky-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-600 uppercase">เวลาต่อออเดอร์เฉลี่ย</div>
              <div className="text-2xl font-mono font-bold text-sky-700 tabular-nums mt-0.5">
                {data.avgOrderFulfillmentMinutes}{' '}
                <span className="text-xs text-slate-500 font-sans font-normal">นาที/ใบ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {data.staffList.length === 0 && (
          <div className="nx-glass-card flex flex-col items-center justify-center text-center py-14 px-6 border-dashed border-slate-300">
            <Users className="w-10 h-10 text-slate-400 mb-3" />
            <p className="font-bold text-slate-900">ยังไม่มีข้อมูลประสิทธิภาพพนักงาน</p>
            <p className="text-sm text-slate-600 mt-1.5 max-w-md">
              ระบบยังไม่ได้บันทึกผู้ปฏิบัติงานในแต่ละรายการ (หยิบ/แพ็ก/ตรวจนับ)
              เมื่อเปิดใช้การบันทึกผู้ทำรายการแล้ว สถิติรายบุคคลจะแสดงที่นี่ตามจริง
            </p>
          </div>
        )}

        {/* Top 3 Performers */}
        <div className={cn(data.topPerformers.length === 0 && 'hidden')}>
          <div className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600" />
            <span>ยอดพนักงานดีเด่นประจำวัน (Top Performers)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.topPerformers.map((p, idx) => (
              <div
                key={p.id}
                className={cn(
                  'nx-glass-card p-4 flex items-center justify-between',
                  idx === 0 && 'ring-1 ring-amber-500/40 bg-amber-50/40'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{p.avatar}</div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {p.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 border border-amber-500/25 font-mono font-bold">
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600">
                      {p.role} · {p.branch}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">{p.score}</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">คะแนน KPI</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters & Table */}
        <div className={cn('nx-glass-card overflow-hidden', data.staffList.length === 0 && 'hidden')}>
          <div className="p-4 border-b border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="font-bold text-sm text-slate-900">
              ตารางอันดับและสถิติการปฏิบัติงานรายบุคคล
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto print:hidden">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, ตำแหน่ง..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/90 border border-slate-200/80 rounded-full focus:outline-none focus:border-emerald-500 text-slate-900 placeholder-slate-400"
                />
              </div>

              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="px-3.5 py-1.5 text-xs bg-white/90 border border-slate-200/80 rounded-full font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">ทุกสาขา</option>
                <option value="HQ">สำนักงานใหญ่ (HQ)</option>
                <option value="URT">สุราษฎร์ธานี</option>
                <option value="SKN">สมุทรสาคร</option>
                <option value="CMI">เชียงใหม่</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">พนักงาน</th>
                  <th className="py-3 px-4 text-center">สถานะ</th>
                  <th className="py-3 px-4 text-right">ยอดหยิบรวม</th>
                  <th className="py-3 px-4 text-right">ความเร็วหยิบ</th>
                  <th className="py-3 px-4 text-right">แพ็กออเดอร์</th>
                  <th className="py-3 px-4 text-right">ตรวจนับสต็อก</th>
                  <th className="py-3 px-4 text-right">ความแม่นยำ</th>
                  <th className="py-3 px-4 text-center">คะแนน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{s.avatar}</span>
                        <div>
                          <div className="font-bold text-slate-900">{s.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {s.role} · {s.branch}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border',
                          s.status === 'ACTIVE' && 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20',
                          s.status === 'BREAK' && 'bg-amber-500/15 text-amber-800 border-amber-500/25',
                          s.status === 'OFFLINE' && 'bg-slate-100 text-slate-600 border-slate-200'
                        )}
                      >
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-500'
                              : s.status === 'BREAK'
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                          )}
                        />
                        {s.status === 'ACTIVE' && 'กำลังทำงาน'}
                        {s.status === 'BREAK' && 'พักเบรก'}
                        {s.status === 'OFFLINE' && 'ออฟไลน์'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {s.totalPicks.toLocaleString()} ชิ้น
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700 tabular-nums">
                      {s.picksPerHour} ชิ้น/ชม.
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {s.packedOrders} ออเดอร์
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {s.cycleCountsCompleted} จุด
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-mono font-bold text-emerald-700 tabular-nums">{s.accuracyRate}%</div>
                      <div className="w-16 ml-auto bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-1">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${s.accuracyRate}%` }} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-sky-500/12 border border-sky-500/20 text-sky-700 font-mono font-bold text-xs tabular-nums">
                        {s.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
