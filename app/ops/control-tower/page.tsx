'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  PackageX,
  Bot,
  ClipboardList,
  ShieldAlert,
  Clock,
  Activity,
  BatteryLow,
} from 'lucide-react';
import { errorMessage } from '@/lib/errors';

interface CT {
  generatedAt: string;
  inventory: { skus: number; totalUnits: number; lowStock: number; outOfStock: number; topLow: any[] };
  orders: { new: number; fulfilling: number; shippedToday: number; reservationsActive: number };
  lots: { recalled: number; expiringSoon: any[] };
  robotics: {
    total: number;
    idle: number;
    active: number;
    error: number;
    charging: number;
    activeMissions: number;
    lowBattery: number;
  };
  recentMovements: any[];
}

export default function ControlTowerPage() {
  const [data, setData] = useState<CT | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/control-tower', { cache: 'no-store' });
      const d = await res.json();
      if (d.success === false) throw new Error(d.error || 'โหลดข้อมูลไม่สำเร็จ');
      setData(d);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const inv = data?.inventory,
    ord = data?.orders,
    lots = data?.lots,
    rob = data?.robotics;

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-20 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Link
              href="/ops"
              className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>ปฏิบัติการ</span>
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Exception Monitor
                </span>
              </div>
              <h1 className="font-headline font-black text-2xl md:text-3xl text-slate-900 tracking-tight flex items-center gap-2.5">
                <Activity className="w-7 h-7 text-amber-600" />
                <span>Control Tower</span>
              </h1>
              <p className="text-xs text-slate-600 font-mono tabular-nums mt-0.5">
                {data ? `อัปเดต ${new Date(data.generatedAt).toLocaleTimeString('th-TH')}` : 'ภาพรวมคลังแบบเรียลไทม์'}
              </p>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="self-start sm:self-end px-4 py-2 rounded-full bg-white/85 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 flex items-center gap-2 text-xs font-bold shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>
        </div>

        {err && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 px-4 py-3 text-sm font-medium">
            {err}
          </div>
        )}
        {!data && loading && (
          <div className="nx-glass-card text-center text-slate-600 py-16 text-sm font-medium">
            <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-emerald-600" /> กำลังโหลด...
          </div>
        )}

        {data && (
          <>
            <p className="text-xs text-slate-600">
              ศูนย์เฝ้าระวัง — สิ่งที่ต้อง <b className="text-slate-900">ลงมือจัดการ</b> ตอนนี้ (ตัวเลขภาพรวม/การเงินดูที่หน้า{' '}
              <Link href="/dashboard" className="text-sky-700 font-semibold underline hover:text-sky-900">
                ภาพรวมระบบ
              </Link>
              )
            </p>

            {/* action / exception signals (1 Hero Dark Accent Card + 3 Glass Cards) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 1 Hero Dark Accent Card for Recall / Critical Signal */}
              <div className="nx-dark-accent-card p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                      lots!.recalled > 0
                        ? 'text-rose-300 bg-rose-500/15 border-rose-500/30'
                        : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      lots!.recalled > 0
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        lots!.recalled > 0 ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'
                      }`}
                    />
                    {lots!.recalled > 0 ? 'Alert' : 'Clear'}
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black font-mono tabular-nums text-white leading-none">
                    {lots!.recalled}
                  </div>
                  <div className="text-xs text-slate-200 font-semibold mt-1.5">ล็อตเรียกคืน</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {lots!.recalled > 0 ? 'ต้องติดตามลูกค้า' : 'ไม่มี'}
                  </div>
                </div>
              </div>

              <Kpi
                icon={Clock}
                tone={lots!.expiringSoon.length > 0 ? 'amber' : 'green'}
                label="ล็อตใกล้หมดอายุ"
                value={lots!.expiringSoon.length}
                sub="ภายใน 30 วัน — เร่งระบาย"
              />
              <Kpi
                icon={Bot}
                tone={rob!.error > 0 ? 'rose' : 'sky'}
                label="หุ่นยนต์พร้อม"
                value={`${rob!.idle + rob!.active}/${rob!.total}`}
                sub={`งานวิ่ง ${rob!.activeMissions}${rob!.error ? ` · ERROR ${rob!.error}` : ''}`}
              />
              <Kpi
                icon={BatteryLow}
                tone={rob!.lowBattery > 0 ? 'amber' : 'green'}
                label="แบตหุ่นยนต์ต่ำ"
                value={rob!.lowBattery}
                sub={`ชาร์จอยู่ ${rob!.charging}`}
              />
            </div>

            {/* live order pipeline */}
            <Panel title="คิวงานออเดอร์ (Live Pipeline)" icon={ClipboardList}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <Pipe label="ใหม่ (รอจัด)" value={ord!.new} tone="sky" />
                <Pipe label="กำลังจัด/แพ็ก" value={ord!.fulfilling} tone="amber" />
                <Pipe label="ส่งวันนี้" value={ord!.shippedToday} tone="green" />
                <Pipe label="จองสต็อก (ATP)" value={ord!.reservationsActive} tone="cyan" />
              </div>
            </Panel>

            <div className="grid md:grid-cols-2 gap-5">
              {/* low stock — actionable list (dashboard only shows the count) */}
              <Panel title="สต็อกต่ำ / ต้องเติม" icon={PackageX}>
                {inv!.topLow.length === 0 ? (
                  <Empty text="ไม่มีสินค้าสต็อกต่ำ" />
                ) : (
                  <ul className="divide-y divide-slate-200/75">
                    {inv!.topLow.map((p: any, i: number) => (
                      <li key={i} className="flex items-center justify-between py-2.5 gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{p.sku}</div>
                        </div>
                        <div className="text-right shrink-0 tabular-nums">
                          <span
                            className={`text-lg font-black font-mono ${
                              p.stock <= 0 ? 'text-rose-600' : 'text-amber-600'
                            }`}
                          >
                            {p.stock}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {' '}
                            / {p.min} {p.unit || ''}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {/* lots expiring */}
              <Panel title="ล็อตใกล้หมดอายุ (FEFO)" icon={Clock}>
                {lots!.expiringSoon.length === 0 ? (
                  <Empty text="ไม่มีล็อตใกล้หมดอายุ" />
                ) : (
                  <ul className="divide-y divide-slate-200/75">
                    {lots!.expiringSoon.map((l: any, i: number) => (
                      <li key={i} className="flex items-center justify-between py-2.5 gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-mono font-bold text-slate-900 truncate">
                            {l.lot} <span className="text-slate-500 font-sans font-medium">· {l.sku}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            EXP {l.expDate} · {l.qty} ชิ้น
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 border tabular-nums ${
                            l.days <= 7
                              ? 'bg-rose-500/12 text-rose-700 border-rose-500/25'
                              : l.days <= 30
                              ? 'bg-amber-500/12 text-amber-800 border-amber-500/25'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {l.days <= 0 ? 'หมดอายุ' : `${l.days} วัน`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: any;
  tone: string;
  label: string;
  value: any;
  sub?: string;
}) {
  const map: Record<string, string> = {
    sky: 'text-sky-600 bg-sky-500/12 border-sky-500/25',
    cyan: 'text-sky-600 bg-sky-500/12 border-sky-500/25',
    green: 'text-emerald-600 bg-emerald-500/12 border-emerald-500/25',
    amber: 'text-amber-600 bg-amber-500/12 border-amber-500/25',
    rose: 'text-rose-600 bg-rose-500/12 border-rose-500/25',
    blue: 'text-sky-600 bg-sky-500/12 border-sky-500/25',
  };
  return (
    <div className="nx-glass-card p-5 flex flex-col justify-between">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-3 ${map[tone] || map.sky}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-2xl font-black font-mono tabular-nums text-slate-900 leading-none">{value}</div>
        <div className="text-xs text-slate-800 font-semibold mt-1.5">{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function Pipe({ label, value, tone }: { label: string; value: number; tone: string }) {
  const c: Record<string, string> = {
    sky: 'text-sky-600',
    blue: 'text-sky-600',
    amber: 'text-amber-600',
    green: 'text-emerald-600',
    cyan: 'text-sky-700',
  };
  return (
    <div className="bg-white/75 border border-slate-200/80 rounded-2xl py-3.5 px-2 shadow-2xs">
      <div className={`text-2xl font-black font-mono tabular-nums ${c[tone] || 'text-slate-900'}`}>{value}</div>
      <div className="text-[11px] font-medium text-slate-600 mt-1">{label}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="nx-glass-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3.5 text-sm font-bold text-slate-900">
        <Icon className="w-4 h-4 text-slate-500" /> {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-slate-500 text-sm py-8">{text}</div>;
}
