'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PackageMinus, Search, Plus, Trash2, RefreshCw, Check, X, FileText } from 'lucide-react';
import MobileNav from '@/components/MobileNav';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface Product {
  name: string;
  category?: string;
  stock?: number;
  unit?: string;
  price?: number;
}

interface LineItem {
  sku: string;
  qty: string;
  salePrice: string;
  stock?: number;
  unit?: string;
}

export default function MobileOutboundPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [items, setItems] = useState<LineItem[]>([]);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');

  const [docRef, setDocRef] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/products'), { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch {
      toast.error('โหลดสินค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [products, search]);

  const openPicker = () => { setSelected(null); setQty(''); setPrice(''); setSearch(''); setPicker(true); };

  const addItem = () => {
    if (!selected) { toast.error('เลือกสินค้าก่อน'); return; }
    const n = Number(qty);
    if (!n || n <= 0) { toast.error('ใส่จำนวนให้ถูกต้อง'); return; }
    const already = items.filter(i => i.sku === selected.name).reduce((s, i) => s + Number(i.qty || 0), 0);
    if (typeof selected.stock === 'number' && already + n > selected.stock) {
      toast.error(`สต็อกไม่พอ (คงเหลือ ${selected.stock}${selected.unit ? ' ' + selected.unit : ''})`);
      return;
    }
    setItems(prev => [...prev, { sku: selected.name, qty: String(n), salePrice: price || '', stock: selected.stock, unit: selected.unit }]);
    setPicker(false);
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const payload = { items: items.map(i => ({ sku: i.sku, qty: i.qty, salePrice: i.salePrice, date, docRef })) };
      const res = await fetch(getApiUrl('/api/outbound'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 400 || res.status === 409) {
        const data = await res.json().catch(() => ({} as any));
        const detail = Array.isArray(data.shortages) ? `\n• ${data.shortages.join('\n• ')}` : '';
        toast.error((data.error || 'จ่ายออกไม่สำเร็จ') + detail, { duration: 6000 });
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      toast.success('บันทึกการเบิกจ่ายแล้ว');
      setItems([]);
      setDocRef('');
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);

  return (
    <div className="theme-nexus-hybrid min-h-screen text-slate-900 pb-28 font-sans select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
              <PackageMinus className="w-3.5 h-3.5" /> เบิกจ่ายตรง / ใช้ภายใน
            </div>
            <h1 className="text-xl font-black text-slate-900 mt-1 tabular-nums">
              {items.length} รายการ · {totalQty} ชิ้น
            </h1>
          </div>
          <button
            onClick={loadProducts}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-600 hover:text-slate-900 shadow-xs active:scale-95 transition-all shrink-0"
            aria-label="รีเฟรช"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Doc info */}
        <div className="nx-glass-card p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">เลขที่เอกสาร</label>
            <div className="mt-1.5 flex items-center gap-2 bg-white/90 border border-slate-200/80 rounded-2xl px-3 py-2.5 shadow-xs">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={docRef}
                onChange={e => setDocRef(e.target.value)}
                placeholder="ไม่บังคับ"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">วันที่</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="mt-1.5 w-full bg-white/90 border border-slate-200/80 rounded-2xl px-3 py-2.5 text-sm text-slate-900 shadow-xs outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Add item button */}
        <button
          onClick={openPicker}
          className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold rounded-full py-3.5 shadow-lg shadow-rose-600/20 transition-all"
        >
          <Plus className="w-5 h-5" /> เพิ่มสินค้าที่จะเบิกจ่าย
        </button>

        {/* Items list */}
        {items.length === 0 ? (
          <div className="nx-glass-card text-center py-12 px-6 text-slate-500">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-3 text-rose-500">
              <PackageMinus className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700">ยังไม่มีรายการ</p>
            <p className="text-xs text-slate-500 mt-1">กดปุ่มด้านบนเพื่อเพิ่มสินค้าที่ต้องเบิก</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((it, idx) => (
              <div key={idx} className="nx-glass-card p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold tabular-nums shrink-0">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate">{it.sku}</div>
                  <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
                    จำนวน <strong className="text-rose-700">{it.qty}</strong>{it.unit ? ` ${it.unit}` : ' ชิ้น'}
                    {it.salePrice ? ` · ราคา ${it.salePrice}` : ''}
                    {typeof it.stock === 'number' ? ` · คงเหลือ ${it.stock}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(idx)}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-90 transition-all shrink-0"
                  aria-label="ลบรายการ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit bar */}
      {items.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="max-w-lg mx-auto">
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 active:scale-[0.99] text-white font-black rounded-full py-3.5 shadow-xl shadow-rose-600/25 transition-all tabular-nums"
            >
              <Check className="w-5 h-5" />
              {submitting ? 'กำลังบันทึก...' : `ยืนยันเบิกจ่าย (${items.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Product picker sheet */}
      {picker && (
        <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-xs flex items-end sm:items-center justify-center overflow-y-auto p-0 sm:p-4" onClick={() => setPicker(false)}>
          <div className="bg-white/95 backdrop-blur-xl border border-white/90 w-full max-w-lg max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl text-slate-900" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">เลือกสินค้า</h3>
              <button onClick={() => setPicker(false)} className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200/80 rounded-full px-4 py-2.5">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={e => setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)}
                  placeholder="ค้นหาชื่อ/หมวดสินค้า"
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                />
              </div>
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {loading ? <div className="text-center text-slate-400 py-10 text-sm">กำลังโหลด...</div>
                : filtered.length === 0 ? <div className="text-center text-slate-400 py-10 text-sm">ไม่พบสินค้า</div>
                : filtered.map((p, i) => {
                  const isSel = selected?.name === p.name;
                  const out = typeof p.stock === 'number' && p.stock <= 0;
                  return (
                    <button key={p.name + i} onClick={() => setSelected(p)} disabled={out}
                      className={`w-full min-h-[48px] text-left rounded-2xl p-3 border flex items-center justify-between transition-all ${isSel ? 'border-rose-400 bg-rose-50' : 'border-slate-200/80 bg-white/90'} ${out ? 'opacity-40' : 'active:scale-[0.99]'}`}>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.category || 'ทั่วไป'}</div>
                      </div>
                      <div className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ml-2 tabular-nums ${out ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700'}`}>
                        {out ? 'หมด' : `${p.stock ?? '-'}${p.unit ? ' ' + p.unit : ''}`}
                      </div>
                    </button>
                  );
                })}
            </div>

            {/* Qty + confirm */}
            {selected && (
              <div className="p-4 border-t border-slate-200/80 space-y-3 bg-white/90">
                <div className="text-sm font-bold text-slate-900 truncate">{selected.name}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase">จำนวน</label>
                    <input type="number" inputMode="numeric" autoFocus value={qty} onChange={e => setQty(e.target.value)} placeholder="0"
                      className="mt-1 w-full bg-white border border-slate-200 rounded-2xl px-3 py-2.5 text-sm font-mono font-bold text-slate-900 tabular-nums outline-none focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase">ราคา/หน่วย (ไม่บังคับ)</label>
                    <input type="number" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder={String(selected.price ?? 0)}
                      className="mt-1 w-full bg-white border border-slate-200 rounded-2xl px-3 py-2.5 text-sm font-mono font-bold text-slate-900 tabular-nums outline-none focus:border-rose-400" />
                  </div>
                </div>
                <button onClick={addItem}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold rounded-full py-3 transition-all">
                  <Plus className="w-4 h-4" /> เพิ่มลงรายการ
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <MobileNav />
    </div>
  );
}
