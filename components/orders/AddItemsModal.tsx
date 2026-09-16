'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Minus, Trash2, ScanLine, PackagePlus, Search, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';
import CameraScannerModal from '@/components/CameraScannerModal';

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
    const t = raw.trim();
    if (!t) return;
    setLines(prev => {
      const i = prev.findIndex(l => l.custom && l.name.toLowerCase() === t.toLowerCase());
      if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next; }
      return [...prev, { sku: t, name: t, qty: 1, price: 0, location: '', drop: targetDrop, custom: true }];
    });
    setQuery('');
  };
  const renameLine = (idx: number, name: string) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, name } : l));

  const handleScan = (raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) return;
    if (crossDock) { addCustom(raw); return; }
    const hit = products.find(p => p.id?.toLowerCase() === q || p.barcode?.toLowerCase() === q)
      || products.find(p => (p.barcode && p.barcode.toLowerCase().includes(q)) || p.id?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q))
      || products.find(p => (p.id && q.includes(p.id.toLowerCase())) || (p.barcode && q.includes(p.barcode.toLowerCase())));
    if (hit) { addLine(hit); setQuery(''); }
    else { setQuery(raw.trim()); toast.error(`ไม่พบ "${raw}" ในคลัง — ถ้าเป็นของลูกค้า (cross-dock) กด "เพิ่มเป็นของนอกคลัง"`); }
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
    } catch (e: any) {
      toast.error(e.message || 'เพิ่มของไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#171c23] border border-[#30353d] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30353d]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#facc15]/15 text-[#facc15]"><PackagePlus className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold text-[#dee2ec] text-sm">เพิ่มสินค้าเข้าออเดอร์</h2>
              <p className="font-mono text-[11px] text-[#8a92a6]">{order.orderNo}{order.tmsJobId ? ` · TMS ${order.tmsJobId}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8a92a6] hover:text-[#dee2ec]"><X className="w-5 h-5" /></button>
        </div>

        {/* Scan / search */}
        <div className="p-4 space-y-2 border-b border-[#30353d]">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="w-4 h-4 absolute left-3 top-3 text-[#facc15]" />
              <input
                ref={scanRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(query); } }}
                placeholder="สแกนบาร์โค้ด / พิมพ์ SKU หรือชื่อสินค้า แล้วกด Enter"
                className="w-full pl-9 pr-3 py-2.5 bg-[#090f15] border border-[#30353d] rounded-lg text-sm text-[#dee2ec] placeholder:text-[#8a92a6]/60 outline-none focus:border-[#facc15]"
              />
            </div>
            <button type="button" onClick={() => setCamOpen(true)}
              className="shrink-0 px-3 rounded-lg bg-[#facc15] text-[#1b1600] flex items-center justify-center hover:bg-[#eec200] active:scale-95" aria-label="เปิดกล้องสแกน">
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* โหมดของนอกคลัง (cross-dock) */}
          <label className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#1b2027] border border-[#30353d] cursor-pointer">
            <span className="text-[11px] font-semibold text-[#d1c6ab]">🔀 ของนอกคลัง (Cross-dock) — พิมพ์/สแกนเพิ่มได้เลย ไม่ตัดสต็อก</span>
            <input type="checkbox" checked={crossDock} onChange={(e) => setCrossDock(e.target.checked)} className="w-4 h-4 accent-[#facc15]" />
          </label>

          {/* เลือกดรอปที่จะเพิ่มของเข้า */}
          {drops.length > 1 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-[#8a92a6]">เพิ่มเข้าดรอป:</span>
              {drops.map(d => (
                <button key={d} type="button" onClick={() => setTargetDrop(d)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${targetDrop === d ? 'bg-[#facc15] text-[#1b1600] border-[#facc15]' : 'bg-[#1b2027] text-[#d1c6ab] border-[#30353d]'}`}>
                  ดรอป {d}{dropName(d) ? ` · ${dropName(d)}` : ''}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[#8a92a6]">เพิ่มเข้า: ดรอป 1{dropName(1) ? ` · ${dropName(1)}` : ''}</p>
          )}

          {!crossDock && searchResults.length > 0 && (
            <div className="rounded-lg border border-[#30353d] bg-[#1b2027] divide-y divide-[#30353d] max-h-44 overflow-y-auto">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => { addLine(p); setQuery(''); scanRef.current?.focus(); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#252a32] transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-[#dee2ec] truncate">{p.name}</span>
                    <span className="block font-mono text-[10px] text-[#8a92a6]">{p.id} · คงเหลือ {p.stock ?? 0}</span>
                  </span>
                  <Plus className="w-4 h-4 text-[#facc15] shrink-0" />
                </button>
              ))}
            </div>
          )}

          {query.trim() && (crossDock || searchResults.length === 0) && (
            <button type="button" onClick={() => { addCustom(query); scanRef.current?.focus(); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed border-[#facc15]/50 bg-[#facc15]/10 text-left hover:bg-[#facc15]/15">
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-[#facc15] truncate">เพิ่ม “{query.trim()}” เป็นของนอกคลัง</span>
                <span className="block text-[10px] text-[#8a92a6]">Cross-dock · ไม่ตัดสต็อก (แก้ชื่อได้ทีหลัง)</span>
              </span>
              <Plus className="w-4 h-4 text-[#facc15] shrink-0" />
            </button>
          )}
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="w-8 h-8 text-[#30353d] mb-2" />
              <p className="text-[11px] text-[#8a92a6]">สแกนหรือค้นหาสินค้าเพื่อเพิ่มเข้าออเดอร์</p>
            </div>
          ) : lines.map((l, idx) => (
            <div key={l.sku} className="flex items-center gap-2 bg-[#1b2027] border border-[#30353d] rounded-lg p-2.5">
              <div className="min-w-0 flex-1">
                {l.custom ? (
                  <input value={l.name} onChange={(e) => renameLine(idx, e.target.value)} placeholder="ชื่อสินค้า (นอกคลัง)"
                    className="w-full text-xs text-[#dee2ec] bg-[#090f15] border border-[#facc15]/40 rounded px-2 py-1 outline-none focus:border-[#facc15]" />
                ) : (
                  <p className="text-xs text-[#dee2ec] truncate">{l.name}</p>
                )}
                <p className="font-mono text-[10px] text-[#8a92a6]">{l.custom ? '🔀 ของนอกคลัง' : l.sku}</p>
              </div>
              {drops.length > 1 && (
                <select
                  value={l.drop}
                  onChange={(e) => setDrop(l.sku, Number(e.target.value))}
                  className="bg-[#090f15] border border-[#30353d] rounded text-[11px] text-[#dee2ec] px-1.5 py-1 outline-none focus:border-[#facc15]"
                >
                  {drops.map(d => <option key={d} value={d}>ดรอป {d}</option>)}
                </select>
              )}
              <div className="flex items-center gap-1">
                <button onClick={() => setQty(l.sku, l.qty - 1)} className="w-7 h-7 rounded bg-[#252a32] text-[#d1c6ab] flex items-center justify-center hover:text-[#facc15]"><Minus className="w-3.5 h-3.5" /></button>
                <input
                  type="number" value={l.qty} min={1}
                  onChange={(e) => setQty(l.sku, parseInt(e.target.value) || 1)}
                  className="w-12 text-center bg-[#090f15] border border-[#30353d] rounded text-xs text-[#dee2ec] py-1 outline-none focus:border-[#facc15]"
                />
                <button onClick={() => setQty(l.sku, l.qty + 1)} className="w-7 h-7 rounded bg-[#252a32] text-[#d1c6ab] flex items-center justify-center hover:text-[#facc15]"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <button onClick={() => removeLine(l.sku)} className="text-[#8a92a6] hover:text-[#ffb4ab] ml-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#30353d] flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#8a92a6]">
            {lines.length > 0 ? `${lines.length} รายการ · รวม ${lines.reduce((s, l) => s + l.qty, 0)} ชิ้น` : 'ยังไม่มีรายการ'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold text-[#d1c6ab] hover:bg-[#252a32]">ยกเลิก</button>
            <button
              onClick={submit}
              disabled={saving || lines.length === 0}
              className="px-5 py-2 rounded-lg bg-[#facc15] text-[#1b1600] text-xs font-bold hover:bg-[#eec200] disabled:opacity-50 flex items-center gap-1.5"
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
