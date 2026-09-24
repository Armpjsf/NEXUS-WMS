'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, PackageX, Bot,
  ClipboardList, ShieldAlert, Clock, Activity, BatteryLow,
} from 'lucide-react';
import { errorMessage } from '@/lib/errors';

interface CT {
  generatedAt: string;
  inventory: { skus: number; totalUnits: number; lowStock: number; outOfStock: number; topLow: any[] };
  orders: { new: number; fulfilling: number; shippedToday: number; reservationsActive: number };
  lots: { recalled: number; expiringSoon: any[] };
  robotics: { total: number; idle: number; active: number; error: number; charging: number; activeMissions: number; lowBattery: number };
  recentMovements: any[];
}

export default function ControlTowerPage() {
  const [data, setData] = useState<CT | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/control-tower', { cache: 'no-store' });
      const d = await res.json();
      if (d.success === false) throw new Error(d.error || 'โหลดข้อมูลไม่สำเร็จ');
      setData(d);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const inv = data?.inventory, ord = data?.orders, lots = data?.lots, rob = data?.robotics;

  return (
    <div className="min-h-screen bg-[#0f141b] text-[#dee2ec] pb-16">
      <header className="sticky top-0 z-20 bg-[#0f141b]/95 backdrop-blur border-b border-[#30353d] px-5 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/ops" className="p-2 rounded-xl bg-[#1b2027] border border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec]"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="font-headline font-black text-lg text-[#facc15] tracking-wide flex items-center gap-2"><Activity className="w-5 h-5" /> Control Tower</h1>
              <p className="text-[11px] text-[#8a92a6] font-mono">{data ? `อัปเดต ${new Date(data.generatedAt).toLocaleTimeString('th-TH')}` : 'ภาพรวมคลังแบบเรียลไทม์'}</p>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded-xl bg-[#252a32] border border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec] flex items-center gap-1.5 text-sm font-bold disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> รีเฟรช
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 space-y-6">
        {err && <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 text-sm">{err}</div>}
        {!data && loading && <div className="text-center text-[#8a92a6] py-16"><RefreshCw className="w-6 h-6 animate-spin inline" /> กำลังโหลด...</div>}

        {data && (
          <>
            <p className="text-[11px] text-[#8a92a6] -mt-2">ศูนย์เฝ้าระวัง — สิ่งที่ต้อง <b className="text-[#d1c6ab]">ลงมือจัดการ</b> ตอนนี้ (ตัวเลขภาพรวม/การเงินดูที่หน้า <Link href="/dashboard" className="text-[#4cd7f6] underline">ภาพรวมระบบ</Link>)</p>

            {/* action / exception signals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={ShieldAlert} tone={lots!.recalled > 0 ? 'rose' : 'green'} label="ล็อตเรียกคืน" value={lots!.recalled} sub={lots!.recalled > 0 ? 'ต้องติดตามลูกค้า' : 'ไม่มี'} />
              <Kpi icon={Clock} tone={lots!.expiringSoon.length > 0 ? 'amber' : 'green'} label="ล็อตใกล้หมดอายุ" value={lots!.expiringSoon.length} sub="ภายใน 30 วัน — เร่งระบาย" />
              <Kpi icon={Bot} tone={rob!.error > 0 ? 'rose' : 'cyan'} label="หุ่นยนต์พร้อม" value={`${rob!.idle + rob!.active}/${rob!.total}`} sub={`งานวิ่ง ${rob!.activeMissions}${rob!.error ? ` · ERROR ${rob!.error}` : ''}`} />
              <Kpi icon={BatteryLow} tone={rob!.lowBattery > 0 ? 'amber' : 'green'} label="แบตหุ่นยนต์ต่ำ" value={rob!.lowBattery} sub={`ชาร์จอยู่ ${rob!.charging}`} />
            </div>

            {/* live order pipeline */}
            <Panel title="คิวงานออเดอร์ (Live Pipeline)" icon={ClipboardList}>
              <div className="grid grid-cols-4 gap-3 text-center">
                <Pipe label="ใหม่ (รอจัด)" value={ord!.new} tone="blue" />
                <Pipe label="กำลังจัด/แพ็ก" value={ord!.fulfilling} tone="amber" />
                <Pipe label="ส่งวันนี้" value={ord!.shippedToday} tone="green" />
                <Pipe label="จองสต็อก (ATP)" value={ord!.reservationsActive} tone="cyan" />
              </div>
            </Panel>

            <div className="grid md:grid-cols-2 gap-5">
              {/* low stock — actionable list (dashboard only shows the count) */}
              <Panel title="สต็อกต่ำ / ต้องเติม" icon={PackageX}>
                {inv!.topLow.length === 0 ? <Empty text="ไม่มีสินค้าสต็อกต่ำ" /> : (
                  <ul className="divide-y divide-[#30353d]">
                    {inv!.topLow.map((p: any, i: number) => (
                      <li key={i} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0"><div className="text-sm font-semibold truncate">{p.name}</div><div className="text-[11px] text-[#8a92a6] font-mono">{p.sku}</div></div>
                        <div className="text-right shrink-0"><span className={`text-lg font-black font-mono ${p.stock <= 0 ? 'text-rose-400' : 'text-[#facc15]'}`}>{p.stock}</span><span className="text-[11px] text-[#8a92a6]"> / {p.min} {p.unit || ''}</span></div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {/* lots expiring */}
              <Panel title="ล็อตใกล้หมดอายุ (FEFO)" icon={Clock}>
                {lots!.expiringSoon.length === 0 ? <Empty text="ไม่มีล็อตใกล้หมดอายุ" /> : (
                  <ul className="divide-y divide-[#30353d]">
                    {lots!.expiringSoon.map((l: any, i: number) => (
                      <li key={i} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0"><div className="text-sm font-mono font-bold truncate">{l.lot} <span className="text-[#8a92a6] font-sans">· {l.sku}</span></div><div className="text-[11px] text-[#8a92a6]">EXP {l.expDate} · {l.qty} ชิ้น</div></div>
                        <span className={`text-xs font-black px-2 py-1 rounded-lg shrink-0 ${l.days <= 7 ? 'bg-rose-500/15 text-rose-300' : l.days <= 30 ? 'bg-amber-500/15 text-amber-300' : 'bg-[#252a32] text-[#8a92a6]'}`}>{l.days <= 0 ? 'หมดอายุ' : `${l.days} วัน`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: any; tone: string; label: string; value: any; sub?: string }) {
  const map: Record<string, string> = {
    cyan: 'text-[#4cd7f6] bg-[#4cd7f6]/10 border-[#4cd7f6]/20',
    green: 'text-[#57ec7f] bg-[#57ec7f]/10 border-[#57ec7f]/20',
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
    blue: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  };
  return (
    <div className="bg-[#171c23] border border-[#30353d] rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-2.5 ${map[tone] || map.cyan}`}><Icon className="w-4 h-4" /></div>
      <div className="text-2xl font-black font-mono leading-none">{value}</div>
      <div className="text-xs text-[#dee2ec] font-semibold mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-[#8a92a6] mt-0.5">{sub}</div>}
    </div>
  );
}

function Pipe({ label, value, tone }: { label: string; value: number; tone: string }) {
  const c: Record<string, string> = { blue: 'text-blue-300', amber: 'text-amber-300', green: 'text-[#57ec7f]', cyan: 'text-[#4cd7f6]' };
  return (
    <div className="bg-[#1b2027] border border-[#30353d] rounded-xl py-3">
      <div className={`text-2xl font-black font-mono ${c[tone] || ''}`}>{value}</div>
      <div className="text-[11px] text-[#8a92a6] mt-1">{label}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-[#171c23] border border-[#30353d] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3 text-sm font-bold text-[#d1c6ab]"><Icon className="w-4 h-4 text-[#8a92a6]" /> {title}</div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-[#8a92a6] text-sm py-8">{text}</div>;
}
