'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PackageMinus, Search, Plus, Trash2, RefreshCw, Check, X, FileText } from 'lucide-react';
import MobileNav from '@/components/MobileNav';
import { getApiUrl } from '@/lib/config';

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
    } catch (e: any) {
      toast.error(e?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans select-none">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-rose-600 to-red-700 text-white px-5 pt-6 pb-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-rose-100 text-sm font-medium">
              <PackageMinus className="w-4 h-4" /> เบิกจ่ายตรง / ใช้ภายใน
            </div>
            <h1 className="text-2xl font-black mt-0.5">{items.length} รายการ · {totalQty} ชิ้น</h1>
          </div>
          <button onClick={loadProducts} className="p-2.5 rounded-full bg-white/15 active:scale-90 transition-transform">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Doc info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">เลขที่เอกสาร</label>
            <div className="mt-1 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <input value={docRef} onChange={e => setDocRef(e.target.value)} placeholder="ไม่บังคับ"
                className="w-full bg-transparent text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">วันที่</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm shadow-sm outline-none" />
          </div>
        </div>

        {/* Add item button */}
        <button onClick={openPicker}
          className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold rounded-2xl py-3.5 shadow-lg shadow-rose-600/30 transition-all">
          <Plus className="w-5 h-5" /> เพิ่มสินค้าที่จะเบิกจ่าย
        </button>

        {/* Items list */}
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <PackageMinus className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">ยังไม่มีรายการ</p>
            <p className="text-xs">กดปุ่มด้านบนเพื่อเพิ่มสินค้าที่ต้องเบิก</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((it, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center font-bold shrink-0">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate">{it.sku}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    จำนวน <strong className="text-rose-600">{it.qty}</strong>{it.unit ? ` ${it.unit}` : ' ชิ้น'}
                    {it.salePrice ? ` · ราคา ${it.salePrice}` : ''}
                    {typeof it.stock === 'number' ? ` · คงเหลือ ${it.stock}` : ''}
                  </div>
                </div>
                <button onClick={() => removeItem(idx)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 active:scale-90 transition-all shrink-0">
                  <Trash2 className="w-4.5 h-4.5" />
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
            <button onClick={submit} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 active:scale-[0.99] text-white font-black rounded-2xl py-4 shadow-xl shadow-rose-600/30 transition-all">
              <Check className="w-5 h-5" />
              {submitting ? 'กำลังบันทึก...' : `ยืนยันเบิกจ่าย (${items.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Product picker sheet */}
      {picker && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setPicker(false)}>
          <div className="bg-white w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">เลือกสินค้า</h3>
              <button onClick={() => setPicker(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อ/หมวดสินค้า"
                  className="w-full bg-transparent text-sm outline-none" />
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
                      className={`w-full text-left rounded-xl p-3 border flex items-center justify-between transition-all ${isSel ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white'} ${out ? 'opacity-40' : 'active:scale-[0.99]'}`}>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.category || 'ทั่วไป'}</div>
                      </div>
                      <div className={`text-xs font-bold shrink-0 ml-2 ${out ? 'text-red-600' : 'text-slate-600'}`}>
                        {out ? 'หมด' : `${p.stock ?? '-'}${p.unit ? ' ' + p.unit : ''}`}
                      </div>
                    </button>
                  );
                })}
            </div>

            {/* Qty + confirm */}
            {selected && (
              <div className="p-4 border-t border-slate-200 space-y-3">
                <div className="text-sm font-bold text-slate-900 truncate">{selected.name}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">จำนวน</label>
                    <input type="number" inputMode="numeric" autoFocus value={qty} onChange={e => setQty(e.target.value)} placeholder="0"
                      className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">ราคา/หน่วย (ไม่บังคับ)</label>
                    <input type="number" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder={String(selected.price ?? 0)}
                      className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-400" />
                  </div>
                </div>
                <button onClick={addItem}
                  className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold rounded-xl py-3 transition-all">
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
