'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Undo2, Plus, X, Search, Trash2, ArrowLeft, ArrowRight, PackageCheck, Ban, FileText, ScanBarcode } from 'lucide-react';
import { errorMessage } from '@/lib/errors';

type Status = 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'RESTOCKED' | 'SCRAPPED' | 'REJECTED';
interface Line { sku: string; name: string; qty: number; }
interface Rma { id: string; rmaNo: string; orderNo: string; customerName: string; reason: string; status: Status; items: Line[]; createdAt: string; }

const STATUS_TH: Record<Status, string> = { REQUESTED: 'ขอคืน', APPROVED: 'อนุมัติ', RECEIVED: 'รับของคืน', RESTOCKED: 'คืนสต็อก', SCRAPPED: 'ทิ้ง/เสีย', REJECTED: 'ปฏิเสธ' };
const STATUS_STYLE: Record<Status, string> = {
  REQUESTED: 'bg-amber-500/15 text-amber-800 border border-amber-500/25',
  APPROVED: 'bg-sky-500/12 text-sky-700 border border-sky-500/25',
  RECEIVED: 'bg-sky-500/12 text-sky-800 border border-sky-500/30',
  RESTOCKED: 'bg-emerald-500/12 text-emerald-700 border border-emerald-500/20',
  SCRAPPED: 'bg-slate-900/6 text-slate-600 border border-slate-200',
  REJECTED: 'bg-rose-500/12 text-rose-700 border border-rose-500/20',
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<Rma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/returns', { cache: 'no-store' });
      const json = await res.json();
      setReturns(json.returns || []);
    } catch { toast.error('โหลดใบคืนไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (r: Rma, body: any) => {
    const t = toast.loading('กำลังอัปเดต...');
    try {
      const res = await fetch('/api/returns', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, ...body }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ไม่สำเร็จ');
      toast.success('อัปเดตแล้ว', { id: t }); load();
    } catch (e) { toast.error(errorMessage(e), { id: t }); }
  };

  const actions = (r: Rma) => {
    switch (r.status) {
      case 'REQUESTED': return (<>
        <Btn onClick={() => patch(r, { status: 'APPROVED' })} tone="dark">อนุมัติ <ArrowRight className="w-4 h-4" /></Btn>
        <Btn onClick={() => patch(r, { status: 'REJECTED' })} tone="ghost"><Ban className="w-4 h-4" /> ปฏิเสธ</Btn>
      </>);
      case 'APPROVED': return <Btn onClick={() => patch(r, { status: 'RECEIVED' })} tone="dark">รับของคืน <ArrowRight className="w-4 h-4" /></Btn>;
      case 'RECEIVED': return (<>
        <Btn onClick={() => patch(r, { status: 'RESTOCKED', disposition: 'RESTOCK' })} tone="emerald"><PackageCheck className="w-4 h-4" /> คืนเข้าสต็อก</Btn>
        <Btn onClick={() => patch(r, { status: 'SCRAPPED', disposition: 'SCRAP' })} tone="ghost">ทิ้ง/เสีย</Btn>
      </>);
      default: return <span className="text-xs font-semibold text-slate-500 px-3">ปิดงานแล้ว</span>;
    }
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative overflow-hidden text-slate-900">
      <div className="relative z-10 max-w-[1200px] mx-auto space-y-6">
        <Link
          href="/ops"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> ปฏิบัติการ
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-700 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Reverse Logistics (RMA)
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <Undo2 className="w-7 h-7 text-rose-600 shrink-0" />
              <span>คืนสินค้า (RMA)</span>
            </h1>
            <p className="text-slate-600 font-medium text-xs sm:text-sm mt-0.5">ขอคืน → อนุมัติ → รับของคืน → คืนสต็อก / ทิ้ง</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/ops/returns/scan"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm active:scale-95 transition-all text-xs"
            >
              <ScanBarcode className="w-4 h-4" />
              <span>สแกนตรวจรับของคืน (Quarantine Scan)</span>
            </Link>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white font-semibold shadow-sm hover:bg-slate-800 active:scale-95 transition-all text-xs">
              <Plus className="w-4 h-4" /> สร้างใบคืน
            </button>
          </div>
        </div>

        <div className="nx-glass-card overflow-hidden">
          {loading ? <div className="p-16 text-center text-sm text-slate-500">กำลังโหลด...</div>
            : returns.length === 0 ? <div className="p-16 text-center text-slate-500"><Undo2 className="w-10 h-10 mx-auto mb-3 opacity-40" />ยังไม่มีใบคืนสินค้า</div>
            : <div className="divide-y divide-slate-100">
                {returns.map(r => (
                  <div key={r.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-slate-50/70 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900">{r.rmaNo}</span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{STATUS_TH[r.status]}</span>
                        {r.orderNo && <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 font-mono">{r.orderNo}</span>}
                      </div>
                      <div className="text-sm text-slate-600 mt-1 truncate tabular-nums">{r.customerName || 'ไม่ระบุ'} · {r.items.reduce((s, l) => s + l.qty, 0)} ชิ้น · {r.reason || 'ไม่ระบุเหตุผล'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`/print/return?id=${r.id}`} target="_blank" rel="noopener noreferrer" title="พิมพ์ใบคืน" className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"><FileText className="w-4 h-4" /></a>
                      {actions(r)}
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && <CreateReturnModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
      </AnimatePresence>
    </div>
  );
}

function Btn({ children, onClick, tone }: any) {
  const styles: Record<string, string> = {
    dark: 'bg-slate-900 text-white hover:bg-slate-800',
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
    ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200',
  };
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-all ${styles[tone]}`}>{children}</button>;
}

function CreateReturnModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/products', { cache: 'no-store' }).then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const addLine = (p: any) => { if (lines.some(l => l.sku === p.id)) { toast('มีในรายการแล้ว'); return; } setLines([...lines, { sku: p.id, name: p.name, qty: 1 }]); };
  const setQty = (sku: string, q: number) => setLines(lines.map(l => l.sku === sku ? { ...l, qty: Math.max(1, q) } : l));
  const removeLine = (sku: string) => setLines(lines.filter(l => l.sku !== sku));
  const shown = search ? products.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.id || '').toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [];

  const submit = async () => {
    if (lines.length === 0) { toast.error('เพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/returns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: customer, orderNo, reason, items: lines }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างไม่สำเร็จ');
      toast.success(`สร้าง ${json.rma.rmaNo} แล้ว`); onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white/95 backdrop-blur-xl border border-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-900" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-xl z-10">
          <h2 className="text-xl font-bold text-slate-900">สร้างใบคืนสินค้า (RMA)</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="ชื่อลูกค้า" className="bg-slate-50/90 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 font-medium outline-none focus:bg-white focus:border-rose-500" />
            <input value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="เลขออเดอร์เดิม (ถ้ามี)" className="bg-slate-50/90 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 font-medium outline-none focus:bg-white focus:border-rose-500" />
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="เหตุผลคืน" className="bg-slate-50/90 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 font-medium outline-none focus:bg-white focus:border-rose-500" />
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาสินค้าที่คืน..." className="w-full pl-10 bg-slate-50/90 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 font-medium outline-none focus:bg-white focus:border-rose-500" />
            {shown.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                {shown.map(p => (<button key={p.id} onClick={() => { addLine(p); setSearch(''); }} className="w-full text-left px-4 py-2.5 hover:bg-rose-50/60 flex items-center justify-between"><span className="font-medium text-slate-800 truncate text-sm">{p.name}</span><span className="text-xs text-slate-500 font-mono">{p.location}</span></button>))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {lines.length === 0 ? <div className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-2xl text-sm">ยังไม่มีสินค้า</div>
              : lines.map(l => (
                <div key={l.sku} className="flex items-center gap-3 bg-slate-50/90 border border-slate-200/80 rounded-2xl px-4 py-2.5">
                  <div className="flex-1 min-w-0"><div className="font-semibold text-slate-900 truncate text-sm">{l.name}</div><div className="text-xs text-slate-500 font-mono">{l.sku}</div></div>
                  <input type="number" min={1} value={l.qty} onChange={e => setQty(l.sku, parseInt(e.target.value) || 1)} className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center font-bold text-slate-900 tabular-nums outline-none focus:border-rose-500" />
                  <button onClick={() => removeLine(l.sku)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 flex justify-end sticky bottom-0 bg-white/95 backdrop-blur-xl">
          <button onClick={submit} disabled={saving || lines.length === 0} className="px-6 py-2.5 rounded-full bg-rose-600 text-white font-semibold text-sm shadow-sm hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50">{saving ? 'กำลังสร้าง...' : 'สร้างใบคืน'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
