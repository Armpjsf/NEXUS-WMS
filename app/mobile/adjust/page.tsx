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
    <div className="min-h-screen bg-slate-900 text-white pb-28 max-w-md mx-auto font-sans select-none">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#171c23] px-4 py-3 border-b border-slate-800 shadow-lg flex items-center justify-between">
        <Link
          href="/mobile"
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-bold tracking-wide">ปรับสต็อกด่วน (Quick Adjust)</h1>
        <Link
          href="/mobile/adjustments"
          className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          title="หน้าอนุมัติปรับสต็อก"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>อนุมัติ</span>
        </Link>
      </header>

      <div className="p-4">
        {successInfo ? (
          <div className="mt-8 p-6 bg-emerald-500/15 border border-emerald-500/40 rounded-3xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div className="space-y-1">
              <div className="font-bold text-base text-emerald-300">
                ส่งคำขอปรับสต็อก {successInfo.requestNo} สำเร็จ!
              </div>
              <p className="text-xs text-slate-300">
                รายการ <strong className="text-white">{successInfo.sku}</strong> (ยอดนับจริง:{' '}
                <strong className="text-emerald-300">{successInfo.newTotal} ชิ้น</strong>)
                ถูกส่งเข้าคิว Maker-Checker เพื่อรอหัวหน้าคลังอนุมัติแล้ว
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/mobile/adjustments"
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg"
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
                className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                ปรับสต็อกรายการอื่นต่อ
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Scan Barcode / Input SKU */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
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
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-mono text-white focus:outline-none focus:border-cyan-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="mt-1.5 bg-slate-800 border border-slate-700 rounded-2xl divide-y divide-slate-700/60 overflow-hidden">
                  {suggestions.map(item => (
                    <button
                      key={item.id || item.sku || item.name}
                      type="button"
                      onClick={() => selectProduct(item)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-700/60 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-white truncate">{item.name}</span>
                      <span className="font-mono text-cyan-400 shrink-0 ml-2">
                        {item.sku || item.id} ({item.stock ?? 0})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {productName && (
              <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">ชื่อสินค้า</div>
                    <div className="text-sm font-bold text-white">{productName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">สต็อกในพิกัดนี้</div>
                    <div className="text-base font-black text-cyan-400">{currentStock ?? 0} ชิ้น</div>
                  </div>
                </div>

                {/* Bin / Location Selector */}
                <div className="pt-2 border-t border-slate-700/70">
                  <label className="block text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
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
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
                            locationCode === b.binCode
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
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
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white uppercase"
                    />
                  )}
                </div>

                {/* Adjustment Controller */}
                <div className="pt-2 border-t border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">จำนวนปรับยอด (+ เพิ่ม / - ลด)</div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setAdjustQty(prev => prev - 1)}
                      className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/40 font-black text-xl flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    <div className="text-center">
                      <div className="text-2xl font-black tabular-nums">
                        {adjustQty > 0 ? `+${adjustQty}` : adjustQty}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        สต็อกหลังปรับ: <span className="text-emerald-400 font-bold">{newStock}</span> ชิ้น
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAdjustQty(prev => prev + 1)}
                      className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 font-black text-xl flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="grid grid-cols-4 gap-1.5 mt-3">
                    {[-10, -5, +5, +10].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAdjustQty(prev => prev + val)}
                        className="py-1.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-xs font-bold text-slate-300 active:scale-95"
                      >
                        {val > 0 ? `+${val}` : val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                สาเหตุการปรับยอด
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-semibold text-white focus:outline-none"
              >
                <option value="นับสต็อกหน้างาน (Recount)">นับสต็อกหน้างาน (Recount)</option>
                <option value="พบสินค้าชำรุด (Damage)">พบสินค้าชำรุด (Damage)</option>
                <option value="เบิกตัวอย่าง (Sample)">เบิกตัวอย่าง (Sample)</option>
                <option value="สินค้าหาย / สต็อกไม่ตรง">สินค้าหาย / สต็อกไม่ตรง</option>
                <option value="ปรับปรุงยอดตามรอบตรวจนับ">ปรับปรุงยอดตามรอบตรวจนับ</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                หมายเหตุเพิ่มเติม
              </label>
              <input
                type="text"
                placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!sku.trim() || adjustQty === 0 || submitting}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-cyan-500/25 active:scale-98 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
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
