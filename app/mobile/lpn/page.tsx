'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Boxes, MapPin, MoveRight, ScanLine, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface LPNItem { sku?: string; productName?: string; quantity?: number; }
interface LPN {
  lpnNumber: string;
  lpnType?: string;
  status?: string;
  locationCode?: string;
  items?: LPNItem[];
  notes?: string;
}

const TYPE_LABEL: Record<string, string> = { PALLET: 'พาเลท', MASTER_CARTON: 'กล่องแม่', TOTE: 'ลัง', CAGE: 'กรง' };

export default function MobileLpnPage() {
  const [lpns, setLpns] = useState<LPN[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<LPN | null>(null);
  const [newLoc, setNewLoc] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/lpn'), { cache: 'no-store' });
      const d = await res.json();
      setLpns(d.data || []);
    } catch { toast.error('โหลดพาเลทไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // สแกนเลข LPN เพื่อเปิดพาเลท / สแกนพิกัดเพื่อย้าย (เมื่อเปิดพาเลทอยู่)
  usePdaScanner({
    enabled: true,
    onScan: (code) => {
      const q = code.trim();
      if (active) { setNewLoc(q); return; }
      const hit = lpns.find(l => l.lpnNumber.toLowerCase() === q.toLowerCase());
      if (hit) { setActive(hit); setNewLoc(''); }
      else toast.error(`ไม่พบพาเลท "${q}"`);
    },
  });

  const move = async () => {
    if (!active || !newLoc.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(getApiUrl('/api/lpn/move'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lpnNumber: active.lpnNumber, newLocation: newLoc.trim(), operator: 'Mobile' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'ย้ายไม่สำเร็จ');
      toast.success(`ย้าย ${active.lpnNumber} → ${newLoc.trim()} แล้ว`);
      setActive(null); setNewLoc('');
      load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const list = lpns.filter(l => !search.trim() ||
    l.lpnNumber.toLowerCase().includes(search.toLowerCase()) ||
    (l.locationCode || '').toLowerCase().includes(search.toLowerCase()));

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
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 shrink-0">
                    <Boxes className="w-4 h-4" />
                  </span>
                  <span className="truncate">จัดการพาเลท (LPN)</span>
                </h1>
                <p className="text-[11px] text-slate-600 truncate">สแกนเลขพาเลทเพื่อดู/ย้ายพิกัด</p>
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
          <div className="relative mt-3">
            <ScanLine className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="สแกน / ค้นเลขพาเลท หรือพิกัด"
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-white/90 border border-slate-200/80 rounded-full text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 shadow-xs"
            />
          </div>
        </div>
      </header>

      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="nx-glass-card p-10 text-center text-slate-500 text-sm">กำลังโหลด...</div>
        ) : list.length === 0 ? (
          <div className="nx-glass-card flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
              <Boxes className="w-7 h-7" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">ไม่พบพาเลท</p>
          </div>
        ) : list.map(l => (
          <button
            key={l.lpnNumber}
            onClick={() => { setActive(l); setNewLoc(''); }}
            className="nx-glass-card w-full text-left p-4 min-h-[44px] active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono font-bold text-slate-900 text-base tabular-nums">{l.lpnNumber}</span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {TYPE_LABEL[l.lpnType || ''] || l.lpnType || 'พาเลท'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-mono tabular-nums">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                {l.locationCode || 'ไม่ระบุ'}
              </span>
              <span className="flex items-center gap-1.5 font-medium tabular-nums">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                {l.items?.length || 0} รายการ
              </span>
            </div>
          </button>
        ))}
      </main>

      {/* LPN detail / move sheet */}
      {active && (
        <div className="fixed inset-0 z-[90] bg-slate-900/45 backdrop-blur-xs flex items-end sm:items-center justify-center overflow-y-auto p-0 sm:p-4" onClick={() => setActive(null)}>
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-white/90 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-28 sm:pb-5 space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain text-slate-900" onClick={e => e.stopPropagation()}>
            <div className="nx-dark-accent-card p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold block">Active LPN</span>
                <span className="font-mono font-bold text-white text-lg tabular-nums">{active.lpnNumber}</span>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/10 border border-white/15 text-amber-300 flex items-center gap-1.5 tabular-nums">
                <MapPin className="w-3.5 h-3.5" />{active.locationCode || '-'}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-3.5 space-y-1.5 max-h-40 overflow-y-auto">
              {(active.items || []).length === 0 ? <p className="text-xs text-slate-500">พาเลทว่าง</p> :
                active.items!.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-700 gap-2">
                    <span className="truncate font-medium">• {it.productName || it.sku}</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">x{it.quantity}</span>
                  </div>
                ))}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block">ย้ายไปพิกัดใหม่</label>
              <div className="relative mt-1.5">
                <ScanLine className="w-5 h-5 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={newLoc}
                  onChange={e => setNewLoc(e.target.value)}
                  onFocus={e => setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)}
                  autoFocus
                  placeholder="สแกน / กรอกพิกัดปลายทาง"
                  className="w-full min-h-[48px] pl-11 pr-4 py-3 bg-white/90 border-2 border-slate-200 rounded-2xl text-base font-bold font-mono text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setActive(null)}
                className="min-h-[44px] px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm active:scale-95 transition-all"
              >
                ปิด
              </button>
              <button
                onClick={move}
                disabled={busy || !newLoc.trim()}
                className="flex-1 min-h-[44px] py-3 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                <MoveRight className="w-5 h-5" /> {busy ? 'กำลังย้าย...' : 'ยืนยันย้ายพาเลท'}
              </button>
            </div>
          </div>
        </div>
      )}
      <MobileNav />
    </div>
  );
}
