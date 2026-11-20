'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Minus, Trash2, ScanLine, PackagePlus, Search, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';
import CameraScannerModal from '@/components/CameraScannerModal';
import { errorMessage } from '@/lib/errors';

// product API (mapProductRow) เก็บ SKU ไว้ใน field `id` ไม่ใช่ `sku`
interface Prod { id: string; name: string; price?: number; location?: string; barcode?: string; stock?: number; }
interface Line { sku: string; name: string; qty: number; price: number; location: string; drop: number; custom?: boolean; }
export interface AddItemsOrder {
  id: string;
  orderNo: string;
  status?: string;
  tmsJobId?: string;
  destinations?: { drop: number; name?: string }[];
}

interface Props {
  order: AddItemsOrder | null;
  onClose: () => void;
  onDone: () => void;
}

// QR ของระบบ encode เป็น JSON — แปลงเป็น code (จับคู่) + label (ชื่ออ่านง่าย) กัน JSON ดิบเป็นชื่อสินค้า
function normalizeScan(raw: string): { code: string; label: string } {
  const t = (raw || '').trim();
  if (t.startsWith('{') && t.endsWith('}')) {
    try {
      const o = JSON.parse(t);
      const label = o.name || o.productName || o.sku || o.code || o.loc || t;
      const code = o.sku || o.code || o.barcode || o.name || o.loc || t;
      return { code: String(code), label: String(label) };
    } catch { /* not JSON */ }
  }
  return { code: t, label: t };
}

