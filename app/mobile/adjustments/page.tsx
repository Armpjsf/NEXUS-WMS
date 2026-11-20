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
    <div className="min-h-screen text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mobile" className="min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/90 border border-slate-200 text-slate-700 active:scale-95 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-base leading-tight flex items-center gap-1.5 text-slate-900">
              <ClipboardCheck className="w-4 h-4 text-rose-600" /> อนุมัติปรับยอด
            </h1>
            <p className="text-[11px] text-slate-500">ตรวจ & อนุมัติคำขอปรับสต็อก (Checker)</p>
          </div>
        </div>
        <button onClick={load} className="min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/90 border border-slate-200 text-slate-600 active:scale-95 flex items-center justify-center">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center text-slate-500 text-sm py-10">กำลังโหลด...</p>
        ) : pending.length === 0 ? (
          <div className="nx-glass-card flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center mb-3">
              <ClipboardCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-slate-700 font-bold text-sm">ไม่มีคำขอรออนุมัติ</p>
          </div>
        ) : pending.map((a, i) => {
          const rid = a.requestId || a.id || String(i);
          const diff = a.diffQty ?? ((a.countedQty ?? 0) - (a.systemQty ?? 0));
          return (
            <div key={rid} className="nx-glass-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{a.sku}</p>
                  <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />{a.location || '-'}
                  </p>
                </div>
                <span className={`text-sm font-black px-3 py-0.5 rounded-full border tabular-nums ${
                  diff < 0
                    ? 'bg-rose-500/12 text-rose-700 border-rose-500/25'
                    : 'bg-emerald-500/12 text-emerald-700 border-emerald-500/25'
                }`}>
                  {diff > 0 ? '+' : ''}{diff}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">ระบบ {a.systemQty ?? '-'}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className="px-2.5 py-1 rounded-full bg-sky-500/12 text-sky-700 border border-sky-500/20 font-bold">นับได้ {a.countedQty ?? '-'}</span>
              </div>
              {(a.reason || a.notes) && <p className="text-xs text-slate-600">เหตุผล: {a.reason || a.notes}</p>}
              <p className="text-[11px] text-slate-500">ขอโดย: {a.requestedBy || '-'}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setRejecting(a)}
                  disabled={busyId === rid}
                  className="flex-1 min-h-[44px] py-3 rounded-full bg-rose-500/12 text-rose-700 border border-rose-500/25 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> ปฏิเสธ
                </button>
                <button
                  onClick={() => decide(a, 'APPROVE')}
                  disabled={busyId === rid}
                  className="flex-1 min-h-[44px] py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  <Check className="w-4 h-4" /> {busyId === rid ? 'กำลัง...' : 'อนุมัติ'}
                </button>
              </div>
            </div>
          );
        })}
      </main>

      {/* Reject reason sheet */}
      {rejecting && (
        <div className="fixed inset-0 z-[90] bg-slate-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center overflow-y-auto p-0 sm:p-4" onClick={() => setRejecting(null)}>
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-white/90 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-28 sm:pb-5 space-y-3 max-h-[85dvh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-slate-900">เหตุผลที่ปฏิเสธ</h2>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              onFocus={e => setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)}
              rows={3}
              autoFocus
              placeholder="ระบุเหตุผล..."
              className="w-full p-3.5 bg-white/90 border border-slate-200 rounded-2xl text-sm text-slate-900 outline-none focus:border-rose-500 placeholder:text-slate-400"
            />
            <div className="flex gap-2">
              <button onClick={() => setRejecting(null)} className="min-h-[44px] px-5 py-3 rounded-full bg-slate-100 text-slate-700 font-bold text-sm">ยกเลิก</button>
              <button
                onClick={() => decide(rejecting, 'REJECT', reason)}
                disabled={!reason.trim() || busyId != null}
                className="flex-1 min-h-[44px] py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm active:scale-95 disabled:opacity-50"
              >
                ยืนยันปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}
      <MobileNav />
    </div>
  );
}
