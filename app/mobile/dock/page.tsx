'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Truck, Clock, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface Apt {
  id: string;
  appointmentNumber?: string;
  bayName?: string;
  appointmentType?: 'INBOUND' | 'OUTBOUND' | string;
  supplierOrCarrier?: string;
  vehiclePlate?: string;
  driverName?: string;
  driverPhone?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  status?: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  BOOKED: { label: 'นัดหมาย', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  CHECKED_IN: { label: 'เช็คอินแล้ว', cls: 'bg-amber-500/15 text-amber-800 border-amber-500/25' },
  AT_BAY: { label: 'กำลังเทียบท่า', cls: 'bg-sky-500/12 text-sky-700 border-sky-500/25' },
  COMPLETED: { label: 'เสร็จสิ้น', cls: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/25' },
  CANCELLED: { label: 'ยกเลิก', cls: 'bg-rose-500/12 text-rose-700 border-rose-500/25' },
};

// สถานะถัดไปที่กดได้
const NEXT: Record<string, { to: string; label: string; cls: string }> = {
  BOOKED: { to: 'CHECKED_IN', label: 'เช็คอิน (รถมาถึง)', cls: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' },
  CHECKED_IN: { to: 'AT_BAY', label: 'นำรถเข้าเบย์', cls: 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20' },
  AT_BAY: { to: 'COMPLETED', label: 'จบงานเทียบท่า', cls: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' },
};

export default function MobileDockPage() {
  const [apts, setApts] = useState<Apt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/dock/appointments'), { cache: 'no-store' });
      const d = await res.json();
      setApts(d.appointments || []);
    } catch { toast.error('โหลดคิวเทียบท่าไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const advance = async (apt: Apt) => {
    const next = NEXT[apt.status || 'BOOKED'];
    if (!next) return;
    setBusyId(apt.id);
    try {
      const res = await fetch(getApiUrl('/api/dock/appointments'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_STATUS', id: apt.id, status: next.to }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'ไม่สำเร็จ');
      toast.success(`อัปเดตเป็น "${STATUS_META[next.to]?.label || next.to}"`);
      load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  };

  const time = (s?: string) => s ? new Date(s).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="min-h-screen text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mobile" className="min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/90 border border-slate-200 text-slate-700 active:scale-95 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-base leading-tight flex items-center gap-1.5 text-slate-900">
              <Truck className="w-4 h-4 text-sky-600" /> คิวเทียบท่า (Dock)
            </h1>
            <p className="text-[11px] text-slate-500">เช็คอินรถ นำเข้าเบย์ และปิดงานเทียบท่า</p>
          </div>
        </div>
        <button onClick={load} className="min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/90 border border-slate-200 text-slate-600 active:scale-95 flex items-center justify-center">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center text-slate-500 text-sm py-10">กำลังโหลด...</p>
        ) : apts.length === 0 ? (
          <div className="nx-glass-card flex flex-col items-center justify-center py-14 text-center px-6">
            <Truck className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-slate-600 font-semibold text-sm">ไม่มีคิวเทียบท่าวันนี้</p>
          </div>
        ) : apts.map(apt => {
          const meta = STATUS_META[apt.status || 'BOOKED'] || STATUS_META.BOOKED;
          const next = NEXT[apt.status || 'BOOKED'];
          const inbound = apt.appointmentType === 'INBOUND';
          return (
            <div key={apt.id} className="nx-glass-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                    inbound
                      ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/25'
                      : 'bg-sky-500/12 text-sky-700 border-sky-500/25'
                  }`}>
                    {inbound ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                    {apt.bayName || 'เบย์'}
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums flex items-center gap-1">
                  <Clock className="w-3 h-3" />{time(apt.scheduledStart)}
                </span>
              </div>
              <div>
                <p className="font-bold text-slate-900">{apt.supplierOrCarrier || 'ขนส่ง'}</p>
                <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  {apt.vehiclePlate} · {apt.driverName || '-'}{apt.driverPhone ? ` (${apt.driverPhone})` : ''}
                </p>
              </div>
              {next ? (
                <button
                  onClick={() => advance(apt)}
                  disabled={busyId === apt.id}
                  className={`w-full min-h-[44px] py-3 rounded-full ${next.cls} text-white font-bold text-xs shadow-md active:scale-[0.98] disabled:opacity-50 transition-all`}
                >
                  {busyId === apt.id ? 'กำลังอัปเดต...' : next.label}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 text-emerald-700 text-xs font-bold py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" /> เทียบท่าเสร็จสิ้น
                </div>
              )}
            </div>
          );
        })}
      </main>
      <MobileNav />
    </div>
  );
}
