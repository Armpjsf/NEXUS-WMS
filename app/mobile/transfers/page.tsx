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
  DRAFT: { label: 'ฉบับร่าง', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  IN_TRANSIT: { label: 'ระหว่างขนส่ง', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  COMPLETED: { label: 'รับเข้าแล้ว', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/mobile" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-95"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="font-bold text-base leading-tight flex items-center gap-1.5"><ArrowLeftRight className="w-4 h-4 text-teal-500" /> โอนสต็อกข้ามสาขา</h1>
              <p className="text-[11px] text-slate-500">ส่งออก & รับเข้าของโอนระหว่างสาขา</p>
            </div>
          </div>
          <button onClick={load} className="p-2 rounded-lg bg-slate-100 text-slate-500 active:scale-95"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="mt-3 flex gap-1.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 px-2 py-1.5 rounded-full text-xs font-bold border ${tab === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
              {t.label} ({transfers.filter(x => x.status === t.id).length})
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 space-y-3">
        {loading ? (
          <p className="text-center text-slate-400 text-sm py-10">กำลังโหลด...</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowLeftRight className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">ไม่มีใบโอนในสถานะนี้</p>
          </div>
        ) : list.map(t => {
          const meta = STATUS_META[t.status] || STATUS_META.DRAFT;
          return (
            <div key={t.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-slate-900">{t.transferNo}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-mono text-slate-600">
                <span className="px-2 py-0.5 rounded bg-slate-100">{t.fromBranchId || '-'}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className="px-2 py-0.5 rounded bg-slate-100">{t.toBranchId || '-'}</span>
                <span className="ml-auto text-blue-600 font-bold">{t.totalQty ?? (t.items?.reduce((s, i) => s + (i.qty || 0), 0))} ชิ้น</span>
              </div>
              {t.items && t.items.length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 max-h-28 overflow-y-auto">
                  {t.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-slate-600"><span className="truncate">• {it.name || it.sku}</span><span className="font-mono">x{it.qty}</span></div>
                  ))}
                </div>
              )}
              {t.status === 'DRAFT' && (
                <button onClick={() => setStatus(t, 'IN_TRANSIT', 'ส่งออกของโอนแล้ว')} disabled={busyId === t.id}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
                  <Send className="w-4 h-4" /> ส่งออกของโอน (ระหว่างขนส่ง)
                </button>
              )}
              {t.status === 'IN_TRANSIT' && (
                <button onClick={() => setStatus(t, 'COMPLETED', 'รับเข้าคลังปลายทางแล้ว')} disabled={busyId === t.id}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
                  <PackageCheck className="w-4 h-4" /> รับเข้าคลังปลายทาง
                </button>
              )}
              {t.status === 'COMPLETED' && (
                <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-xs font-bold py-1"><CheckCircle2 className="w-4 h-4" /> รับเข้าเรียบร้อย</div>
              )}
            </div>
          );
        })}
      </main>
      <MobileNav />
    </div>
  );
}
