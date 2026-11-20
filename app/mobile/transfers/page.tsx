'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ArrowLeftRight, ArrowRight, Send, PackageCheck, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

type TStatus = 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED' | string;
interface TItem { sku?: string; name?: string; qty?: number; unit?: string; }
interface Transfer {
  id: string; transferNo: string; status: TStatus;
  fromBranchId?: string; toBranchId?: string;
  totalQty?: number; items?: TItem[]; notes?: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'ฉบับร่าง', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  IN_TRANSIT: { label: 'ระหว่างขนส่ง', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  COMPLETED: { label: 'รับเข้าแล้ว', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};
const TABS: { id: TStatus; label: string }[] = [
  { id: 'DRAFT', label: 'ฉบับร่าง' },
  { id: 'IN_TRANSIT', label: 'ระหว่างขนส่ง' },
  { id: 'COMPLETED', label: 'สำเร็จ' },
];

export default function MobileTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [tab, setTab] = useState<TStatus>('IN_TRANSIT');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/transfers'), { cache: 'no-store' });
      const d = await res.json();
      setTransfers(d.transfers || []);
    } catch { toast.error('โหลดใบโอนไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (t: Transfer, status: TStatus, okMsg: string) => {
    setBusyId(t.id);
    try {
      const res = await fetch(getApiUrl('/api/transfers'), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'ไม่สำเร็จ');
      toast.success(okMsg);
      load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  };

  const list = transfers.filter(t => t.status === tab);

  return (
    <div className="theme-nexus-hybrid min-h-screen text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/mobile"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs active:scale-95 transition-all shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="font-bold text-base text-slate-900 leading-tight flex items-center gap-2 truncate">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/12 border border-sky-500/20 text-sky-700 shrink-0">
                    <ArrowLeftRight className="w-4 h-4" />
                  </span>
                  <span className="truncate">โอนสต็อกข้ามสาขา</span>
                </h1>
                <p className="text-[11px] text-slate-600 truncate">ส่งออก & รับเข้าของโอนระหว่างสาขา</p>
              </div>
            </div>
            <button
              onClick={load}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-600 hover:text-slate-900 shadow-xs active:scale-95 transition-all shrink-0"
              aria-label="รีเฟรช"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="mt-3 flex gap-1.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 min-h-[40px] px-2.5 py-1.5 rounded-full text-xs font-bold border tabular-nums transition-all ${
                  tab === t.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white/90 text-slate-600 border-slate-200/80 hover:text-slate-900'
                }`}
              >
                {t.label} ({transfers.filter(x => x.status === t.id).length})
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="nx-glass-card p-10 text-center text-slate-500 text-sm">กำลังโหลด...</div>
        ) : list.length === 0 ? (
          <div className="nx-glass-card flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
              <ArrowLeftRight className="w-7 h-7" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">ไม่มีใบโอนในสถานะนี้</p>
          </div>
        ) : list.map(t => {
          const meta = STATUS_META[t.status] || STATUS_META.DRAFT;
          return (
            <div key={t.id} className="nx-glass-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-slate-900 text-base tabular-nums">{t.transferNo}</span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-mono text-slate-700">
                <span className="px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-xs font-semibold">{t.fromBranchId || '-'}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-xs font-semibold">{t.toBranchId || '-'}</span>
                <span className="ml-auto text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums">
                  {t.totalQty ?? (t.items?.reduce((s, i) => s + (i.qty || 0), 0))} ชิ้น
                </span>
              </div>
              {t.items && t.items.length > 0 && (
                <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/80 text-xs space-y-1 max-h-28 overflow-y-auto">
                  {t.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-slate-700 gap-2">
                      <span className="truncate font-medium">• {it.name || it.sku}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">x{it.qty}</span>
                    </div>
                  ))}
                </div>
              )}
              {t.status === 'DRAFT' && (
                <button
                  onClick={() => setStatus(t, 'IN_TRANSIT', 'ส่งออกของโอนแล้ว')}
                  disabled={busyId === t.id}
                  className="w-full min-h-[44px] py-3 px-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" /> ส่งออกของโอน (ระหว่างขนส่ง)
                </button>
              )}
              {t.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => setStatus(t, 'COMPLETED', 'รับเข้าคลังปลายทางแล้ว')}
                  disabled={busyId === t.id}
                  className="w-full min-h-[44px] py-3 px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  <PackageCheck className="w-4 h-4" /> รับเข้าคลังปลายทาง
                </button>
              )}
              {t.status === 'COMPLETED' && (
                <div className="flex items-center justify-center gap-1.5 text-emerald-700 text-xs font-bold py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" /> รับเข้าเรียบร้อย
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
