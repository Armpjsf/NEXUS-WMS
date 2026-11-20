'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Boxes, Layers, Hammer, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface Component { componentSku?: string; componentName?: string; quantity?: number; unit?: string; }
interface BOM {
  id: string;
  kitSku: string;
  kitName: string;
  version?: string;
  status?: string;
  components?: Component[];
}

export default function MobileKittingPage() {
  const [boms, setBoms] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BOM | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/kitting'), { cache: 'no-store' });
      const d = await res.json();
      setBoms(d.boms || []);
    } catch { toast.error('โหลดสูตรชุดสินค้าไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const assemble = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch(getApiUrl('/api/kitting/build'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bomId: active.id, quantity: qty, action: 'ASSEMBLE' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'ประกอบไม่สำเร็จ');
      toast.success(`ประกอบ ${active.kitName} จำนวน ${qty} ชุดแล้ว`);
      setActive(null);
      load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const list = boms.filter(b => !search.trim() ||
    b.kitName.toLowerCase().includes(search.toLowerCase()) ||
    b.kitSku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/mobile" className="min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/90 border border-slate-200 text-slate-700 active:scale-95 flex items-center justify-center">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-bold text-base leading-tight flex items-center gap-1.5 text-slate-900">
                  <Layers className="w-4 h-4 text-emerald-600" /> รวมชุดสินค้า (Kitting)
                </h1>
                <p className="text-[11px] text-slate-500">ประกอบชุดสินค้าตามสูตร (BOM)</p>
              </div>
            </div>
            <button onClick={load} className="min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/90 border border-slate-200 text-slate-600 active:scale-95 flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="relative mt-3">
            <ScanLine className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชุดสินค้า / SKU"
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 bg-white/90 border border-slate-200 rounded-2xl text-sm text-slate-900 outline-none focus:border-emerald-500 placeholder:text-slate-400" />
          </div>
        </div>
      </header>

      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center text-slate-500 text-sm py-10">กำลังโหลด...</p>
        ) : list.length === 0 ? (
          <div className="nx-glass-card flex flex-col items-center justify-center py-14 text-center px-6">
            <Layers className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-slate-600 font-semibold text-sm">ยังไม่มีสูตรชุดสินค้า</p>
          </div>
        ) : list.map(b => (
          <button key={b.id} onClick={() => { setActive(b); setQty(1); }} className="w-full text-left nx-glass-card p-4 active:scale-[0.99] hover:bg-white/95 transition-all">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-bold text-slate-900 truncate">{b.kitName}</span>
              {b.version && <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 tabular-nums">v{b.version}</span>}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-emerald-700 font-semibold">{b.kitSku}</span>
              <span className="flex items-center gap-1 text-slate-600 font-medium tabular-nums"><Boxes className="w-3.5 h-3.5 text-slate-400" />{b.components?.length || 0} ชิ้นส่วน</span>
            </div>
          </button>
        ))}
      </main>

      {/* Assemble sheet */}
      {active && (
        <div className="fixed inset-0 z-[90] bg-slate-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center overflow-y-auto p-0 sm:p-4" onClick={() => setActive(null)}>
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-white/90 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-28 sm:pb-5 space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
            <div className="nx-dark-accent-card p-4">
              <h2 className="font-bold text-white text-base">{active.kitName}</h2>
              <p className="font-mono text-xs text-emerald-300 mt-0.5">{active.kitSku}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600 mb-1.5">ชิ้นส่วนต่อ 1 ชุด</p>
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 space-y-1.5 max-h-44 overflow-y-auto">
                {(active.components || []).map((c, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-slate-700 truncate font-medium">{c.componentName || c.componentSku}</span>
                    <span className="font-mono text-slate-600 tabular-nums font-semibold">x{c.quantity} {c.unit || ''}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">จำนวนชุดที่ประกอบ</label>
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 text-xl font-bold active:scale-95">−</button>
                <input
                  type="number"
                  value={qty}
                  min={1}
                  inputMode="numeric"
                  onFocus={e => setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)}
                  onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 h-12 text-center bg-white border border-slate-200 rounded-2xl text-lg font-black text-slate-900 tabular-nums outline-none focus:border-emerald-500"
                />
                <button onClick={() => setQty(q => q + 1)} className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 text-xl font-bold active:scale-95">+</button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">* ระบบจะตัดชิ้นส่วนตามสูตร × {qty} และเพิ่มสต็อกชุดสินค้า</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setActive(null)} className="min-h-[48px] px-5 py-3.5 rounded-full bg-slate-100 text-slate-700 font-bold text-sm">ยกเลิก</button>
              <button onClick={assemble} disabled={busy} className="flex-1 min-h-[48px] py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-emerald-600/25">
                <Hammer className="w-5 h-5" /> {busy ? 'กำลังประกอบ...' : `ประกอบ ${qty} ชุด`}
              </button>
            </div>
          </div>
        </div>
      )}
      <MobileNav />
    </div>
  );
}
