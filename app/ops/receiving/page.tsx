'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PackagePlus, Plus, X, Search, Trash2, ArrowLeft, ClipboardCheck,
  Warehouse, CheckCircle2, FileText, Printer, Building2, MapPin, Zap, Camera
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import { speakScanSuccess, speakScanMismatch, speakPutawayLocation, vibrateSuccess, vibrateError } from '@/lib/voiceAssistant';
import CameraScannerModal from '@/components/CameraScannerModal';

type Status = 'EXPECTED' | 'RECEIVING' | 'DONE' | 'CANCELLED';
interface Line { sku: string; name: string; expectedQty: number; receivedQty?: number; putawayBin?: string; done?: boolean; }
interface Receipt {
  id: string; receiptNo: string; poNumber: string; supplier: string; status: Status;
  items: Line[]; createdAt: string;
}

const STATUS_TH: Record<Status, string> = { EXPECTED: 'รอรับ', RECEIVING: 'กำลังรับ', DONE: 'รับ+เก็บแล้ว', CANCELLED: 'ยกเลิก' };
const STATUS_STYLE: Record<Status, string> = {
  EXPECTED: 'bg-amber-100 text-amber-700 ring-amber-200',
  RECEIVING: 'bg-blue-100 text-blue-700 ring-blue-200',
  DONE: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-rose-100 text-rose-600 ring-rose-200',
};

