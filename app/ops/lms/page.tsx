'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Users, TrendingUp, TrendingDown, Trophy, Activity } from 'lucide-react';

interface Op {
  operator: string;
  linesIn: number;
  unitsIn: number;
  linesOut: number;
  unitsOut: number;
  linesAdjust: number;
  totalLines: number;
  totalUnits: number;
  activeDays: number;
  linesPerDay: number;
  lastAt: string;
}

export default function LmsPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lms/productivity?days=${d}`, { cache: 'no-store' });
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [load, days]);

  const ops: Op[] = data?.operators || [];
  const team = data?.team;
  const maxUnits = Math.max(1, ...ops.map((o) => o.totalUnits));

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Open Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <Link
              href="/ops"
              className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>ปฏิบัติการ</span>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-700">
                  <Users className="w-5 h-5" />
                </span>
                <span>Labor Management (LMS)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                ประสิทธิภาพพนักงานจากรายการเคลื่อนไหวสต็อก
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-white/85 border border-slate-200/80 rounded-full px-4 py-2 text-xs font-semibold text-slate-900 shadow-xs outline-none focus:border-emerald-500"
            >
              <option value={1}>วันนี้ (1 วัน)</option>
              <option value={7}>7 วัน</option>
              <option value={30}>30 วัน</option>
            </select>
            <button
              onClick={() => load(days)}
              disabled={loading}
              className="p-2.5 rounded-full bg-white/85 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs transition disabled:opacity-50"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <main className="space-y-5">
          {team && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Tile label="พนักงานที่ทำงาน" value={team.operators} />
              <Tile label="รายการรวม" value={team.totalLines.toLocaleString()} />
              <Tile label="หน่วยรับเข้า" value={team.unitsIn.toLocaleString()} tone="green" />
              <Tile label="หน่วยจ่ายออก" value={team.unitsOut.toLocaleString()} tone="amber" />
            </div>
          )}

          <div className="nx-glass-card p-6">
            <div className="flex items-center gap-2 mb-4 text-sm font-bold text-slate-900">
              <Trophy className="w-4 h-4 text-amber-600" /> อันดับประสิทธิภาพ (ตามหน่วยที่จัดการ)
            </div>
            {loading && !data ? (
              <div className="text-center text-slate-500 py-10 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-emerald-600" /> กำลังโหลด...
              </div>
            ) : ops.length === 0 ? (
              <div className="text-center text-slate-500 py-10 text-xs">ไม่มีข้อมูลในช่วงนี้</div>
            ) : (
              <div className="space-y-3">
                {ops.map((o, i) => (
                  <div key={o.operator} className="bg-white/80 border border-slate-200/80 rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 tabular-nums ${
                            i === 0
                              ? 'bg-amber-500 text-slate-900'
                              : i === 1
                              ? 'bg-slate-300 text-slate-900'
                              : i === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{o.operator}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {o.activeDays} วันทำงาน · ~{o.linesPerDay} รายการ/วัน
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                          {o.totalUnits.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">{o.totalLines} รายการ</div>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden mb-2.5">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full"
                        style={{ width: `${(o.totalUnits / maxUnits) * 100}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] font-semibold tabular-nums">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <TrendingUp className="w-3.5 h-3.5" /> รับ {o.unitsIn} ({o.linesIn})
                      </span>
                      <span className="flex items-center gap-1 text-amber-700">
                        <TrendingDown className="w-3.5 h-3.5" /> จ่าย {o.unitsOut} ({o.linesOut})
                      </span>
                      {o.linesAdjust > 0 && (
                        <span className="flex items-center gap-1 text-sky-700">
                          <Activity className="w-3.5 h-3.5" /> ปรับ {o.linesAdjust}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            * นับจากรายการเคลื่อนไหวสต็อก (รับ/จ่าย/ปรับ) ที่บันทึกชื่อผู้ทำ — ใช้ประเมินภาระงานและ incentive
          </p>
        </main>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: any; tone?: string }) {
  const c = tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-900';
  return (
    <div className="nx-glass-card p-5">
      <div className={`text-2xl font-bold font-mono tabular-nums ${c}`}>{value}</div>
      <div className="text-xs text-slate-600 font-medium mt-1">{label}</div>
    </div>
  );
}
