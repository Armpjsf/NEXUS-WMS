'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, MapPin, ArrowRight, CheckCircle2, Zap, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface Task {
  id: string;
  task_type: 'PICKING' | 'PUTAWAY' | 'CYCLE_COUNT' | 'REPLENISHMENT' | string;
  priority: number;
  product_name?: string;
  sku?: string;
  requested_qty?: number;
  source_location?: string;
  target_location?: string;
  status?: string;
}

const TYPE_META: Record<string, { label: string; cls: string }> = {
  PICKING: { label: 'หยิบสินค้า', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  PUTAWAY: { label: 'จัดเก็บ', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REPLENISHMENT: { label: 'เติมจุดหยิบ', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  CYCLE_COUNT: { label: 'ตรวจนับ', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const FILTERS = [
  { id: 'ALL', label: 'ทั้งหมด' },
  { id: 'PICKING', label: 'หยิบ' },
  { id: 'PUTAWAY', label: 'จัดเก็บ' },
  { id: 'REPLENISHMENT', label: 'เติม' },
];

export default function MobileTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [active, setActive] = useState<Task | null>(null);
  const [qty, setQty] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/tasks?status=PENDING'), { cache: 'no-store' });
      const data = await res.json();
      setTasks(data.data || []);
    } catch { toast.error('โหลดคิวงานไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openTask = (t: Task) => { setActive(t); setQty(Number(t.requested_qty || 0)); };

  usePdaScanner({
    enabled: !active,
    onScan: (code) => {
      const q = code.trim().toLowerCase();
      const hit = tasks.find(t => t.sku?.toLowerCase() === q || t.source_location?.toLowerCase() === q || t.target_location?.toLowerCase() === q);
      if (hit) { toast.success(`พบงาน ${hit.sku}`); openTask(hit); }
      else toast.error(`ไม่พบงานสำหรับ "${code}"`);
    },
  });

  const complete = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch(getApiUrl('/api/tasks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'COMPLETE', taskId: active.id, completedQty: qty }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'ไม่สำเร็จ');
      toast.success('✅ ทำงานเสร็จแล้ว');
      setActive(null);
      load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const replenish = async () => {
    setBusy(true);
    try {
      const res = await fetch(getApiUrl('/api/tasks/replenish'), { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'ไม่สำเร็จ');
      toast.success('สร้างงานเติมจุดหยิบแล้ว');
      load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const filtered = tasks.filter(t => filter === 'ALL' || t.task_type === filter);

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
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-700 shrink-0">
                    <Zap className="w-4 h-4" />
                  </span>
                  <span className="truncate">คิวงานอัจฉริยะ</span>
                </h1>
                <p className="text-[11px] text-slate-600 truncate">รับงานหยิบ/จัดเก็บ/เติมสต็อกตามลำดับความสำคัญ</p>
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
          <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                  filter === f.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white/90 text-slate-600 border-slate-200/80 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="nx-glass-card p-10 text-center text-slate-500 text-sm">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="nx-glass-card flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3 text-emerald-600">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">ไม่มีงานค้างในคิว</p>
            <button
              onClick={replenish}
              disabled={busy}
              className="mt-4 min-h-[44px] px-5 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold active:scale-95 disabled:opacity-50 transition-all shadow-sm"
            >
              สร้างงานเติมจุดหยิบอัตโนมัติ
            </button>
          </div>
        ) : filtered.map(t => {
          const meta = TYPE_META[t.task_type] || { label: t.task_type, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
          return (
            <button
              key={t.id}
              onClick={() => openTask(t)}
              className="nx-glass-card w-full text-left p-4 min-h-[44px] active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                {t.priority <= 2 && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">ด่วน</span>
                )}
              </div>
              <p className="font-semibold text-sm text-slate-900 truncate">{t.product_name || t.sku}</p>
              <p className="font-mono text-[11px] text-slate-500">{t.sku}</p>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-600 font-mono tabular-nums">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />{t.source_location || '-'}
                  <ArrowRight className="w-3 h-3 text-slate-400" />{t.target_location || '-'}
                </span>
                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full tabular-nums">
                  {t.requested_qty} ชิ้น
                </span>
              </div>
            </button>
          );
        })}
      </main>

      {/* Task detail / complete sheet */}
      {active && (
        <div className="fixed inset-0 z-[90] bg-slate-900/45 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4" onClick={() => setActive(null)}>
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-white/90 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 text-slate-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 border border-amber-200 text-amber-600">
                <ClipboardList className="w-5 h-5" />
              </span>
              <h2 className="font-bold text-slate-900 text-base">{(TYPE_META[active.task_type]?.label) || active.task_type}</h2>
            </div>
            <div className="nx-dark-accent-card p-4 space-y-1.5">
              <p className="font-semibold text-white text-base">{active.product_name || active.sku}</p>
              <p className="font-mono text-xs text-slate-300">{active.sku}</p>
              <p className="text-sm text-amber-300 font-mono mt-2 flex items-center gap-1.5 tabular-nums">
                <MapPin className="w-4 h-4 text-emerald-300" />{active.source_location || '-'} <ArrowRight className="w-3.5 h-3.5 text-slate-400" /> {active.target_location || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block">จำนวนที่ทำจริง</label>
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  onClick={() => setQty(q => Math.max(0, q - 1))}
                  className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xl font-bold active:scale-95 transition-all"
                >
                  −
                </button>
                <input
                  type="number"
                  value={qty}
                  min={0}
                  inputMode="numeric"
                  onChange={e => setQty(parseInt(e.target.value) || 0)}
                  className="flex-1 h-12 text-center bg-white/90 border border-slate-200 rounded-2xl text-lg font-bold font-mono text-slate-900 tabular-nums outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 text-xl font-bold active:scale-95 transition-all"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setActive(null)}
                className="min-h-[44px] px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm active:scale-95 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={complete}
                disabled={busy}
                className="flex-1 min-h-[44px] py-3 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                <CheckCircle2 className="w-5 h-5" /> {busy ? 'กำลังบันทึก...' : 'ทำงานเสร็จ'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileNav />
    </div>
  );
}
