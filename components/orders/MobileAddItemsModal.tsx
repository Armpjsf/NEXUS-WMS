'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Minus, Trash2, ScanLine, PackagePlus, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';

interface Prod { id: string; name: string; price?: number; location?: string; barcode?: string; stock?: number; }
interface Line { sku: string; name: string; qty: number; price: number; location: string; drop: number; }
export interface MobileAddItemsOrder {
  id: string;
  orderNo: string;
  status?: string;
  tmsJobId?: string;
  destinations?: { drop: number; name?: string }[];
}

interface Props {
  order: MobileAddItemsOrder | null;
  onClose: () => void;
  onDone: () => void;
}

// เวอร์ชันมือถือ (ธีมสว่าง, ปุ่มใหญ่, สแกนก่อน) — ใช้ /api/orders/add-items เดียวกับเดสก์ท็อป
export default function MobileAddItemsModal({ order, onClose, onDone }: Props) {
  const [products, setProducts] = useState<Prod[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const drops = useMemo(() => {
    const ds = (order?.destinations || []).map(d => d.drop).filter(Boolean);
    return ds.length ? Array.from(new Set(ds)).sort((a, b) => a - b) : [1];
  }, [order]);

  useEffect(() => {
    if (!order) return;
    setLines([]); setQuery('');
    fetch(getApiUrl('/api/products'), { cache: 'no-store' })
      .then(r => r.json())
      .then((rows) => setProducts(Array.isArray(rows) ? rows : []))
      .catch(() => setProducts([]));
    setTimeout(() => scanRef.current?.focus(), 150);
  }, [order]);

  const addLine = (p: Prod) => {
    if (!p.id) return;
    setLines(prev => {
      const i = prev.findIndex(l => l.sku === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { sku: p.id, name: p.name, qty: 1, price: Number(p.price || 0), location: p.location || '', drop: drops[0] }];
    });
  };

  const matchAndAdd = (raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) return;
    const hit = products.find(p => p.id?.toLowerCase() === q || p.barcode?.toLowerCase() === q)
      || products.find(p => p.name?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q));
    if (hit) { addLine(hit); setQuery(''); }
    else toast.error(`ไม่พบสินค้า "${raw}"`);
  };

  // ยิงบาร์โค้ดจาก PDA (hardware) — เพิ่มของอัตโนมัติ
  usePdaScanner({ onScan: (code) => { if (order) matchAndAdd(code); }, enabled: !!order && !saving && !camOpen });

  const searchResults = query.trim()
    ? products.filter(p =>
        p.name?.toLowerCase().includes(query.toLowerCase()) ||
        p.id?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const setQty = (sku: string, qty: number) => setLines(prev => prev.map(l => l.sku === sku ? { ...l, qty: Math.max(1, qty) } : l));
  const setDrop = (sku: string, drop: number) => setLines(prev => prev.map(l => l.sku === sku ? { ...l, drop } : l));
  const removeLine = (sku: string) => setLines(prev => prev.filter(l => l.sku !== sku));

  if (!order) return null;

  const submit = async () => {
    if (lines.length === 0) { toast.error('ยังไม่ได้เลือกสินค้า'); return; }
    setSaving(true);
    try {
      const res = await fetch(getApiUrl('/api/orders/add-items'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, items: lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เพิ่มของไม่สำเร็จ');
      const tmsMsg = order.tmsJobId
        ? (data.tms?.ok ? ' + ส่งเข้า TMS แล้ว' : (data.tms?.skipped ? '' : ' (TMS ไม่สำเร็จ)'))
        : '';
      toast.success(`เพิ่ม ${lines.length} รายการแล้ว${tmsMsg}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'เพิ่มของไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const totalPieces = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-slate-50 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700"><PackagePlus className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">เพิ่มสินค้าเข้าออเดอร์</h2>
              <p className="font-mono text-[11px] text-slate-500">{order.orderNo}{order.tmsJobId ? ` · TMS ${order.tmsJobId}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-100 text-slate-500 active:scale-95"><X className="w-5 h-5" /></button>
        </div>

        {/* Scan / search */}
        <div className="p-4 space-y-2 bg-white border-b border-slate-200">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="w-5 h-5 absolute left-3 top-3.5 text-amber-500" />
              <input
                ref={scanRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); matchAndAdd(query); } }}
                inputMode="search"
                placeholder="สแกน / พิมพ์ SKU หรือชื่อสินค้า"
                className="w-full pl-10 pr-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setCamOpen(true)}
              className="shrink-0 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-center active:scale-95"
              aria-label="เปิดกล้องสแกน"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-52 overflow-y-auto shadow-sm">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => { addLine(p); setQuery(''); scanRef.current?.focus(); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-3 text-left active:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-900 truncate">{p.name}</span>
                    <span className="block font-mono text-[11px] text-slate-500">{p.id} · คงเหลือ {p.stock ?? 0}</span>
                  </span>
                  <Plus className="w-5 h-5 text-amber-600 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ScanLine className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">สแกนหรือค้นหาสินค้าเพื่อเพิ่ม</p>
            </div>
          ) : lines.map(l => (
            <div key={l.sku} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{l.name}</p>
                  <p className="font-mono text-[11px] text-slate-500 mt-0.5">{l.sku}</p>
                </div>
                <button onClick={() => removeLine(l.sku)} className="text-slate-400 active:text-rose-500 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center justify-between mt-2.5">
                {drops.length > 1 ? (
                  <select
                    value={l.drop}
                    onChange={(e) => setDrop(l.sku, Number(e.target.value))}
                    className="bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 px-2 py-2 outline-none focus:border-amber-500"
                  >
                    {drops.map(d => <option key={d} value={d}>ดรอป {d}</option>)}
                  </select>
                ) : <span className="text-[11px] text-slate-400">ดรอป 1</span>}
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(l.sku, l.qty - 1)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center active:scale-95"><Minus className="w-5 h-5" /></button>
                  <input
                    type="number" value={l.qty} min={1} inputMode="numeric"
                    onChange={(e) => setQty(l.sku, parseInt(e.target.value) || 1)}
                    className="w-14 h-10 text-center bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 outline-none focus:border-amber-500"
                  />
                  <button onClick={() => setQty(l.sku, l.qty + 1)} className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center active:scale-95"><Plus className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{lines.length} รายการ · รวม {totalPieces} ชิ้น</span>
          </div>
          <button
            onClick={submit}
            disabled={saving || lines.length === 0}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all"
          >
            <PackagePlus className="w-5 h-5" />
            {saving ? 'กำลังบันทึก...' : `เพิ่มเข้าออเดอร์ (${totalPieces})`}
          </button>
        </div>
      </div>

      {/* กล้องสแกนบาร์โค้ด — สแกนได้หลายชิ้นต่อเนื่อง (เพิ่มทันทีต่อการยิง) */}
      <CameraScannerModal
        isOpen={camOpen}
        onClose={() => setCamOpen(false)}
        onScan={(code) => matchAndAdd(code)}
        title="สแกนบาร์โค้ดเพิ่มสินค้า"
        description="ส่องกล้องไปที่บาร์โค้ด/QR บนสินค้า — เพิ่มเข้ารายการทันที สแกนต่อได้เลย"
      />
    </div>
  );
}
