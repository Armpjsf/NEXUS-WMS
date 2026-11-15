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
        const activeStaff = list.filter(s => s.status === 'ACTIVE');
        const avg = (fn: (s: StaffMetric) => number) =>
          list.length ? +(list.reduce((a, b) => a + fn(b), 0) / list.length).toFixed(1) : 0;
        setData({
          activeStaffCount: activeStaff.length,
          warehousePicksPerHour: Math.round(avg(s => s.picksPerHour)),
          overallAccuracyRate: avg(s => s.accuracyRate),
          avgOrderFulfillmentMinutes: avg(s => s.avgTurnaroundMinutes),
          topPerformers: [...list].sort((a, b) => b.score - a.score).slice(0, 3),
          staffList: list,
        });
      } catch {
        /* เงียบไว้ — คงค่าว่าง (empty-state) */
      }
    })();
    return () => { active = false; };
  }, []);

  const filteredStaff = data.staffList.filter(s => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase());
    const matchBranch = filterBranch === 'ALL' || s.branch.includes(filterBranch);
    return matchSearch && matchBranch;
  });

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[#0f141b]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#facc15] text-[#1b1600] rounded-xl shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#dee2ec] tracking-tight">
              Dashboard ประสิทธิภาพพนักงาน (Staff Performance)
            </h1>
            <p className="text-xs text-[#8a92a6] font-medium mt-0.5">
              ติดตามสถิติการหยิบสินค้า (Picks/ชม.), ความเร็วแพ็ก, ความแม่นยำ และการตรวจนับสต็อกรายบุคคล
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#171c23] border border-[#30353d] text-[#d1c6ab] hover:bg-[#1b2027] hover:text-[#facc15] rounded-xl font-mono font-bold text-xs shadow-sm transition-all"
        >
          <Printer className="w-4 h-4 text-[#facc15]" />
          <span>พิมพ์รายงาน KPI</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="p-4 bg-[#171c23] rounded-xl border border-[#30353d] shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#4cd7f6]/15 text-[#4cd7f6] border border-[#4cd7f6]/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-bold text-[#8a92a6] uppercase">พนักงานกำลังปฏิบัติงาน</div>
            <div className="text-2xl font-mono font-black text-[#dee2ec] mt-0.5">
              {data.activeStaffCount} <span className="text-xs text-[#8a92a6] font-normal">/ {data.staffList.length} คน</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#171c23] rounded-xl border border-[#30353d] shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#facc15]/15 text-[#facc15] border border-[#facc15]/30 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-bold text-[#8a92a6] uppercase">อัตราการหยิบเฉลี่ย</div>
            <div className="text-2xl font-mono font-black text-[#facc15] mt-0.5">
              {data.warehousePicksPerHour} <span className="text-xs text-[#8a92a6] font-normal">picks/ชม.</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#171c23] rounded-xl border border-[#30353d] shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#57ec7f]/15 text-[#57ec7f] border border-[#57ec7f]/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-bold text-[#8a92a6] uppercase">ความแม่นยำ (Accuracy)</div>
            <div className="text-2xl font-mono font-black text-[#57ec7f] mt-0.5">
              {data.overallAccuracyRate}%
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#171c23] rounded-xl border border-[#30353d] shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#4cd7f6]/15 text-[#4cd7f6] border border-[#4cd7f6]/30 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-bold text-[#8a92a6] uppercase">เวลาต่อออเดอร์เฉลี่ย</div>
            <div className="text-2xl font-mono font-black text-[#4cd7f6] mt-0.5">
              {data.avgOrderFulfillmentMinutes} <span className="text-xs text-[#8a92a6] font-normal">นาที/ใบ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {data.staffList.length === 0 && (
        <div className="mb-6 flex flex-col items-center justify-center text-center py-14 rounded-xl border border-dashed border-[#30353d] bg-[#171c23]">
          <Users className="w-10 h-10 text-[#8a92a6] mb-3" />
          <p className="font-bold text-[#dee2ec]">ยังไม่มีข้อมูลประสิทธิภาพพนักงาน</p>
          <p className="text-sm text-[#8a92a6] mt-1.5 max-w-md">
            ระบบยังไม่ได้บันทึกผู้ปฏิบัติงานในแต่ละรายการ (หยิบ/แพ็ก/ตรวจนับ)
            เมื่อเปิดใช้การบันทึกผู้ทำรายการแล้ว สถิติรายบุคคลจะแสดงที่นี่ตามจริง
          </p>
        </div>
      )}

      {/* Top 3 Performers */}
      <div className={cn("mb-6", data.topPerformers.length === 0 && "hidden")}>
        <div className="text-sm font-bold text-[#dee2ec] mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-[#facc15]" />
          <span>ยอดพนักงานดีเด่นประจำวัน (Top Performers)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.topPerformers.map((p, idx) => (
            <div
              key={p.id}
              className={cn(
                "p-4 rounded-xl border shadow-sm flex items-center justify-between",
                idx === 0 ? "bg-[#171c23] border-[#facc15]/50" : "bg-[#171c23] border-[#30353d]"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{p.avatar}</div>
                <div>
                  <div className="font-bold text-sm text-[#dee2ec] flex items-center gap-1.5">
                    <span>{p.name}</span>
                    {p.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#facc15]/15 text-[#facc15] border border-[#facc15]/30 font-mono font-bold">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#8a92a6]">{p.role} · {p.branch}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono font-black text-[#dee2ec]">{p.score}</div>
                <div className="text-[10px] text-[#8a92a6] font-mono font-bold uppercase">คะแนน KPI</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Table */}
      <div className={cn("bg-[#171c23] rounded-xl border border-[#30353d] shadow-sm overflow-hidden", data.staffList.length === 0 && "hidden")}>
        <div className="p-4 border-b border-[#30353d] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-bold text-sm text-[#dee2ec]">
            ตารางอันดับและสถิติการปฏิบัติงานรายบุคคล
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-[#8a92a6] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, ตำแหน่ง..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#1b2027] border border-[#30353d] rounded-xl focus:outline-none focus:border-[#4cd7f6] text-[#dee2ec] placeholder-[#8a92a6]"
              />
            </div>

            <select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#1b2027] border border-[#30353d] rounded-xl font-medium text-[#dee2ec]"
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
            <thead className="bg-[#1b2027] text-[#8a92a6] font-mono font-bold uppercase border-b border-[#30353d]">
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
            <tbody className="divide-y divide-[#30353d]">
              {filteredStaff.map((s, i) => (
                <tr key={s.id} className="hover:bg-[#1b2027]/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{s.avatar}</span>
                      <div>
                        <div className="font-bold text-[#dee2ec]">{s.name}</div>
                        <div className="text-[11px] text-[#8a92a6]">{s.role} · {s.branch}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border",
                        s.status === 'ACTIVE' && "bg-[#57ec7f]/15 text-[#57ec7f] border-[#57ec7f]/30",
                        s.status === 'BREAK' && "bg-[#facc15]/15 text-[#facc15] border-[#facc15]/30",
                        s.status === 'OFFLINE' && "bg-[#252a32] text-[#8a92a6] border-[#30353d]"
                      )}
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        s.status === 'ACTIVE' ? "bg-[#57ec7f]" : s.status === 'BREAK' ? "bg-[#facc15]" : "bg-slate-400"
                      )} />
                      {s.status === 'ACTIVE' && 'กำลังทำงาน'}
                      {s.status === 'BREAK' && 'พักเบรก'}
                      {s.status === 'OFFLINE' && 'ออฟไลน์'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-[#dee2ec]">
                    {s.totalPicks.toLocaleString()} ชิ้น
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#facc15]">
                    {s.picksPerHour} ชิ้น/ชม.
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#d1c6ab]">
                    {s.packedOrders} ออเดอร์
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#d1c6ab]">
                    {s.cycleCountsCompleted} จุด
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-mono font-black text-[#57ec7f]">{s.accuracyRate}%</div>
                    <div className="w-16 ml-auto bg-[#090f15] border border-[#30353d] h-1.5 rounded-full overflow-hidden mt-1">
                      <div className="bg-[#57ec7f] h-full rounded-full" style={{ width: `${s.accuracyRate}%` }} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2.5 py-1 rounded-lg bg-[#4cd7f6]/15 border border-[#4cd7f6]/30 text-[#4cd7f6] font-mono font-black text-xs">
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