export default function AddItemsModal({ order, onClose, onDone }: Props) {
  const [products, setProducts] = useState<Prod[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [crossDock, setCrossDock] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const [targetDrop, setTargetDrop] = useState(1);

  const drops = useMemo(() => {
    const ds = (order?.destinations || []).map(d => d.drop).filter(Boolean);
    return ds.length ? Array.from(new Set(ds)).sort((a, b) => a - b) : [1];
  }, [order]);
  const dropName = (d: number) => (order?.destinations || []).find(x => x.drop === d)?.name || '';

  useEffect(() => {
    if (!order) return;
    setLines([]); setQuery('');
    const ds = (order.destinations || []).map(d => d.drop).filter(Boolean);
    setTargetDrop(ds.length ? Math.min(...ds) : 1);
    fetch(getApiUrl('/api/products'), { cache: 'no-store' })
      .then(r => r.json())
      .then((rows) => setProducts(Array.isArray(rows) ? rows : []))
      .catch(() => setProducts([]));
    setTimeout(() => scanRef.current?.focus(), 100);
  }, [order]);

  if (!order) return null;

  const addLine = (p: Prod) => {
    if (!p.id) return;
    setLines(prev => {
      const i = prev.findIndex(l => l.sku === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { sku: p.id, name: p.name, qty: 1, price: Number(p.price || 0), location: p.location || '', drop: targetDrop }];
    });
  };

  const addCustom = (raw: string) => {
    const { code, label } = normalizeScan(raw);
    const t = (label || code).trim();
    if (!t) return;
    setLines(prev => {
      const i = prev.findIndex(l => l.custom && l.name.toLowerCase() === t.toLowerCase());
      if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next; }
      return [...prev, { sku: code || t, name: t, qty: 1, price: 0, location: '', drop: targetDrop, custom: true }];
    });
    setQuery('');
  };
  const renameLine = (idx: number, name: string) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, name } : l));

  const handleScan = (raw: string) => {
    const { code, label } = normalizeScan(raw);
    const q = code.trim().toLowerCase();
    if (!q) return;
    if (crossDock) { addCustom(raw); return; }
    const hit = products.find(p => p.id?.toLowerCase() === q || p.barcode?.toLowerCase() === q)
      || products.find(p => (p.barcode && p.barcode.toLowerCase().includes(q)) || p.id?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q))
      || products.find(p => (p.id && q.includes(p.id.toLowerCase())) || (p.barcode && q.includes(p.barcode.toLowerCase())));
    if (hit) { addLine(hit); setQuery(''); }
    else { setQuery(label || code); toast.error(`ไม่พบ "${label || code}" ในคลัง — ถ้าเป็นของลูกค้า (cross-dock) กด "เพิ่มเป็นของนอกคลัง"`); }
  };

  const searchResults = query.trim()
    ? products.filter(p =>
        p.name?.toLowerCase().includes(query.toLowerCase()) ||
        p.id?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  const setQty = (sku: string, qty: number) =>
    setLines(prev => prev.map(l => l.sku === sku ? { ...l, qty: Math.max(1, qty) } : l));
  const setDrop = (sku: string, drop: number) =>
    setLines(prev => prev.map(l => l.sku === sku ? { ...l, drop } : l));
  const removeLine = (sku: string) => setLines(prev => prev.filter(l => l.sku !== sku));

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
        ? (data.tms?.ok ? ' + ส่งเข้า TMS แล้ว' : (data.tms?.skipped ? '' : ' (แต่ส่งเข้า TMS ไม่สำเร็จ ลองซิงก์ใหม่)'))
        : '';
      toast.success(`เพิ่ม ${lines.length} รายการเข้าออเดอร์แล้ว${tmsMsg}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e) || 'เพิ่มของไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-white/90 rounded-[24px] shadow-2xl text-slate-900 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200"><PackagePlus className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">เพิ่มสินค้าเข้าออเดอร์</h2>
              <p className="font-mono text-[11px] text-slate-500">{order.orderNo}{order.tmsJobId ? ` · TMS ${order.tmsJobId}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Scan / search */}
        <div className="p-4 space-y-2 border-b border-slate-100">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="w-4 h-4 absolute left-3 top-3 text-emerald-600" />
              <input
                ref={scanRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(query); } }}
                placeholder="สแกนบาร์โค้ด / พิมพ์ SKU หรือชื่อสินค้า แล้วกด Enter"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500"
              />
            </div>
            <button type="button" onClick={() => setCamOpen(true)}
              className="shrink-0 px-3 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 active:scale-95 transition-all" aria-label="เปิดกล้องสแกน">
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* โหมดของนอกคลัง (cross-dock) */}
          <label className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <span className="text-[11px] font-semibold text-slate-700">🔀 ของนอกคลัง (Cross-dock) — พิมพ์/สแกนเพิ่มได้เลย ไม่ตัดสต็อก</span>
            <input type="checkbox" checked={crossDock} onChange={(e) => setCrossDock(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
          </label>

          {/* เลือกดรอปที่จะเพิ่มของเข้า */}
          {drops.length > 1 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500">เพิ่มเข้าดรอป:</span>
              {drops.map(d => (
                <button key={d} type="button" onClick={() => setTargetDrop(d)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${targetDrop === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}>
                  ดรอป {d}{dropName(d) ? ` · ${dropName(d)}` : ''}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">เพิ่มเข้า: ดรอป 1{dropName(1) ? ` · ${dropName(1)}` : ''}</p>
          )}

          {!crossDock && searchResults.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-44 overflow-y-auto shadow-sm">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => { addLine(p); setQuery(''); scanRef.current?.focus(); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-900 truncate">{p.name}</span>
                    <span className="block font-mono text-[10px] text-slate-500">{p.id} · คงเหลือ {p.stock ?? 0}</span>
                  </span>
                  <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {query.trim() && (crossDock || searchResults.length === 0) && (
            <button type="button" onClick={() => { addCustom(query); scanRef.current?.focus(); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-left hover:bg-amber-100/70 transition-colors">
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-amber-800 truncate">เพิ่ม “{query.trim()}” เป็นของนอกคลัง</span>
                <span className="block text-[10px] text-amber-700">Cross-dock · ไม่ตัดสต็อก (แก้ชื่อได้ทีหลัง)</span>
              </span>
              <Plus className="w-4 h-4 text-amber-600 shrink-0" />
            </button>
          )}
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-[11px] text-slate-400">สแกนหรือค้นหาสินค้าเพื่อเพิ่มเข้าออเดอร์</p>
            </div>
          ) : lines.map((l, idx) => (
            <div key={l.sku} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              <div className="min-w-0 flex-1">
                {l.custom ? (
                  <input value={l.name} onChange={(e) => renameLine(idx, e.target.value)} placeholder="ชื่อสินค้า (นอกคลัง)"
                    className="w-full text-xs text-slate-900 bg-white border border-amber-300 rounded-lg px-2 py-1 outline-none focus:border-emerald-500" />
                ) : (
                  <p className="text-xs font-semibold text-slate-900 truncate">{l.name}</p>
                )}
                <p className="font-mono text-[10px] text-slate-500">{l.custom ? '🔀 ของนอกคลัง' : l.sku}</p>
              </div>
              {drops.length > 1 && (
                <select
                  value={l.drop}
                  onChange={(e) => setDrop(l.sku, Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg text-[11px] text-slate-900 px-1.5 py-1 outline-none focus:border-emerald-500"
                >
                  {drops.map(d => <option key={d} value={d}>ดรอป {d}</option>)}
                </select>
              )}
              <div className="flex items-center gap-1">
                <button onClick={() => setQty(l.sku, l.qty - 1)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:text-emerald-600"><Minus className="w-3.5 h-3.5" /></button>
                <input
                  type="number" value={l.qty} min={1}
                  onChange={(e) => setQty(l.sku, parseInt(e.target.value) || 1)}
                  className="w-12 text-center bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 py-1 outline-none focus:border-emerald-500"
                />
                <button onClick={() => setQty(l.sku, l.qty + 1)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:text-emerald-600"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <button onClick={() => removeLine(l.sku)} className="text-slate-400 hover:text-rose-600 ml-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            {lines.length > 0 ? `${lines.length} รายการ · รวม ${lines.reduce((s, l) => s + l.qty, 0)} ชิ้น` : 'ยังไม่มีรายการ'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors">ยกเลิก</button>
            <button
              onClick={submit}
              disabled={saving || lines.length === 0}
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <PackagePlus className="w-4 h-4" />
              {saving ? 'กำลังบันทึก...' : 'เพิ่มเข้าออเดอร์'}
            </button>
          </div>
        </div>
      </div>

      {/* กล้องสแกนบาร์โค้ด — เพิ่มเข้ารายการทันทีต่อการยิง */}
      <CameraScannerModal
        isOpen={camOpen}
        onClose={() => setCamOpen(false)}
        onScan={(code) => handleScan(code)}
        title="สแกนบาร์โค้ดเพิ่มสินค้า"
        description="ส่องกล้องไปที่บาร์โค้ด/QR บนสินค้า — เพิ่มเข้ารายการทันที สแกนต่อได้เลย"
      />
    </div>
  );
}
