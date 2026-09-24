'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Plus, Truck, Trash2, PackageCheck, X, Calendar } from 'lucide-react';
import { errorMessage } from '@/lib/errors';

interface AsnItem { sku: string; name: string; expectedQty: number }
interface Asn { id: string; asnNo: string; supplier: string; poNumber: string; eta?: string; status: string; receiptId?: string; items: AsnItem[]; createdAt: string }

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'รอรับ', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  RECEIVED: { label: 'รับแล้ว', cls: 'bg-[#57ec7f]/15 text-[#57ec7f] border-[#57ec7f]/30' },
  CANCELLED: { label: 'ยกเลิก', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

export default function AsnPage() {
  const [asns, setAsns] = useState<Asn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await (await fetch('/api/asn', { cache: 'no-store' })).json(); setAsns(d.asns || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const receive = async (a: Asn) => {
    if (!confirm(`สร้างใบรับเข้าจาก ${a.asnNo}? จะเข้าสู่คิวรับเข้า (Receiving) เพื่อสแกน/จัดเก็บ`)) return;
    setBusy(a.id);
    try {
      const d = await (await fetch('/api/asn/receive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asnId: a.id }) })).json();
      if (d.error) throw new Error(d.error);
      toast.success(d.message || 'สร้างใบรับแล้ว'); load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <div className="min-h-screen bg-[#0f141b] text-[#dee2ec] pb-16">
      <header className="sticky top-0 z-20 bg-[#0f141b]/95 backdrop-blur border-b border-[#30353d] px-5 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/ops" className="p-2 rounded-xl bg-[#1b2027] border border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec]"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="font-headline font-black text-lg text-[#facc15] flex items-center gap-2"><Truck className="w-5 h-5" /> ASN แจ้งของเข้าล่วงหน้า</h1>
              <p className="text-[11px] text-[#8a92a6] font-mono">Advanced Shipping Notice → แปลงเป็นใบรับเข้าอัตโนมัติ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)} className="px-3 py-2 rounded-xl bg-[#facc15] text-[#1b1600] font-bold text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" /> สร้าง ASN</button>
            <button onClick={load} disabled={loading} className="p-2 rounded-xl bg-[#252a32] border border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec] disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-3">
        {loading && asns.length === 0 ? <div className="text-center text-[#8a92a6] py-16"><RefreshCw className="w-6 h-6 animate-spin inline" /></div>
          : asns.length === 0 ? <div className="text-center text-[#8a92a6] py-16">ยังไม่มี ASN — กด "สร้าง ASN" เพื่อเริ่ม</div>
          : asns.map(a => {
            const st = STATUS[a.status] || STATUS.PENDING;
            const units = a.items.reduce((s, i) => s + i.expectedQty, 0);
            return (
              <div key={a.id} className="bg-[#171c23] border border-[#30353d] rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#dee2ec]">{a.asnNo}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-xs text-[#8a92a6] mt-1">
                      {a.supplier || 'ไม่ระบุผู้ขาย'}{a.poNumber ? ` · PO ${a.poNumber}` : ''}{a.eta ? ` · ETA ${a.eta}` : ''} · {a.items.length} รายการ / {units} ชิ้น
                    </div>
                  </div>
                  {a.status === 'PENDING' && (
                    <button onClick={() => receive(a)} disabled={busy === a.id} className="px-3 py-2 rounded-xl bg-[#57ec7f]/15 text-[#57ec7f] border border-[#57ec7f]/30 font-bold text-sm flex items-center gap-1.5 disabled:opacity-50">
                      {busy === a.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />} รับเข้า
                    </button>
                  )}
                  {a.status === 'RECEIVED' && <span className="text-xs text-[#8a92a6]">→ ใบรับ {a.receiptId?.slice(0, 8)}</span>}
                </div>
              </div>
            );
          })}
      </main>

      {showCreate && <CreateAsn onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateAsn({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [supplier, setSupplier] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [eta, setEta] = useState('');
  const [items, setItems] = useState<{ sku: string; name: string; qty: string }[]>([{ sku: '', name: '', qty: '' }]);
  const [saving, setSaving] = useState(false);

  const setItem = (i: number, k: string, v: string) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const save = async () => {
    const clean = items.filter(i => i.sku.trim() && Number(i.qty) > 0).map(i => ({ sku: i.sku.trim(), name: i.name.trim() || i.sku.trim(), qty: Number(i.qty) }));
    if (clean.length === 0) return toast.error('ใส่สินค้าอย่างน้อย 1 รายการ (sku + จำนวน)');
    setSaving(true);
    try {
      const d = await (await fetch('/api/asn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier, poNumber, eta: eta || null, items: clean }) })).json();
      if (d.success === false) throw new Error(d.error);
      toast.success(`สร้าง ${d.asnNo} แล้ว`); onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#171c23] border border-[#30353d] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30353d] sticky top-0 bg-[#171c23]">
          <h3 className="font-bold text-[#dee2ec]">สร้าง ASN ใหม่</h3>
          <button onClick={onClose} className="p-2 text-[#8a92a6] hover:text-[#dee2ec]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="ผู้ขาย (Supplier)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#facc15]" />
            <input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="เลข PO (ถ้ามี)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#facc15]" />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#8a92a6]"><Calendar className="w-4 h-4" /> ETA
            <input type="date" value={eta} onChange={e => setEta(e.target.value)} className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm text-[#dee2ec] outline-none focus:border-[#facc15]" />
          </label>
          <div className="text-[11px] font-bold text-[#d1c6ab] uppercase pt-2">รายการสินค้า</div>
          {items.map((it, i) => (
            <div key={i} className="flex gap-1.5">
              <input value={it.sku} onChange={e => setItem(i, 'sku', e.target.value)} placeholder="SKU" className="flex-1 bg-[#0f141b] border border-[#30353d] rounded-lg px-2 py-2 text-sm font-mono outline-none focus:border-[#facc15]" />
              <input value={it.name} onChange={e => setItem(i, 'name', e.target.value)} placeholder="ชื่อ (ไม่บังคับ)" className="flex-1 bg-[#0f141b] border border-[#30353d] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#facc15]" />
              <input value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} inputMode="numeric" placeholder="จำนวน" className="w-20 bg-[#0f141b] border border-[#30353d] rounded-lg px-2 py-2 text-sm font-mono text-center outline-none focus:border-[#facc15]" />
              <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="p-2 text-[#8a92a6] hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => setItems([...items, { sku: '', name: '', qty: '' }])} className="text-xs text-[#4cd7f6] flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> เพิ่มรายการ</button>
          <button onClick={save} disabled={saving} className="w-full mt-2 py-2.5 rounded-xl bg-[#facc15] text-[#1b1600] font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} บันทึก ASN
          </button>
        </div>
      </div>
    </div>
  );
}
