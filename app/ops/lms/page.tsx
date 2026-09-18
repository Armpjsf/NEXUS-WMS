'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Users, TrendingUp, TrendingDown, Trophy, Activity } from 'lucide-react';

interface Op {
  operator: string; linesIn: number; unitsIn: number; linesOut: number; unitsOut: number;
  linesAdjust: number; totalLines: number; totalUnits: number; activeDays: number; linesPerDay: number; lastAt: string;
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
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(days); }, [load, days]);

  const ops: Op[] = data?.operators || [];
  const team = data?.team;
  const maxUnits = Math.max(1, ...ops.map(o => o.totalUnits));

  return (
    <div className="min-h-screen bg-[#0f141b] text-[#dee2ec] pb-16">
      <header className="sticky top-0 z-20 bg-[#0f141b]/95 backdrop-blur border-b border-[#30353d] px-5 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/ops" className="p-2 rounded-xl bg-[#1b2027] border border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec]"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="font-headline font-black text-lg text-[#facc15] flex items-center gap-2"><Users className="w-5 h-5" /> Labor Management (LMS)</h1>
              <p className="text-[11px] text-[#8a92a6] font-mono">ประสิทธิภาพพนักงานจากรายการเคลื่อนไหวสต็อก</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={days} onChange={e => setDays(Number(e.target.value))} className="bg-[#1b2027] border border-[#30353d] rounded-xl px-3 py-2 text-sm font-bold outline-none">
              <option value={1}>วันนี้ (1 วัน)</option>
              <option value={7}>7 วัน</option>
              <option value={30}>30 วัน</option>
            </select>
            <button onClick={() => load(days)} disabled={loading} className="p-2 rounded-xl bg-[#252a32] border border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec] disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-5">
        {team && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="พนักงานที่ทำงาน" value={team.operators} />
            <Tile label="รายการรวม" value={team.totalLines.toLocaleString()} />
            <Tile label="หน่วยรับเข้า" value={team.unitsIn.toLocaleString()} tone="green" />
            <Tile label="หน่วยจ่ายออก" value={team.unitsOut.toLocaleString()} tone="amber" />
          </div>
        )}

        <div className="bg-[#171c23] border border-[#30353d] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4 text-sm font-bold text-[#d1c6ab]"><Trophy className="w-4 h-4 text-[#facc15]" /> อันดับประสิทธิภาพ (ตามหน่วยที่จัดการ)</div>
          {loading && !data ? <div className="text-center text-[#8a92a6] py-10"><RefreshCw className="w-5 h-5 animate-spin inline" /> กำลังโหลด...</div>
            : ops.length === 0 ? <div className="text-center text-[#8a92a6] py-10">ไม่มีข้อมูลในช่วงนี้</div>
            : (
              <div className="space-y-2.5">
                {ops.map((o, i) => (
                  <div key={o.operator} className="bg-[#1b2027] border border-[#30353d] rounded-xl p-3.5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${i === 0 ? 'bg-[#facc15]/20 text-[#facc15]' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-orange-500/20 text-orange-300' : 'bg-[#252a32] text-[#8a92a6]'}`}>{i + 1}</span>
                        <div className="min-w-0"><div className="font-bold truncate">{o.operator}</div><div className="text-[11px] text-[#8a92a6]">{o.activeDays} วันทำงาน · ~{o.linesPerDay} รายการ/วัน</div></div>
                      </div>
                      <div className="text-right shrink-0"><div className="text-lg font-black font-mono text-[#dee2ec]">{o.totalUnits.toLocaleString()}</div><div className="text-[11px] text-[#8a92a6]">{o.totalLines} รายการ</div></div>
                    </div>
                    <div className="h-1.5 bg-[#0f141b] rounded-full overflow-hidden mb-2"><div className="h-full bg-gradient-to-r from-[#4cd7f6] to-[#57ec7f]" style={{ width: `${(o.totalUnits / maxUnits) * 100}%` }} /></div>
                    <div className="flex gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-[#57ec7f]"><TrendingUp className="w-3 h-3" /> รับ {o.unitsIn} ({o.linesIn})</span>
                      <span className="flex items-center gap-1 text-[#facc15]"><TrendingDown className="w-3 h-3" /> จ่าย {o.unitsOut} ({o.linesOut})</span>
                      {o.linesAdjust > 0 && <span className="flex items-center gap-1 text-[#4cd7f6]"><Activity className="w-3 h-3" /> ปรับ {o.linesAdjust}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
        <p className="text-[11px] text-[#8a92a6]">* นับจากรายการเคลื่อนไหวสต็อก (รับ/จ่าย/ปรับ) ที่บันทึกชื่อผู้ทำ — ใช้ประเมินภาระงานและ incentive</p>
      </main>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: any; tone?: string }) {
  const c = tone === 'green' ? 'text-[#57ec7f]' : tone === 'amber' ? 'text-[#facc15]' : 'text-[#dee2ec]';
  return (
    <div className="bg-[#171c23] border border-[#30353d] rounded-2xl p-4">
      <div className={`text-2xl font-black font-mono ${c}`}>{value}</div>
      <div className="text-xs text-[#8a92a6] mt-1">{label}</div>
    </div>
  );
}
