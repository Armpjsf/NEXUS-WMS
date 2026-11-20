'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  PackagePlus,
  Search,
  ArrowLeft,
  Warehouse,
  CheckCircle2,
  FileText,
  Printer,
  MapPin,
  Camera,
  RefreshCw,
  X,
  Plus,
  Minus,
  Volume2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { speakPutawayLocation, triggerHaptic } from '@/lib/voiceAssistant';
import BinQuickSelect from '@/components/stock/BinQuickSelect';
import { errorMessage } from '@/lib/errors';

type Status = 'EXPECTED' | 'RECEIVING' | 'DONE' | 'CANCELLED';
interface Line {
  sku: string;
  name: string;
  expectedQty: number;
  receivedQty?: number;
  putawayBin?: string;
  uom?: string;
  done?: boolean;
}

interface UomOpt { code: string; name?: string; factor: number; barcode?: string; isBase?: boolean }

interface Receipt {
  id: string;
  receiptNo: string;
  poNumber: string;
  supplier: string;
  status: Status;
  items: Line[];
  createdAt: string;
}

export default function MobileReceivingPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'done'>('pending');
  const [receiving, setReceiving] = useState<Receipt | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receiving', { cache: 'no-store' });
      const json = await res.json();
      setReceipts(json.receipts || []);
    } catch {
      toast.error('โหลดใบรับเข้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = receipts.filter(r => r.status === 'EXPECTED' || r.status === 'RECEIVING');
  const done = receipts.filter(r => r.status === 'DONE');

  // Handle Barcode Scan on main list (from Camera or PDA Laser Gun)
  const handleBarcodeScan = useCallback((code: string) => {
    const q = code.trim().toLowerCase();
    if (!q) return;

    // Look for matching pending receipt
    const match = pending.find(r =>
      r.receiptNo.toLowerCase() === q ||
      (r.poNumber && r.poNumber.toLowerCase() === q) ||
      r.items.some(it => it.sku.toLowerCase() === q || it.name.toLowerCase().includes(q))
    );

    if (match) {
      playScannerAudio('success');
      toast.success(`พบใบรับ ${match.receiptNo}`);
      setReceiving(match);
      setCameraOpen(false);
      return;
    }

    // Check done receipts
    const matchDone = done.find(r =>
      r.receiptNo.toLowerCase() === q ||
      (r.poNumber && r.poNumber.toLowerCase() === q)
    );
    if (matchDone) {
      playScannerAudio('success');
      toast(`ใบรับ ${matchDone.receiptNo} ตรวจรับเสร็จแล้ว`, { icon: 'ℹ️' });
      setActiveTab('done');
      setSearchQuery(code.trim());
      setCameraOpen(false);
      return;
    }

    playScannerAudio('error');
    setSearchQuery(code.trim());
    setCameraOpen(false);
    toast.error(`ไม่พบใบรับที่ตรงกับรหัส "${code}"`);
  }, [pending, done]);

  usePdaScanner({
    onScan: handleBarcodeScan,
    enabled: !receiving && !cameraOpen,
    playSound: false,
  });

  const filteredItems = (activeTab === 'pending' ? pending : done).filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.receiptNo.toLowerCase().includes(q) ||
      (r.poNumber && r.poNumber.toLowerCase().includes(q)) ||
      (r.supplier && r.supplier.toLowerCase().includes(q)) ||
      r.items.some(i => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="theme-nexus-hybrid min-h-screen text-slate-900 pb-28 font-sans select-none">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/mobile"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs active:scale-95 transition-all shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="font-bold text-base text-slate-900 leading-tight truncate">รับสินค้าเข้า (Inbound)</h1>
                <p className="text-[11px] text-slate-600 truncate">สแกนตรวจนับ PO และขึ้นชั้นวาง</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCameraOpen(true)}
                className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm transition-all font-mono"
              >
                <Camera className="w-4 h-4" />
                <span>สแกนกล้อง</span>
              </button>
              <button
                onClick={load}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-600 hover:text-slate-900 shadow-xs active:scale-95 transition-all"
                aria-label="รีเฟรช"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search & PDA Indicator */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเลขที่ PO, ใบรับ หรือ SKU..."
                className="w-full min-h-[44px] bg-white/90 border border-slate-200/80 rounded-full pl-10 pr-9 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="min-h-[44px] px-3 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-700 flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              PDA พร้อม
            </div>
          </div>
        </div>
      </header>

      {/* Tabs: Pending vs Done */}
      <div className="px-4 mt-3 max-w-lg mx-auto">
        <div className="nx-glass-card grid grid-cols-2 gap-1.5 p-1.5 rounded-full">
          <button
            onClick={() => setActiveTab('pending')}
            className={`min-h-[40px] py-2 text-xs font-bold rounded-full transition-all tabular-nums ${
              activeTab === 'pending'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            รอตรวจรับ ({pending.length})
          </button>
          <button
            onClick={() => setActiveTab('done')}
            className={`min-h-[40px] py-2 text-xs font-bold rounded-full transition-all tabular-nums ${
              activeTab === 'done'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            เสร็จแล้ว ({done.length})
          </button>
        </div>
      </div>

      {/* Main List */}
      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="nx-glass-card py-14 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            กำลังโหลดรายการรับเข้า...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="nx-glass-card py-14 px-6 text-center text-slate-500 space-y-2">
            <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Warehouse className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {searchQuery ? 'ไม่พบรายการที่ตรงกับการค้นหา' : activeTab === 'pending' ? 'ไม่มีใบรอตรวจรับสินค้า' : 'ยังไม่มีประวัติการรับเข้า'}
            </p>
          </div>
        ) : (
          filteredItems.map(r => {
            const totalPcs = r.items.reduce((s, it) => s + it.expectedQty, 0);
            return (
              <div
                key={r.id}
                className="nx-glass-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-900 text-base tabular-nums">
                        {r.receiptNo}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        r.status === 'EXPECTED' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        r.status === 'RECEIVING' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {r.status === 'EXPECTED' ? 'รอรับ' : r.status === 'RECEIVING' ? 'กำลังรับ' : 'เสร็จสิ้น'}
                      </span>
                    </div>
                    {r.poNumber && (
                      <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-400" /> PO: <strong className="text-slate-800 font-mono">{r.poNumber}</strong>
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-slate-500 block">ยอดคาดหวัง</span>
                    <span className="text-base font-black text-emerald-700 tabular-nums">{totalPcs}</span>
                    <span className="text-[11px] text-slate-500 ml-1">ชิ้น</span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 border-t border-slate-200/70 pt-2 flex items-center justify-between">
                  <span className="truncate max-w-[200px]">ผู้ขาย: {r.supplier || 'ไม่ระบุผู้ขาย'}</span>
                  <span className="font-semibold tabular-nums">{r.items.length} รายการ</span>
                </div>

                {r.status !== 'DONE' ? (
                  <button
                    onClick={() => setReceiving(r)}
                    className="w-full min-h-[48px] py-3 px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <Warehouse className="w-4 h-4" /> ตรวจรับ & จัดเก็บเข้าชั้นวาง
                  </button>
                ) : (
                  <div className="flex items-center justify-between pt-1 text-xs text-emerald-700">
                    <span className="flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> จัดเก็บเข้าพิกัดสต็อกเรียบร้อย
                    </span>
                    <a
                      href={`/print/putaway-slip?id=${r.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 py-1.5 rounded-full bg-white/90 border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" /> ใบจัดเก็บ
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* Mobile Receive Modal */}
      {receiving && (
        <MobileReceiveModal
          receipt={receiving}
          onClose={() => setReceiving(null)}
          onDone={() => {
            setReceiving(null);
            load();
          }}
        />
      )}

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleBarcodeScan}
        title="สแกนใบรับ / PO / SKU"
        description="ส่องกล้องไปที่บาร์โค้ดเพื่อเปิดหน้าต่างตรวจรับทันที"
      />

      {/* Bottom Sticky Navigation */}
      <MobileNav />
    </div>
  );
}

function MobileReceiveModal({
  receipt,
  onClose,
  onDone
}: {
  receipt: Receipt;
  onClose: () => void;
  onDone: () => void;
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    receipt.items.map(it => ({
      ...it,
      receivedQty: it.receivedQty ?? it.expectedQty,
      putawayBin: it.putawayBin || 'A-01-01',
      done: it.done ?? false,
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [itemScannerOpen, setItemScannerOpen] = useState(false);
  const [uomMap, setUomMap] = useState<Record<string, UomOpt[]>>({});

  // A-UI #2: load defined pack units per SKU so ยอดรับ can be entered in ลัง/พาเลท
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const skus = Array.from(new Set(receipt.items.map(i => i.sku)));
      const entries = await Promise.all(skus.map(async (s) => {
        try {
          const d = await (await fetch(`/api/products/uoms?sku=${encodeURIComponent(s)}`, { cache: 'no-store' })).json();
          return [s, Array.isArray(d.uoms) ? d.uoms : []] as const;
        } catch { return [s, []] as const; }
      }));
      if (!cancelled) setUomMap(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [receipt.id]);

  const updateUom = (idx: number, uom: string) => {
    setLines(prev => { const c = [...prev]; c[idx] = { ...c[idx], uom }; return c; });
  };

  const updateQty = (idx: number, delta: number) => {
    setLines(prev => {
      const copy = [...prev];
      const cur = copy[idx].receivedQty ?? 0;
      copy[idx] = { ...copy[idx], receivedQty: Math.max(0, cur + delta) };
      return copy;
    });
  };

  const updateBin = (idx: number, bin: string) => {
    setLines(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], putawayBin: bin };
      return copy;
    });
  };

  // Barcode scanned inside modal: find matching line and increment received qty +1
  const handleItemScan = (barcode: string) => {
    const q = barcode.trim().toLowerCase();

    // A-UI #4: a carton/pack barcode selects that unit and adds +1 of it
    for (let i = 0; i < lines.length; i++) {
      const hit = (uomMap[lines[i].sku] || []).find(u => u.barcode && u.barcode.toLowerCase() === q);
      if (hit) {
        playScannerAudio('success'); triggerHaptic('success');
        updateUom(i, hit.code);
        updateQty(i, 1);
        toast.success(`+1 ${hit.name || hit.code} (${lines[i].name})`);
        return;
      }
    }

    const idx = lines.findIndex(l => l.sku.toLowerCase() === q || l.name.toLowerCase().includes(q));

    if (idx >= 0) {
      playScannerAudio('success');
      triggerHaptic('success');
      updateQty(idx, 1);
      toast.success(`+1 ${lines[idx].name}`);
      if (lines[idx].putawayBin) {
        speakPutawayLocation(lines[idx].putawayBin);
      }
    } else {
      playScannerAudio('error');
      triggerHaptic('error');
      toast.error(`ไม่พบรหัส ${barcode} ในใบรับนี้`);
    }
  };

  usePdaScanner({
    onScan: handleItemScan,
    enabled: !itemScannerOpen,
    playSound: false,
  });

  const handleCommit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        id: receipt.id,
        lines: lines.map(l => ({
          sku: l.sku,
          receivedQty: Number(l.receivedQty || 0),
          putawayBin: l.putawayBin || 'A-01-01',
          ...(l.uom ? { uom: l.uom } : {}),
        })),
      };

      const res = await fetch('/api/receiving', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ยืนยันรับเข้าไม่สำเร็จ');

      toast.success('บันทึกรับเข้าสต็อกเรียบร้อย!');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white/95 backdrop-blur-xl border border-white/90 w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl text-slate-900">
        {/* Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
                <PackagePlus className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-slate-900 text-base truncate tabular-nums">ตรวจรับใบ {receipt.receiptNo}</h3>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 truncate">
              {receipt.poNumber ? `PO: ${receipt.poNumber} · ` : ''}{receipt.supplier || 'ไม่ระบุผู้ขาย'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setItemScannerOpen(true)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 shadow-xs"
              title="สแกนกล้องตรวจรับ"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Line Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {lines.map((l, idx) => (
            <div
              key={l.sku}
              className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-900">{l.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">SKU: {l.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-500 block">สั่งมา</span>
                  <span className="text-sm font-black text-slate-700 tabular-nums">{l.expectedQty} ชิ้น</span>
                </div>
              </div>

              {/* Quantity Stepper (1-Thumb Friendly) */}
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-600">ยอดรับจริง:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQty(idx, -1)}
                    className="w-10 h-10 rounded-full bg-slate-100 active:bg-slate-200 text-slate-900 flex items-center justify-center font-black"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={l.receivedQty ?? 0}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      setLines(prev => {
                        const copy = [...prev];
                        copy[idx] = { ...copy[idx], receivedQty: Math.max(0, val) };
                        return copy;
                      });
                    }}
                    className="w-16 h-10 bg-slate-50 border border-slate-200 rounded-xl text-center font-black font-mono text-emerald-700 text-base tabular-nums focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => updateQty(idx, 1)}
                    className="w-10 h-10 rounded-full bg-emerald-600 active:bg-emerald-500 text-white flex items-center justify-center font-black"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updateQty(idx, 5)}
                    className="px-2.5 h-10 rounded-full bg-slate-100 active:bg-slate-200 text-xs font-bold text-slate-700 tabular-nums"
                  >
                    +5
                  </button>
                </div>
              </div>

              {/* A-UI #2: Unit selector (base + defined pack units) */}
              {(uomMap[l.sku]?.length || 0) > 1 && (
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="text-xs font-semibold text-slate-600">หน่วยที่รับ:</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={l.uom || (uomMap[l.sku]?.find(u => u.isBase)?.code || '')}
                      onChange={e => updateUom(idx, e.target.value)}
                      className="h-9 bg-white border border-slate-200 rounded-full px-3 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      {uomMap[l.sku]?.map(u => (
                        <option key={u.code} value={u.code}>{u.name || u.code}{!u.isBase ? ` (×${u.factor})` : ''}</option>
                      ))}
                    </select>
                    {(() => {
                      const sel = uomMap[l.sku]?.find(u => u.code === (l.uom || uomMap[l.sku]?.find(x => x.isBase)?.code));
                      const base = uomMap[l.sku]?.find(u => u.isBase);
                      if (sel && !sel.isBase) return <span className="text-[11px] text-emerald-700 font-mono tabular-nums">= {(Number(l.receivedQty || 0) * sel.factor)} {base?.name || 'ชิ้น'}</span>;
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {/* Putaway Bin Coordinates with Multi-Bin Quick Selection */}
              <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>พิกัดจัดเก็บ (Putaway Bin):</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={l.putawayBin || ''}
                      onChange={e => updateBin(idx, e.target.value.toUpperCase())}
                      placeholder="เช่น A-01-01"
                      className="w-24 py-1.5 px-2.5 text-center text-xs font-mono font-bold bg-white border border-slate-200 rounded-full text-emerald-700 focus:outline-none focus:border-emerald-500 uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => speakPutawayLocation(l.putawayBin || 'A-01')}
                      className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                      title="ฟังเสียงพิกัด"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <BinQuickSelect
                  sku={l.sku}
                  selectedBin={l.putawayBin || ''}
                  onSelectBin={bin => updateBin(idx, bin)}
                  mode="putaway"
                  theme="light"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200/80 shrink-0 space-y-2 bg-white/95">
          <button
            onClick={handleCommit}
            disabled={submitting}
            className="w-full min-h-[48px] py-3.5 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            {submitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <span>ยืนยันรับเข้าสต็อก & จัดเก็บ</span>
          </button>
        </div>
      </div>

      {/* Item Barcode Scanner */}
      <CameraScannerModal
        isOpen={itemScannerOpen}
        onClose={() => setItemScannerOpen(false)}
        onScan={handleItemScan}
        title="สแกนกล่องรับของ (+1)"
        description="ส่องกล้องไปที่บาร์โค้ดบนกล่องพัสดุ ยอดรับจะเพิ่มขึ้นอัตโนมัติ"
        continuous={true}
      />
    </div>
  );
}
