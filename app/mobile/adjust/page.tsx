'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Scan,
  CheckCircle2,
  Plus,
  Minus,
  Save,
  ClipboardCheck,
  MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface ProductLookup {
  id?: string;
  sku?: string;
  name: string;
  barcode?: string;
  stock?: number;
  location?: string;
  unit?: string;
}

interface BinInfo {
  binCode: string;
  quantity: number;
  lotNo?: string;
}

export default function MobileAdjustPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<ProductLookup[]>([]);
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [locationCode, setLocationCode] = useState('UNASSIGNED');
  const [bins, setBins] = useState<BinInfo[]>([]);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [reason, setReason] = useState('นับสต็อกหน้างาน (Recount)');
  const [notes, setNotes] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ requestNo: string; sku: string; newTotal: number } | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/products'), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProducts(data);
      }
    } catch (err) {
      console.warn('Failed to load products:', err);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const loadBinsForSku = useCallback(async (targetSku: string, fallbackStock: number, fallbackLoc: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/stock/bins?sku=${encodeURIComponent(targetSku)}`), {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const binList: BinInfo[] = Array.isArray(data.bins) ? data.bins : [];
        setBins(binList);
        if (binList.length > 0) {
          setLocationCode(binList[0].binCode);
          setCurrentStock(binList[0].quantity);
          return;
        }
      }
    } catch {
      /* fallback to product stock */
    }
    setBins([]);
    setLocationCode(fallbackLoc || 'UNASSIGNED');
    setCurrentStock(fallbackStock);
  }, []);

  const selectProduct = useCallback(
    (prod: ProductLookup) => {
      const resolvedSku = prod.sku || prod.id || prod.name;
      const stockNum = Number(prod.stock ?? 0);
      const loc = prod.location && prod.location !== '-' ? prod.location : 'UNASSIGNED';
      setSku(resolvedSku);
      setProductName(prod.name);
      setCurrentStock(stockNum);
      setLocationCode(loc);
      setAdjustQty(0);
      loadBinsForSku(resolvedSku, stockNum, loc);
    },
    [loadBinsForSku]
  );

  const handleScan = (code: string) => {
    const clean = code.trim();
    setCameraOpen(false);
    if (!clean) return;
    const q = clean.toLowerCase();
    const match = products.find(
      p =>
        (p.sku || '').toLowerCase() === q ||
        (p.id || '').toLowerCase() === q ||
        (p.barcode || '').toLowerCase() === q ||
        (p.name || '').toLowerCase() === q
    );
    if (match) {
      playScannerAudio('success');
      selectProduct(match);
    } else {
      playScannerAudio('error');
      setSku(clean);
      setProductName(clean);
      setCurrentStock(0);
      setLocationCode('UNASSIGNED');
      setAdjustQty(0);
      loadBinsForSku(clean, 0, 'UNASSIGNED');
    }
  };

  usePdaScanner({
    onScan: handleScan,
    enabled: !cameraOpen && !successInfo,
    playSound: false,
  });

  const newStock = Math.max(0, (currentStock ?? 0) + adjustQty);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      toast.error('กรุณาระบุ SKU หรือสแกนบาร์โค้ด');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/adjustments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: sku.trim(),
          productName: productName.trim() || sku.trim(),
          locationCode: locationCode || 'UNASSIGNED',
          systemQty: currentStock ?? 0,
          countedQty: Number(newStock),
          reasonCode: reason,
          notes: notes.trim(),
          requestedBy: session?.user?.name || 'Mobile Operator',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ส่งคำขอปรับสต็อกไม่สำเร็จ');
      }

      const reqNo = data.data?.requestNo || 'ADJ-NEW';
      toast.success(data.message || `ส่งคำขอปรับสต็อก ${reqNo} สำเร็จ`);
      setSuccessInfo({
        requestNo: reqNo,
        sku: productName || sku,
        newTotal: newStock,
      });
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการส่งคำขอปรับสต็อก');
    } finally {
      setSubmitting(false);
    }
  };

  const suggestions = sku.trim()
    ? products
        .filter(p => {
          const q = sku.toLowerCase();
          return (
            ((p.name || '').toLowerCase().includes(q) ||
              (p.sku || '').toLowerCase().includes(q) ||
              (p.id || '').toLowerCase().includes(q)) &&
            (p.sku || p.id || p.name) !== sku
          );
        })
        .slice(0, 5)
    : [];

  return (
    <div className="min-h-screen text-slate-900 pb-28 max-w-md mx-auto font-sans select-none">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl px-4 py-3 border-b border-white/85 shadow-sm flex items-center justify-between">
        <Link
          href="/mobile"
          className="min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/90 border border-slate-200 text-slate-700 hover:text-slate-900 active:scale-95 transition-transform flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-bold tracking-tight text-slate-900">ปรับสต็อกด่วน (Quick Adjust)</h1>
        <Link
          href="/mobile/adjustments"
          className="min-h-[40px] px-3 py-1.5 rounded-full bg-sky-500/12 border border-sky-500/25 text-xs font-bold text-sky-700 hover:bg-sky-500/20 flex items-center gap-1"
          title="หน้าอนุมัติปรับสต็อก"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>อนุมัติ</span>
        </Link>
      </header>

      <div className="p-4">
        {successInfo ? (
          <div className="nx-glass-card mt-6 p-6 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <div className="font-bold text-base text-emerald-700">
                ส่งคำขอปรับสต็อก {successInfo.requestNo} สำเร็จ!
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                รายการ <strong className="text-slate-900">{successInfo.sku}</strong> (ยอดนับจริง:{' '}
                <strong className="text-emerald-700 tabular-nums">{successInfo.newTotal} ชิ้น</strong>)
                ถูกส่งเข้าคิว Maker-Checker เพื่อรอหัวหน้าคลังอนุมัติแล้ว
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Link
                href="/mobile/adjustments"
                className="w-full min-h-[48px] py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>ไปหน้าอนุมัติปรับสต็อก (Supervisor Approval)</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSuccessInfo(null);
                  setSku('');
                  setProductName('');
                  setCurrentStock(null);
                  setAdjustQty(0);
                  setNotes('');
                }}
                className="w-full min-h-[44px] py-2.5 rounded-full bg-white/90 border border-slate-200 hover:bg-white text-slate-700 font-bold text-xs"
              >
                ปรับสต็อกรายการอื่นต่อ
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Scan Barcode / Input SKU */}
            <div className="nx-glass-card p-4 space-y-2">
              <label className="block text-xs font-bold text-slate-600">
                สแกนบาร์โค้ด หรือ ระบุ SKU *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="เช่น SKU-001 หรือพิมพ์ชื่อสินค้า"
                  value={sku}
                  onChange={e => {
                    const val = e.target.value;
                    setSku(val);
                    const match = products.find(
                      p =>
                        (p.sku || '').toLowerCase() === val.trim().toLowerCase() ||
                        (p.id || '').toLowerCase() === val.trim().toLowerCase() ||
                        (p.name || '').toLowerCase() === val.trim().toLowerCase()
                    );
                    if (match) {
                      selectProduct(match);
                    } else if (val.trim()) {
                      setProductName(val.trim());
                      if (currentStock === null) setCurrentStock(0);
                    } else {
                      setProductName('');
                      setCurrentStock(null);
                    }
                  }}
                  className="flex-1 min-h-[48px] px-4 py-3 bg-white/90 border border-slate-200 rounded-2xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="min-h-[48px] px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform shadow-sm"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="mt-1.5 bg-white/95 border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-sm">
                  {suggestions.map(item => (
                    <button
                      key={item.id || item.sku || item.name}
                      type="button"
                      onClick={() => selectProduct(item)}
                      className="w-full min-h-[44px] text-left px-3.5 py-2.5 hover:bg-emerald-50/60 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-900 truncate">{item.name}</span>
                      <span className="font-mono text-emerald-700 tabular-nums shrink-0 ml-2 font-semibold">
                        {item.sku || item.id} ({item.stock ?? 0})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {productName && (
              <div className="nx-glass-card p-4 space-y-4">
                {/* Hero Target Readout */}
                <div className="nx-dark-accent-card p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">ชื่อสินค้า</div>
                    <div className="text-sm font-bold text-white truncate mt-0.5">{productName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">สต็อกในพิกัดนี้</div>
                    <div className="text-lg font-black text-emerald-300 tabular-nums">{currentStock ?? 0} ชิ้น</div>
                  </div>
                </div>

                {/* Bin / Location Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>พิกัดชั้นวาง (Bin Location):</span>
                  </label>
                  {bins.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {bins.map(b => (
                        <button
                          key={`${b.binCode}-${b.lotNo || ''}`}
                          type="button"
                          onClick={() => {
                            setLocationCode(b.binCode);
                            setCurrentStock(b.quantity);
                            setAdjustQty(0);
                          }}
                          className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-mono font-bold border tabular-nums transition-all ${
                            locationCode === b.binCode
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                              : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-white'
                          }`}
                        >
                          {b.binCode} ({b.quantity})
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={locationCode}
                      onChange={e => setLocationCode(e.target.value.toUpperCase())}
                      className="w-full min-h-[44px] px-3.5 py-2 bg-white/90 border border-slate-200 rounded-2xl text-xs font-mono text-slate-900 uppercase outline-none focus:border-emerald-500"
                    />
                  )}
                </div>

                {/* Adjustment Controller */}
                <div className="pt-3 border-t border-slate-200/80">
                  <div className="text-xs font-semibold text-slate-600 mb-2.5">จำนวนปรับยอด (+ เพิ่ม / - ลด)</div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setAdjustQty(prev => prev - 1)}
                      className="w-12 h-12 rounded-full bg-rose-500/12 text-rose-700 border border-rose-500/25 font-black text-xl flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    <div className="text-center">
                      <div className="text-3xl font-black text-slate-900 tabular-nums">
                        {adjustQty > 0 ? `+${adjustQty}` : adjustQty}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        สต็อกหลังปรับ: <span className="text-emerald-700 font-bold">{newStock}</span> ชิ้น
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAdjustQty(prev => prev + 1)}
                      className="w-12 h-12 rounded-full bg-emerald-500/12 text-emerald-700 border border-emerald-500/25 font-black text-xl flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[-10, -5, +5, +10].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAdjustQty(prev => prev + val)}
                        className="min-h-[40px] py-2 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-xs font-bold text-slate-800 tabular-nums active:scale-95 transition-all"
                      >
                        {val > 0 ? `+${val}` : val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Reason & Notes */}
            <div className="nx-glass-card p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  สาเหตุการปรับยอด
                </label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-3 bg-white/90 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="นับสต็อกหน้างาน (Recount)">นับสต็อกหน้างาน (Recount)</option>
                  <option value="พบสินค้าชำรุด (Damage)">พบสินค้าชำรุด (Damage)</option>
                  <option value="เบิกตัวอย่าง (Sample)">เบิกตัวอย่าง (Sample)</option>
                  <option value="สินค้าหาย / สต็อกไม่ตรง">สินค้าหาย / สต็อกไม่ตรง</option>
                  <option value="ปรับปรุงยอดตามรอบตรวจนับ">ปรับปรุงยอดตามรอบตรวจนับ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-3 bg-white/90 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!sku.trim() || adjustQty === 0 || submitting}
              className="w-full min-h-[50px] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-sm shadow-lg shadow-emerald-600/25 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอปรับยอดสต็อก (Maker-Checker)'}</span>
            </button>
          </form>
        )}
      </div>

      {cameraOpen && (
        <CameraScannerModal
          isOpen={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onScan={handleScan}
        />
      )}

      <MobileNav />
    </div>
  );
}
