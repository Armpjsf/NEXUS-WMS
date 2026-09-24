'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ClipboardCheck, Check, X, MapPin, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface Adj {
  requestId?: string;
  id?: string;
  sku?: string;
  location?: string;
  systemQty?: number;
  countedQty?: number;
  diffQty?: number;
  reason?: string;
  notes?: string;
  requestedBy?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
}

export default function MobileAdjustmentsPage() {
  const [items, setItems] = useState<Adj[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Adj | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/adjustments'), { cache: 'no-store' });
      const d = await res.json();
      setItems(d.data || []);
    } catch { toast.error('โหลดคำขอปรับยอดไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (a: Adj, action: 'APPROVE' | 'REJECT', rejectionReason = '') => {
    const requestId = a.requestId || a.id;
    if (!requestId) return;
    setBusyId(requestId);
    try {
      const res = await fetch(getApiUrl('/api/adjustments/approve'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, rejectionReason }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'ไม่สำเร็จ');
      toast.success(action === 'APPROVE' ? 'อนุมัติแล้ว — ยอดสต็อกอัปเดต' : 'ปฏิเสธคำขอแล้ว');
      setRejecting(null); setReason('');
      load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  };

  const pending = items.filter(a => (a.status || 'PENDING') === 'PENDING');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mobile" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-95"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="font-bold text-base leading-tight flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4 text-rose-500" /> อนุมัติปรับยอด</h1>
            <p className="text-[11px] text-slate-500">ตรวจ & อนุมัติคำขอปรับสต็อก (Checker)</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-slate-100 text-slate-500 active:scale-95"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>

      <main className="p-4 space-y-3">
        {loading ? (
          <p className="text-center text-slate-400 text-sm py-10">กำลังโหลด...</p>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardCheck className="w-12 h-12 text-emerald-400 mb-2" />
            <p className="text-slate-500 text-sm">ไม่มีคำขอรออนุมัติ</p>
          </div>
        ) : pending.map((a, i) => {
          const rid = a.requestId || a.id || String(i);
          const diff = a.diffQty ?? ((a.countedQty ?? 0) - (a.systemQty ?? 0));
          return (
            <div key={rid} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{a.sku}</p>
                  <p className="text-xs text-slate-500 font-mono flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location || '-'}</p>
                </div>
                <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${diff < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {diff > 0 ? '+' : ''}{diff}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-mono">
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-500">ระบบ {a.systemQty ?? '-'}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-bold">นับได้ {a.countedQty ?? '-'}</span>
              </div>
              {(a.reason || a.notes) && <p className="text-xs text-slate-500">เหตุผล: {a.reason || a.notes}</p>}
              <p className="text-[11px] text-slate-400">ขอโดย: {a.requestedBy || '-'}</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setRejecting(a)} disabled={busyId === rid}
                  className="flex-1 py-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50">
                  <X className="w-4 h-4" /> ปฏิเสธ
                </button>
                <button onClick={() => decide(a, 'APPROVE')} disabled={busyId === rid}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50">
                  <Check className="w-4 h-4" /> {busyId === rid ? 'กำลัง...' : 'อนุมัติ'}
                </button>
              </div>
            </div>
          );
        })}
      </main>

      {/* Reject reason sheet */}
      {rejecting && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center" onClick={() => setRejecting(null)}>
          <div className="w-full bg-white rounded-t-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-slate-900">เหตุผลที่ปฏิเสธ</h2>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus
              placeholder="ระบุเหตุผล..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-400" />
            <div className="flex gap-2">
              <button onClick={() => setRejecting(null)} className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm">ยกเลิก</button>
              <button onClick={() => decide(rejecting, 'REJECT', reason)} disabled={!reason.trim() || busyId != null}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold text-sm active:scale-95 disabled:opacity-50">ยืนยันปฏิเสธ</button>
            </div>
          </div>
        </div>
      )}
      <MobileNav />
    </div>
  );
}
