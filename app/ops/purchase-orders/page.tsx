'use client';

import { useState,useEffect,useCallback,useMemo } from 'react';
import Link from 'next/link';
import { motion,AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ShoppingCart,Plus,X,Search,Trash2,ArrowLeft,Send,Ban,FileText,ArrowDownToLine } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { errorMessage } from '@/lib/errors';

type Status = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
interface PoLine { sku: string; name: string; qty: number; price: number; total?: number; }
interface Po {
  id: string; po_number: string; status: Status; supplier: string; total_amount: number;
  total_items: number; items_json: PoLine[]; created_by: string; notes: string; created_at: string;
}

const STATUS_TH: Record<Status, string> = { DRAFT: 'ร่าง', ORDERED: 'สั่งซื้อแล้ว', RECEIVED: 'รับของแล้ว', CANCELLED: 'ยกเลิก' };
const STATUS_STYLE: Record<Status, string> = {
  DRAFT: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
  ORDERED: 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
  RECEIVED: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
  CANCELLED: 'bg-[#30353d] text-[#8a92a6] ring-[#30353d]',
};
const TABS: Array<{ key: 'ALL' | Status; label: string }> = [
  { key: 'ALL', label: 'ทั้งหมด' }, { key: 'DRAFT', label: 'ร่าง' }, { key: 'ORDERED', label: 'รอรับของ' },
  { key: 'RECEIVED', label: 'รับแล้ว' }, { key: 'CANCELLED', label: 'ยกเลิก' },
];

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<Po[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | Status>('ALL');
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/po/create', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'โหลดไม่สำเร็จ');
      setPos(json.orders || []);
    } catch (e) { toast.error(errorMessage(e) || 'โหลดใบสั่งซื้อไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pos.filter(p => (tab === 'ALL' || p.status === tab) &&
      (!s || p.po_number.toLowerCase().includes(s) || (p.supplier || '').toLowerCase().includes(s) ||
        (p.items_json || []).some(l => (l.sku || '').toLowerCase().includes(s) || (l.name || '').toLowerCase().includes(s))));
  }, [pos, tab, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: pos.length };
    for (const p of pos) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [pos]);

  const setStatus = async (po: Po, status: Status) => {
    if (status === 'CANCELLED' && !confirm(`ยกเลิก ${po.po_number}?`)) return;
    const t = toast.loading('กำลังอัปเดต...');
    try {
      const res = await fetch('/api/po/create', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: po.id, status }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ไม่สำเร็จ');
      toast.success(`${po.po_number} → ${STATUS_TH[status]}`, { id: t }); load();
    } catch (e) { toast.error(errorMessage(e), { id: t }); }
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="relative z-10 max-w-[1200px] mx-auto space-y-6">
        <Link href="/ops" className="inline-flex items-center gap-2 text-sm font-bold text-[#d1c6ab] hover:text-[#facc15]"><ArrowLeft className="w-4 h-4" /> ปฏิบัติการ</Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#dee2ec] flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/25"><ShoppingCart className="w-6 h-6" /></span>
              ใบสั่งซื้อ (PO)
            </h1>
            <p className="text-[#d1c6ab] font-medium mt-1">ร่าง → สั่งซื้อ → รับเข้า (GRN) — ราคาใน PO ใช้เป็นต้นทุนสินค้าตอนรับเข้า</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#facc15] text-[#1b1600] font-bold shadow-lg hover:bg-[#eec200] active:scale-95 transition-all">
            <Plus className="w-5 h-5" /> สร้างใบสั่งซื้อ
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${tab === t.key ? 'bg-[#facc15] text-[#1b1600] border-[#facc15]' : 'bg-[#171c23] text-[#8a92a6] border-[#30353d] hover:text-[#dee2ec]'}`}>
                {t.label} <span className="opacity-70">{counts[t.key] || 0}</span>
              </button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a92a6]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาเลข PO / ซัพพลายเออร์ / สินค้า"
              className="w-full bg-[#171c23] border border-[#30353d] rounded-xl pl-9 pr-3 py-2 text-sm text-[#dee2ec] outline-none focus:border-[#facc15]" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#30353d] bg-[#171c23] overflow-hidden">
          {loading ? <div className="p-16 text-center text-[#8a92a6]">กำลังโหลด...</div>
            : shown.length === 0 ? <div className="p-16 text-center text-[#8a92a6]"><ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />{pos.length ? 'ไม่มีใบสั่งซื้อที่ตรงเงื่อนไข' : 'ยังไม่มีใบสั่งซื้อ'}</div>
            : <div className="divide-y divide-[#30353d]">
                {shown.map(po => {
                  const lines = po.items_json || [];
                  const qty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
                  return (
                    <div key={po.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-[#1b2027]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-[#dee2ec]">{po.po_number}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ${STATUS_STYLE[po.status] || STATUS_STYLE.DRAFT}`}>{STATUS_TH[po.status] || po.status}</span>
                          <span className="text-[11px] text-[#8a92a6]">{new Date(po.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        </div>
                        <div className="text-sm text-[#8a92a6] mt-1 truncate">
                          {po.supplier || 'ไม่ระบุซัพพลายเออร์'} · {lines.length} รายการ · {qty.toLocaleString()} ชิ้น · <span className="font-bold text-[#dee2ec]">{baht(po.total_amount)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={`/print/purchase-order?id=${po.id}`} target="_blank" rel="noopener noreferrer" title="พิมพ์ใบสั่งซื้อ" className="p-2 rounded-xl text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32] transition-colors"><FileText className="w-4 h-4" /></a>
                        {po.status === 'DRAFT' && <Btn onClick={() => setStatus(po, 'ORDERED')} tone="primary"><Send className="w-4 h-4" /> ส่งสั่งซื้อ</Btn>}
                        {(po.status === 'DRAFT' || po.status === 'ORDERED') && (
                          <Link href="/ops/receiving" title="สร้างใบรับเข้าแล้วเลือก PO นี้" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all">
                            <ArrowDownToLine className="w-4 h-4" /> รับเข้า
                          </Link>
                        )}
                        {(po.status === 'DRAFT' || po.status === 'ORDERED') && <Btn onClick={() => setStatus(po, 'CANCELLED')} tone="ghost"><Ban className="w-4 h-4" /> ยกเลิก</Btn>}
                      </div>
                    </div>
                  );
                })}
              </div>}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && <CreatePoModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
      </AnimatePresence>
    </div>
  );
}

