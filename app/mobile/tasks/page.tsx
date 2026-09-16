'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, MapPin, ArrowRight, CheckCircle2, Zap, Boxes, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';

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
  PICKING: { label: 'หยิบสินค้า', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  PUTAWAY: { label: 'จัดเก็บ', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  REPLENISHMENT: { label: 'เติมจุดหยิบ', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  CYCLE_COUNT: { label: 'ตรวจนับ', cls: 'bg-violet-100 text-violet-700 border-violet-200' },
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
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const replenish = async () => {
    setBusy(true);
    try {
      const res = await fetch(getApiUrl('/api/tasks/replenish'), { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'ไม่สำเร็จ');
      toast.success('สร้างงานเติมจุดหยิบแล้ว');
      load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const filtered = tasks.filter(t => filter === 'ALL' || t.task_type === filter);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/mobile" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-95"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="font-bold text-base leading-tight flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> คิวงานอัจฉริยะ</h1>
              <p className="text-[11px] text-slate-500">รับงานหยิบ/จัดเก็บ/เติมสต็อกตามลำดับความสำคัญ</p>
            </div>
          </div>
          <button onClick={load} className="p-2 rounded-lg bg-slate-100 text-slate-500 active:scale-95"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${filter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 space-y-3">
        {loading ? (
          <p className="text-center text-slate-400 text-sm py-10">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
            <p className="text-slate-500 text-sm">ไม่มีงานค้างในคิว</p>
            <button onClick={replenish} disabled={busy} className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold active:scale-95 disabled:opacity-50">สร้างงานเติมจุดหยิบอัตโนมัติ</button>
          </div>
        ) : filtered.map(t => {
          const meta = TYPE_META[t.task_type] || { label: t.task_type, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
          return (
            <button key={t.id} onClick={() => openTask(t)} className="w-full text-left p-4 rounded-2xl bg-white border border-slate-200 shadow-sm active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                {t.priority <= 2 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200">ด่วน</span>}
              </div>
              <p className="font-semibold text-sm text-slate-900 truncate">{t.product_name || t.sku}</p>
              <p className="font-mono text-[11px] text-slate-500">{t.sku}</p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-600 font-mono">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />{t.source_location || '-'}
                  <ArrowRight className="w-3 h-3 text-slate-400" />{t.target_location || '-'}
                </span>
                <span className="font-bold text-blue-600">{t.requested_qty} ชิ้น</span>
              </div>
            </button>
          );
        })}
      </main>

      {/* Task detail / complete sheet */}
      {active && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center" onClick={() => setActive(null)}>
          <div className="w-full bg-white rounded-t-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-slate-900">{(TYPE_META[active.task_type]?.label) || active.task_type}</h2>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-1">
              <p className="font-semibold text-slate-900">{active.product_name || active.sku}</p>
              <p className="font-mono text-xs text-slate-500">{active.sku}</p>
              <p className="text-sm text-slate-600 font-mono mt-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />{active.source_location || '-'} <ArrowRight className="w-3.5 h-3.5" /> {active.target_location || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">จำนวนที่ทำจริง</label>
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={() => setQty(q => Math.max(0, q - 1))} className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 text-xl active:scale-95">−</button>
                <input type="number" value={qty} min={0} inputMode="numeric" onChange={e => setQty(parseInt(e.target.value) || 0)}
                  className="flex-1 h-12 text-center bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold outline-none focus:border-amber-500" />
                <button onClick={() => setQty(q => q + 1)} className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 text-xl active:scale-95">+</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setActive(null)} className="px-4 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm">ยกเลิก</button>
              <button onClick={complete} disabled={busy} className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
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
