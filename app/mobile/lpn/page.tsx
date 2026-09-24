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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/mobile" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-95"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="font-bold text-base leading-tight flex items-center gap-1.5"><Boxes className="w-4 h-4 text-teal-500" /> จัดการพาเลท (LPN)</h1>
              <p className="text-[11px] text-slate-500">สแกนเลขพาเลทเพื่อดู/ย้ายพิกัด</p>
            </div>
          </div>
          <button onClick={load} className="p-2 rounded-lg bg-slate-100 text-slate-500 active:scale-95"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="relative mt-3">
          <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="สแกน / ค้นเลขพาเลท หรือพิกัด"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500" />
        </div>
      </header>

      <main className="p-4 space-y-3">
        {loading ? (
          <p className="text-center text-slate-400 text-sm py-10">กำลังโหลด...</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Boxes className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">ไม่พบพาเลท</p>
          </div>
        ) : list.map(l => (
          <button key={l.lpnNumber} onClick={() => { setActive(l); setNewLoc(''); }} className="w-full text-left p-4 rounded-2xl bg-white border border-slate-200 shadow-sm active:scale-[0.99]">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-mono font-bold text-slate-900">{l.lpnNumber}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">{TYPE_LABEL[l.lpnType || ''] || l.lpnType || 'พาเลท'}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-mono"><MapPin className="w-3.5 h-3.5 text-slate-400" />{l.locationCode || 'ไม่ระบุ'}</span>
              <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{l.items?.length || 0} รายการ</span>
            </div>
          </button>
        ))}
      </main>

      {/* LPN detail / move sheet */}
      {active && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center" onClick={() => setActive(null)}>
          <div className="w-full bg-white rounded-t-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-900 text-lg">{active.lpnNumber}</span>
              <span className="text-xs font-mono text-slate-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{active.locationCode || '-'}</span>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-1 max-h-40 overflow-y-auto">
              {(active.items || []).length === 0 ? <p className="text-xs text-slate-400">พาเลทว่าง</p> :
                active.items!.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-600"><span className="truncate">• {it.productName || it.sku}</span><span className="font-mono">x{it.quantity}</span></div>
                ))}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">ย้ายไปพิกัดใหม่</label>
              <div className="relative mt-1.5">
                <ScanLine className="w-5 h-5 text-teal-500 absolute left-3 top-3.5" />
                <input value={newLoc} onChange={e => setNewLoc(e.target.value)} autoFocus placeholder="สแกน / กรอกพิกัดปลายทาง"
                  className="w-full pl-10 pr-3 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-base font-bold text-slate-900 outline-none focus:border-teal-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setActive(null)} className="px-4 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm">ปิด</button>
              <button onClick={move} disabled={busy || !newLoc.trim()} className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
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