function Btn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone: 'primary' | 'ghost' }) {
  const styles = {
    primary: 'bg-[#facc15] text-[#1b1600] hover:bg-[#eec200]',
    ghost: 'text-[#8a92a6] hover:bg-[#252a32]',
  };
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-all ${styles[tone]}`}>{children}</button>;
}

function CreatePoModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<PoLine[]>([]);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/products', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/suppliers', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([p, s]) => {
      setProducts(Array.isArray(p) ? p : []);
      setSuppliers(s?.suppliers || []);
    }).catch(() => {});
  }, []);

  const shown = search
    ? products.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.id || '').toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];
  const addLine = (p: any) => {
    if (lines.some(l => l.sku === p.id)) { toast('มีในรายการแล้ว'); return; }
    // Prefill with the product's recorded cost (not its selling price).
    setLines([...lines, { sku: p.id, name: p.name, qty: 1, price: Number(p.cost) || 0 }]);
    setSearch('');
  };
  const patchLine = (sku: string, patch: Partial<PoLine>) => setLines(lines.map(l => l.sku === sku ? { ...l, ...patch } : l));
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);

  const submit = async () => {
    if (lines.length === 0) { toast.error('เพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
    if (lines.some(l => !(Number(l.qty) > 0))) { toast.error('จำนวนต้องมากกว่า 0'); return; }
    setSaving(true);
    try {
      const items = lines.map(l => ({ ...l, qty: Number(l.qty), price: Number(l.price) || 0, total: Number(l.qty) * (Number(l.price) || 0) }));
      const res = await fetch('/api/po/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier, notes, items }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างไม่สำเร็จ');
      toast.success(`สร้าง ${json.po?.po_number || 'ใบสั่งซื้อ'} แล้ว`);
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#30353d] bg-[#171c23] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-[#dee2ec]">สร้างใบสั่งซื้อ</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-[#8a92a6] hover:bg-[#252a32]"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-[#8a92a6]">ซัพพลายเออร์</span>
            <input list="po-suppliers" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อ"
              className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl px-3 py-2 text-sm text-[#dee2ec] outline-none focus:border-[#facc15]" />
            <datalist id="po-suppliers">{suppliers.map((s: any) => <option key={s.id || s.code} value={s.name} />)}</datalist>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-[#8a92a6]">หมายเหตุ</span>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ไม่บังคับ"
              className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl px-3 py-2 text-sm text-[#dee2ec] outline-none focus:border-[#facc15]" />
          </label>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a92a6]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาสินค้าเพื่อเพิ่ม (ชื่อ / SKU)"
            className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl pl-9 pr-3 py-2 text-sm text-[#dee2ec] outline-none focus:border-[#facc15]" />
          {shown.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-[#30353d] bg-[#1b2027] shadow-xl overflow-hidden">
              {shown.map(p => (
                <button key={p.id} onClick={() => addLine(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-[#252a32] flex justify-between gap-3">
                  <span className="text-[#dee2ec] truncate">{p.name}</span>
                  <span className="font-mono text-[11px] text-[#8a92a6] shrink-0">{p.id} · คงเหลือ {p.stock}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {lines.length === 0 && <div className="text-center text-sm text-[#8a92a6] py-6 border border-dashed border-[#30353d] rounded-xl">ยังไม่มีรายการสินค้า</div>}
          {lines.map(l => (
            <div key={l.sku} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-xl bg-[#1b2027] border border-[#30353d] px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#dee2ec] truncate">{l.name}</div>
                <div className="font-mono text-[11px] text-[#8a92a6]">{l.sku}</div>
              </div>
              <label className="text-[10px] text-[#8a92a6]">จำนวน
                <input type="number" min={1} value={l.qty} onChange={e => patchLine(l.sku, { qty: Number(e.target.value) })}
                  className="block w-20 bg-[#171c23] border border-[#30353d] rounded-lg px-2 py-1 text-sm text-[#dee2ec] outline-none focus:border-[#facc15]" />
              </label>
              <label className="text-[10px] text-[#8a92a6]">ราคาทุน/หน่วย
                <input type="number" min={0} step="0.01" value={l.price} onChange={e => patchLine(l.sku, { price: Number(e.target.value) })}
                  className="block w-24 bg-[#171c23] border border-[#30353d] rounded-lg px-2 py-1 text-sm text-[#dee2ec] outline-none focus:border-[#facc15]" />
              </label>
              <button onClick={() => setLines(lines.filter(x => x.sku !== l.sku))} className="p-2 rounded-lg text-[#8a92a6] hover:text-rose-400 hover:bg-[#252a32]" title="ลบ"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#30353d] pt-4">
          <div className="text-sm text-[#8a92a6]">รวม <span className="text-lg font-black text-[#dee2ec]">{baht(total)}</span></div>
          <button onClick={submit} disabled={saving} className="px-6 py-2.5 rounded-xl bg-[#facc15] text-[#1b1600] font-bold hover:bg-[#eec200] disabled:opacity-50 active:scale-95 transition-all">
            {saving ? 'กำลังบันทึก...' : 'บันทึกเป็นร่าง'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