export default function ReceivingPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [receiving, setReceiving] = useState<Receipt | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMainScanner, setShowMainScanner] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receiving', { cache: 'no-store' });
      const json = await res.json();
      setReceipts(json.receipts || []);
    } catch { toast.error('โหลดใบรับเข้าไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pending = receipts.filter(r => r.status === 'EXPECTED' || r.status === 'RECEIVING');
  const done = receipts.filter(r => r.status === 'DONE');

  // Smart barcode scan handler on main screen:
  // Auto-opens matching pending receipt directly into ReceiveModal
  const handleMainBarcodeScan = (scanned: string) => {
    const q = scanned.trim().toLowerCase();
    // 1. Look for matching pending receipt by receiptNo, poNumber, or line SKU/name
    const matchPending = pending.find(r =>
      r.receiptNo.toLowerCase() === q ||
      (r.poNumber && r.poNumber.toLowerCase() === q) ||
      r.items.some(it => it.sku.toLowerCase() === q || it.name.toLowerCase().includes(q))
    );

    if (matchPending) {
      toast.success(`พบใบรับ ${matchPending.receiptNo} — กำลังเปิดหน้าต่างตรวจรับ...`);
      setShowMainScanner(false);
      setReceiving(matchPending);
      return;
    }

    // 2. Look in completed receipts
    const matchDone = done.find(r =>
      r.receiptNo.toLowerCase() === q ||
      (r.poNumber && r.poNumber.toLowerCase() === q) ||
      r.items.some(it => it.sku.toLowerCase() === q || it.name.toLowerCase().includes(q))
    );
    if (matchDone) {
      toast(`ใบรับ ${matchDone.receiptNo} นี้ตรวจรับและเก็บเข้าสต็อกเสร็จสิ้นแล้ว`, { icon: 'ℹ️' });
      setSearchQuery(scanned.trim());
      setShowMainScanner(false);
      return;
    }

    // 3. Not found in existing receipts -> filter by search query
    setSearchQuery(scanned.trim());
    setShowMainScanner(false);
    toast.error(`ไม่พบรหัส "${scanned}" ในใบรอรับเข้า (กรองการแสดงผลตามรหัสที่สแกน)`);
  };

  // Hardware PDA scanner listener on main page
  usePdaScanner({
    onScan: handleMainBarcodeScan,
    enabled: !receiving && !showCreate,
  });

  const matchesSearch = (r: Receipt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.receiptNo.toLowerCase().includes(q) ||
      (r.poNumber && r.poNumber.toLowerCase().includes(q)) ||
      (r.supplier && r.supplier.toLowerCase().includes(q)) ||
      r.items.some(it => it.sku.toLowerCase().includes(q) || it.name.toLowerCase().includes(q))
    );
  };

  const filteredPending = pending.filter(matchesSearch);
  const filteredDone = done.filter(matchesSearch);

  return (
    <div className="min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="relative z-10 max-w-[1200px] mx-auto space-y-6">
        <Link href="/ops" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> ปฏิบัติการ</Link>

        {/* Main Header with prominent Scan Button */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25"><PackagePlus className="w-6 h-6" /></span>
              รับเข้า &amp; จัดเก็บ (Inbound &amp; Putaway)
            </h1>
            <p className="text-slate-500 font-medium mt-1">รับของตาม PO/Supplier → ตรวจนับ → จัดเก็บเข้า bin → เข้าสต็อกอัตโนมัติ</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowMainScanner(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg shadow-emerald-600/25 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all"
            >
              <Camera className="w-5 h-5" />
              <span>สแกนบาร์โค้ดรับสินค้า</span>
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold shadow-lg hover:bg-slate-800 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" /> สร้างใบรับเข้า
            </button>
          </div>
        </div>

        {/* Quick Search & PDA Status Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่ใบรับ (GRN), เลข PO, ชื่อผู้ขาย, หรือชื่อ/รหัสสินค้า..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 bg-white/90 border border-slate-200 rounded-2xl font-medium text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 shadow-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMainScanner(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-md transition-all shrink-0"
            >
              <Camera className="w-4 h-4" />
              <span>สแกนหาใบรับ</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-2xl border border-slate-200 shrink-0">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">PDA พร้อมยิง</span>
            </div>
          </div>
        </div>

        <Section title="รอรับเข้า" icon={<ClipboardCheck className="w-4 h-4" />} empty="ไม่มีใบรอรับ" loading={loading} items={filteredPending}
          render={(r: Receipt) => (
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`/print/putaway-slip?id=${r.id}`} target="_blank" rel="noopener noreferrer" title="พิมพ์ใบจัดเก็บเข้าที่ (Putaway Slip)" className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                <Printer className="w-4 h-4" />
              </a>
              <a href={`/print/receipt?id=${r.id}`} target="_blank" rel="noopener noreferrer" title="พิมพ์ใบตรวจรับ (GRN)" className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                <FileText className="w-4 h-4" />
              </a>
              <button onClick={() => setReceiving(r)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 active:scale-95 transition-all shadow-md shadow-emerald-600/20">
                <Warehouse className="w-4 h-4" /> ตรวจรับ &amp; เก็บ
              </button>
            </div>
          )} />

        <Section title="รับเข้าแล้ว" icon={<CheckCircle2 className="w-4 h-4" />} empty="ยังไม่มีประวัติ" loading={loading} items={filteredDone}
          render={(r: Receipt) => (
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`/print/putaway-slip?id=${r.id}`} target="_blank" rel="noopener noreferrer" title="พิมพ์ใบจัดเก็บ (Putaway Slip)" className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                <Printer className="w-4 h-4" />
              </a>
              <a href={`/print/receipt?id=${r.id}`} target="_blank" rel="noopener noreferrer" title="พิมพ์ใบรับเข้า (GRN)" className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                <FileText className="w-4 h-4" />
              </a>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-sm px-2"><CheckCircle2 className="w-4 h-4" /> เสร็จสิ้น</span>
            </div>
          )} />
      </div>

      <AnimatePresence>
        {showCreate && <CreateReceiptModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
        {receiving && <ReceiveModal receipt={receiving} onClose={() => setReceiving(null)} onDone={() => { setReceiving(null); load(); }} />}
      </AnimatePresence>

      {/* Embedded Camera Scanner on Main Receiving Screen */}
      <CameraScannerModal
        isOpen={showMainScanner}
        onClose={() => setShowMainScanner(false)}
        onScan={handleMainBarcodeScan}
        title="สแกนบาร์โค้ดรับสินค้า / ใบรับเข้า"
        description="ส่องกล้องไปที่บาร์โค้ดบนใบสั่งซื้อ (PO), ใบรับ (GRN) หรือบาร์โค้ดบนตัวสินค้าเพื่อเปิดหน้าต่างตรวจรับทันที"
      />
    </div>
  );
}

function Section({ title, icon, items, render, empty, loading }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 font-bold text-slate-700">{icon} {title} · {items.length}</div>
      {loading ? <div className="p-12 text-center text-slate-400">กำลังโหลด...</div>
        : items.length === 0 ? <div className="p-12 text-center text-slate-400">{empty}</div>
        : <div className="divide-y divide-slate-100">
            {items.map((r: Receipt) => (
              <div key={r.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-slate-50/60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-900">{r.receiptNo}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ${STATUS_STYLE[r.status]}`}>{STATUS_TH[r.status]}</span>
                    {r.poNumber && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 inline-flex items-center gap-1"><FileText className="w-3 h-3" />{r.poNumber}</span>}
                  </div>
                  <div className="text-sm text-slate-500 mt-1 truncate">{r.supplier || 'ไม่ระบุผู้ขาย'} · {r.items.length} รายการ · คาด {r.items.reduce((s, l) => s + l.expectedQty, 0)} ชิ้น</div>
                </div>
                {render(r)}
              </div>
            ))}
          </div>}
    </div>
  );
}

function CreateReceiptModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [supplier, setSupplier] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/products', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/po/create?status=DRAFT', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/suppliers', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([dProd, dPo, dSupp]) => {
      setProducts(Array.isArray(dProd) ? dProd : []);
      setPos(dPo?.orders || []);
      setSuppliers(dSupp?.suppliers || []);
    }).catch(() => {});
  }, []);

  const prefillFromPO = (poId: string) => {
    const po = pos.find(p => p.id === poId);
    if (!po) { setPoNumber(''); return; }
    setPoNumber(po.po_number);
    setSupplier(po.supplier || '');
    const items: any[] = Array.isArray(po.items_json) ? po.items_json : [];
    setLines(items.map(it => ({ sku: it.sku || it.id || it.name, name: it.name, expectedQty: Number(it.qty) || 1, putawayBin: '' })));
  };

  const addLine = (p: any) => {
    if (lines.some(l => l.sku === p.id)) { toast('มีในรายการแล้ว'); return; }
    setLines([...lines, { sku: p.id, name: p.name, expectedQty: 1, putawayBin: p.location }]);
  };
  const setExp = (sku: string, q: number) => setLines(lines.map(l => l.sku === sku ? { ...l, expectedQty: Math.max(1, q) } : l));
  const removeLine = (sku: string) => setLines(lines.filter(l => l.sku !== sku));

  const shown = search ? products.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.id || '').toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [];

  const submit = async () => {
    if (lines.length === 0) { toast.error('เพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/receiving', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier, poNumber, items: lines }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างไม่สำเร็จ');
      toast.success(`สร้าง ${json.receipt.receiptNo} แล้ว`);
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleScanAdd = (scanned: string) => {
    const q = scanned.trim().toLowerCase();
    const matched = products.find(p => (p.id || '').toLowerCase() === q || (p.name || '').toLowerCase() === q || (p.barcode || '').toLowerCase() === q);
    if (matched) {
      addLine(matched);
      toast.success(`เพิ่ม ${matched.name} ลงใบรับเข้าแล้ว`);
      setShowCameraScanner(false);
    } else {
      toast.error(`ไม่พบรหัสสินค้า "${scanned}" ในระบบ`);
    }
  };

  return (
    <Modal onClose={onClose} title="สร้างใบรับเข้า (GRN)">
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">เลือกจากใบสั่งซื้อ (PO)</label>
            <select onChange={e => prefillFromPO(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-emerald-500 text-sm">
              <option value="">— ไม่ผูกกับ PO —</option>
              {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} · {p.supplier || 'ไม่ระบุ'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">เลือกผู้จำหน่าย (Supplier)</label>
            <select
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-emerald-500 text-sm"
            >
              <option value="">— ระบุชื่อผู้ขายเอง / เลือกจากรายชื่อ —</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.code} - {s.name}</option>)}
            </select>
          </div>
        </div>

        <input
          value={supplier}
          onChange={e => setSupplier(e.target.value)}
          placeholder="ชื่อผู้ขาย / ซัพพลายเออร์ (สามารถพิมพ์แก้ไขได้)"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-emerald-500 text-sm"
        />

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาสินค้าเพื่อเพิ่มลงใบรับเข้า..." className="w-full pl-11 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-emerald-500 text-sm" />
            {shown.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                {shown.map(p => (
                  <button key={p.id} onClick={() => { addLine(p); setSearch(''); }} className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-center justify-between">
                    <span className="font-medium text-slate-700 truncate">{p.name}</span>
                    <span className="text-xs text-slate-400">{p.location} · สต็อก {p.stock}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowCameraScanner(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shrink-0 active:scale-95"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>สแกนบาร์โค้ด</span>
          </button>
        </div>

        <div className="space-y-2">
          {lines.length === 0 ? <div className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-xl">ยังไม่มีสินค้าในใบรับเข้า</div>
            : lines.map(l => (
              <div key={l.sku} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5">
                <div className="flex-1 min-w-0"><div className="font-medium text-slate-800 truncate">{l.name}</div><div className="text-xs text-slate-400">{l.sku}</div></div>
                <div className="text-xs text-slate-400">จำนวนคาดรับ</div>
                <input type="number" min={1} value={l.expectedQty} onChange={e => setExp(l.sku, parseInt(e.target.value) || 1)} className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-center font-bold outline-none focus:border-emerald-500" />
                <button onClick={() => removeLine(l.sku)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
        </div>
      </div>
      <ModalFooter>
        <button onClick={submit} disabled={saving || lines.length === 0} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-lg hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50">
          {saving ? 'กำลังสร้าง...' : 'สร้างใบรับเข้า'}
        </button>
      </ModalFooter>

      {/* Embedded Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleScanAdd}
        title="สแกนเพิ่มสินค้าเข้าใบรับ (GRN)"
        description="ส่องกล้องไปที่บาร์โค้ดบนตัวสินค้าเพื่อเพิ่มเข้าใบรับเข้าโดยตรง"
      />
    </Modal>
  );
}

function ReceiveModal({ receipt, onClose, onDone }: { receipt: Receipt; onClose: () => void; onDone: () => void }) {
  const [lines, setLines] = useState<Line[]>(receipt.items.map(l => ({ ...l, receivedQty: l.receivedQty || l.expectedQty, putawayBin: l.putawayBin || '' })));
  const [saving, setSaving] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  const setRecv = (sku: string, q: number) => setLines(prev => prev.map(l => l.sku === sku ? { ...l, receivedQty: Math.max(0, q) } : l));
  const setBin = (sku: string, bin: string) => setLines(prev => prev.map(l => l.sku === sku ? { ...l, putawayBin: bin } : l));

  // Shared scan handler for both PDA Hardware scanner and Mobile Camera
  const handleItemScanned = (scanned: string) => {
    const trimmed = scanned.trim().toLowerCase();
    const matchIndex = lines.findIndex(
      l => l.sku.toLowerCase() === trimmed || l.name.toLowerCase().includes(trimmed)
    );
    if (matchIndex >= 0) {
      const line = lines[matchIndex];
      const newQty = (line.receivedQty || 0) + 1;
      setRecv(line.sku, newQty);
      vibrateSuccess();
      speakScanSuccess(line.name, newQty);
      if (line.putawayBin) {
        setTimeout(() => speakPutawayLocation(line.name, line.putawayBin!), 900);
      }
      toast.success(`สแกนรับ: ${line.name} (${newQty}/${line.expectedQty})`);
    } else {
      vibrateError();
      speakScanMismatch(scanned, 'ไม่พบในใบรับเข้านี้');
      toast.error(`ไม่พบรหัส ${scanned} ในใบรับเข้าชุดนี้`);
    }
  };

  // PDA Scanner auto-increment receivedQty on scan
  usePdaScanner({
    onScan: handleItemScanned,
    enabled: true,
  });

  const commit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/receiving', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: receipt.id, lines }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ยืนยันไม่สำเร็จ');
      toast.success('รับเข้าและจัดเก็บเข้าสต็อกเรียบร้อย');
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} title={`ตรวจรับ & จัดเก็บ: ${receipt.receiptNo}`}>
      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-sm text-slate-500 font-medium">ตรวจนับยอดรับจริงและระบุ Bin ตำแหน่งจัดเก็บเพื่อนำสินค้าเข้าสต็อก</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>เปิดกล้องสแกน</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>PDA พร้อมยิง</span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {lines.map(l => (
            <div key={l.sku} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-900">{l.name}</div>
                  <div className="text-xs font-mono text-slate-400">{l.sku}</div>
                </div>
                <div className="text-xs text-slate-500">คาดรับ: <b className="text-slate-800">{l.expectedQty}</b></div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">รับจริง</label>
                  <input type="number" min={0} value={l.receivedQty} onChange={e => setRecv(l.sku, parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">จัดเก็บที่ Bin</label>
                  <input value={l.putawayBin || ''} onChange={e => setBin(l.sku, e.target.value)} placeholder="เช่น A-01-02-1"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ModalFooter>
        <button onClick={commit} disabled={saving} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-lg hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50">
          {saving ? 'กำลังบันทึก...' : 'ยืนยันรับเข้า & บันทึกสต็อก'}
        </button>
      </ModalFooter>

      {/* Embedded Camera Scanner for Mobile / Tablet Workers */}
      <CameraScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleItemScanned}
        continuous={true}
        title={`สแกนตรวจรับ: ${receipt.receiptNo}`}
        description="ส่องกล้องไปที่บาร์โค้ดบนสินค้า ระบบจะตรวจรับและนับยอดเพิ่มให้อัตโนมัติ (สแกนต่อเนื่องได้)"
      />
    </Modal>
  );
}

function Modal({ title, onClose, children }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function ModalFooter({ children }: any) {
  return <div className="p-6 border-t border-slate-100 flex justify-end bg-white shrink-0">{children}</div>;
}
