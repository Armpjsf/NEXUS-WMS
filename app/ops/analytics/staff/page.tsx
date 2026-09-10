'use client';

import React, { useState } from 'react';
import {
  Users,
  Award,
  Zap,
  CheckCircle2,
  Clock,
  TrendingUp,
  Search,
  Filter,
  BarChart2,
  ChevronUp,
  ShieldCheck,
  Building2,
  Printer
} from 'lucide-react';
import { getStaffPerformanceData, StaffMetric } from '@/lib/data/staff-analytics';
import { cn } from '@/lib/utils';

export default function StaffPerformancePage() {
  const data = getStaffPerformanceData();
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('ALL');

  const filteredStaff = data.staffList.filter(s => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase());
    const matchBranch = filterBranch === 'ALL' || s.branch.includes(filterBranch);
    return matchSearch && matchBranch;
  });

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-slate-50/60">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-md shadow-violet-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Dashboard ประสิทธิภาพพนักงาน (Staff Performance)
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              ติดตามสถิติการหยิบสินค้า (Picks/ชม.), ความเร็วแพ็ก, ความแม่นยำ และการตรวจนับสต็อกรายบุคคล
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs shadow-sm transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>พิมพ์รายงาน KPI</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">พนักงานกำลังปฏิบัติงาน</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {data.activeStaffCount} <span className="text-xs text-slate-400 font-normal">/ {data.staffList.length} คน</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">อัตราการหยิบเฉลี่ย</div>
            <div className="text-2xl font-black text-amber-600 mt-0.5">
              {data.warehousePicksPerHour} <span className="text-xs text-slate-400 font-normal">picks/ชม.</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">ความแม่นยำ (Accuracy)</div>
            <div className="text-2xl font-black text-emerald-600 mt-0.5">
              {data.overallAccuracyRate}% <span className="text-xs text-emerald-600 font-normal">★ ยอดเยี่ยม</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">เวลาต่อออเดอร์เฉลี่ย</div>
            <div className="text-2xl font-black text-violet-600 mt-0.5">
              {data.avgOrderFulfillmentMinutes} <span className="text-xs text-slate-400 font-normal">นาที/ใบ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Performers */}
      <div className="mb-6">
        <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <span>ยอดพนักงานดีเด่นประจำวัน (Top Performers)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.topPerformers.map((p, idx) => (
            <div
              key={p.id}
              className={cn(
                "p-4 rounded-2xl border shadow-sm flex items-center justify-between",
                idx === 0 ? "bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white border-amber-200/80" : "bg-white border-slate-200/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{p.avatar}</div>
                <div>
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>{p.name}</span>
                    {p.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{p.role} · {p.branch}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-slate-900">{p.score}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">คะแนน KPI</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-bold text-sm text-slate-800">
            ตารางอันดับและสถิติการปฏิบัติงานรายบุคคล
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, ตำแหน่ง..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
              />
            </div>

            <select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
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
            <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase border-b border-slate-100">
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
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map((s, i) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{s.avatar}</span>
                      <div>
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-400">{s.role} · {s.branch}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                        s.status === 'ACTIVE' && "bg-emerald-100 text-emerald-800",
                        s.status === 'BREAK' && "bg-amber-100 text-amber-800",
                        s.status === 'OFFLINE' && "bg-slate-100 text-slate-500"
                      )}
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        s.status === 'ACTIVE' ? "bg-emerald-500" : s.status === 'BREAK' ? "bg-amber-500" : "bg-slate-400"
                      )} />
                      {s.status === 'ACTIVE' && 'กำลังทำงาน'}
                      {s.status === 'BREAK' && 'พักเบรก'}
                      {s.status === 'OFFLINE' && 'ออฟไลน์'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">
                    {s.totalPicks.toLocaleString()} ชิ้น
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-amber-700">
                    {s.picksPerHour} ชิ้น/ชม.
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {s.packedOrders} ออเดอร์
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {s.cycleCountsCompleted} จุด
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-black text-emerald-600">{s.accuracyRate}%</div>
                    <div className="w-16 ml-auto bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${s.accuracyRate}%` }} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2.5 py-1 rounded-xl bg-violet-100 text-violet-800 font-black text-xs">
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
  );
}
