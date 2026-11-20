'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Loader2,
  ClipboardCheck,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Barcode,
  MapPin,
  Printer,
  Camera,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { toast } from 'react-hot-toast';
import { triggerHaptic } from '@/lib/voiceAssistant';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';
import { errorMessage } from '@/lib/errors';

interface CountItem {
  sku: string;
  productName: string;
  location: string;
  systemQty: number;
  actualQty: string;
  variance: number;
  status: 'pending' | 'match' | 'variance';
}

export default function CycleCountPage() {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0]);
  const [countNote, setCountNote] = useState('');
  const [showCountCam, setShowCountCam] = useState(false);
  const [lastSavedVariances, setLastSavedVariances] = useState<number>(0);

  // Enterprise Feature: Blind Cycle Count Mode
  const [isBlindCount, setIsBlindCount] = useState(true);
  const [showOnlyVariance, setShowOnlyVariance] = useState(false);

  // Fast Barcode Scan in Count
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Load products with current stock
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch(getApiUrl('/api/products'));
        const data = await res.json();
        setProducts(data);

        // Initialize count items
        const items: CountItem[] = data.map((p: any) => ({
          sku: p.id || p.name,
          productName: p.name || p.id,
          location: p.location || '-',
          systemQty: p.stock || 0,
          actualQty: '',
          variance: 0,
          status: 'pending' as const,
        }));
        setCountItems(items);
      } catch (e) {
        console.error('Load products error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  // Update an item's actual count
  const updateActualQty = (sku: string, value: string) => {
    setCountItems(prev =>
      prev.map(item => {
        if (item.sku === sku) {
          const actual = parseInt(value) || 0;
          const variance = actual - item.systemQty;
          let status: 'pending' | 'match' | 'variance' = 'pending';
          if (value !== '') {
            status = variance === 0 ? 'match' : 'variance';
          }
          return { ...item, actualQty: value, variance, status };
        }
        return item;
      })
    );
  };

  // Shared shelf count scanner for both PDA Gun and Mobile Camera
  const handleItemCountScan = (scanned: string) => {
    const q = scanned.trim().toLowerCase();
    const found = countItems.find(
      it =>
        it.sku.toLowerCase() === q ||
        it.productName.toLowerCase() === q ||
        it.location.toLowerCase() === q
    );

    if (found) {
      const current = parseInt(found.actualQty) || 0;
      const next = current + 1;
      updateActualQty(found.sku, next.toString());
      triggerHaptic('success');
      toast.success(`นับเพิ่ม ${found.productName || found.sku}: ${next} ชิ้น`);
    } else {
      triggerHaptic('error');
      toast.error(`ไม่พบสินค้าสำหรับโค้ด: ${scanned}`);
    }
  };

  // Wireless / PDA Scanner Gun auto-increment on shelf scan
  usePdaScanner({
    enabled: countItems.length > 0,
    onScan: handleItemCountScan,
  });

  // Quick Barcode Scan increment
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const query = barcodeInput.trim().toLowerCase();
    const target = countItems.find(
      i =>
        i.sku.toLowerCase() === query ||
        i.productName.toLowerCase() === query ||
        i.location.toLowerCase() === query
    );

    if (target) {
      const currentVal = parseInt(target.actualQty) || 0;
      updateActualQty(target.sku, (currentVal + 1).toString());
      triggerHaptic('success');
      toast.success(`นับเพิ่ม: ${target.productName || target.sku} (${currentVal + 1})`);
      setBarcodeInput('');
    } else {
      triggerHaptic('error');
      toast.error(`ไม่พบสินค้าสำหรับโค้ด: ${barcodeInput}`);
      setBarcodeInput('');
    }
  };

  // Calculate summary
  const summary = {
    total: countItems.length,
    counted: countItems.filter(i => i.actualQty !== '').length,
    matches: countItems.filter(i => i.status === 'match').length,
    variances: countItems.filter(i => i.status === 'variance').length,
  };

  // Save cycle count results
  const handleSave = async () => {
    setSaving(true);
    try {
      const countedItems = countItems.filter(i => i.actualQty !== '');

      const res = await fetch(getApiUrl('/api/cycle-count'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: countDate,
          note: countNote,
          items: countedItems.map(i => ({
            sku: i.sku,
            product_name: i.productName || i.sku,
            location: i.location,
            system_qty: i.systemQty,
            actual_qty: parseInt(i.actualQty),
            systemQty: i.systemQty,
            actualQty: parseInt(i.actualQty),
            variance: i.variance,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save');
      const result = await res.json();
      const adjCount = result.adjustmentsCreated ?? summary.variances;
      setLastSavedVariances(adjCount);

      triggerHaptic('success');
      if (adjCount > 0) {
        toast.success(
          `บันทึก Cycle Count ${summary.counted} รายการเรียบร้อย! ส่งรายการผลต่าง ${adjCount} รายการเข้าคิวอนุมัติ Maker-Checker (/ops/adjustments) อัตโนมัติ`
        );
      } else {
        toast.success(`บันทึก Cycle Count ${summary.counted} รายการเรียบร้อย!`);
      }
    } catch (e) {
      toast.error('Error: ' + errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // Filter display
  const displayItems = useMemo(() => {
    return showOnlyVariance ? countItems.filter(i => i.status === 'variance') : countItems;
  }, [countItems, showOnlyVariance]);

  if (loading) {
    return (
      <div className="theme-nexus-hybrid min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-20 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1500px] mx-auto relative z-10 space-y-6">
        {/* Open Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> กลับ Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Counting Workstation
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <ClipboardCheck className="w-7 h-7 text-emerald-600 shrink-0" />
                <span>Cycle Count &amp; Blind Audit</span>
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm font-medium mt-0.5">
                ตรวจนับสต๊อกจริง • โหมด Blind Count ปิดยอดในระบบป้องกันความเอนเอียง • บันทึกผลต่าง (Variance)
              </p>
            </div>

            {/* Actions: Print and Blind Count Switch */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <a
                href="/print/cycle-count"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-full font-semibold text-xs flex items-center gap-2 border border-white/90 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 transition-all shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                พิมพ์รายงานผลตรวจนับ
              </a>
              <button
                type="button"
                onClick={() => {
                  setIsBlindCount(!isBlindCount);
                  toast.success(isBlindCount ? 'ปิดโหมด Blind (แสดงยอดในระบบ)' : 'เปิดโหมด Blind Count (ซ่อนยอดระบบ)');
                }}
                className={`px-4 py-2 rounded-full font-semibold text-xs flex items-center gap-2 border transition-all shadow-xs ${
                  isBlindCount
                    ? 'bg-slate-900 text-amber-300 border-slate-900'
                    : 'bg-white/80 text-slate-700 border-white/90 hover:bg-white'
                }`}
              >
                {isBlindCount ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                {isBlindCount ? 'โหมด Blind Count: เปิด (ซ่อนยอด)' : 'โหมดปกติ (แสดงยอด)'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="nx-glass-card p-5 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">{summary.total.toLocaleString()}</p>
            <p className="text-xs font-semibold text-slate-600 mt-1">สินค้าทั้งหมด</p>
          </div>
          <div className="nx-glass-card p-5 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-sky-700 tabular-nums">{summary.counted.toLocaleString()}</p>
            <p className="text-xs font-semibold text-sky-700 mt-1">นับแล้ว</p>
          </div>
          <div className="nx-glass-card p-5 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">
              {isBlindCount ? '🔒' : summary.matches.toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-emerald-700 mt-1">✓ ตรงกัน</p>
          </div>
          <div className="nx-dark-accent-card p-5 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-rose-400 tabular-nums">
              {isBlindCount ? '🔒' : summary.variances.toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-slate-300 mt-1">⚠ มีผลต่าง</p>
          </div>
        </div>

        {/* Barcode Quick Count Bar */}
        <div className="nx-glass-card p-4">
          <form onSubmit={handleBarcodeScan} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={barcodeRef}
                type="text"
                placeholder="สแกนบาร์โค้ดสินค้าหรือพิกัด เพื่อเพิ่มยอดนับทีละ 1 (+1)..."
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/85 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <button
                type="button"
                onClick={() => setShowCountCam(true)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>เปิดกล้องสแกน</span>
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full text-xs transition-colors shrink-0 shadow-xs"
              >
                สแกนบาร์โค้ด
              </button>
              <div className="hidden sm:inline-flex items-center gap-1 px-3 py-2 bg-amber-500/15 text-amber-800 text-[11px] font-bold rounded-full border border-amber-500/25 shrink-0">
                <Zap className="w-3 h-3 text-amber-600" />
                <span>PDA พร้อม</span>
              </div>
            </div>
          </form>
        </div>

        {/* Info & Actions */}
        <div className="nx-glass-card flex flex-wrap gap-4 items-center justify-between p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="date"
              value={countDate}
              onChange={e => setCountDate(e.target.value)}
              className="px-3.5 py-2 border border-slate-200 rounded-xl bg-white/85 font-semibold text-xs text-slate-900 tabular-nums outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={countNote}
              onChange={e => setCountNote(e.target.value)}
              placeholder="หมายเหตุรอบตรวจนับ (ถ้ามี)"
              className="px-3.5 py-2 border border-slate-200 rounded-xl w-60 bg-white/85 font-medium text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2.5">
            {!isBlindCount && (
              <button
                onClick={() => setShowOnlyVariance(!showOnlyVariance)}
                className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                  showOnlyVariance
                    ? 'bg-rose-500/12 text-rose-700 border-rose-500/25'
                    : 'bg-white/80 text-slate-700 border-slate-200 hover:bg-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                แสดงเฉพาะผลต่าง
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving || summary.counted === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full text-xs flex items-center gap-2 disabled:opacity-50 transition-all shadow-xs"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกผลการนับ
            </button>
          </div>
        </div>

        {lastSavedVariances > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/12 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                ระบบได้ส่งรายการที่มีผลต่าง (<span className="tabular-nums font-bold">{lastSavedVariances}</span> รายการ) ไปยังคิวขออนุมัติปรับยอดสต็อก (Maker-Checker Adjustments) เรียบร้อยแล้ว
              </span>
            </div>
            <Link
              href="/ops/adjustments"
              className="px-4 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold transition shrink-0 text-center shadow-xs"
            >
              ไปที่ Maker-Checker Adjustments →
            </Link>
          </div>
        )}

        {/* Count Table Container */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="nx-glass-card overflow-hidden"
        >
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto max-h-[60vh]">
            <table className="w-full text-sm text-slate-700">
              <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200/80 sticky top-0 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="text-left px-4 py-3.5 w-1/3">สินค้า</th>
                  <th className="text-left px-4 py-3.5">พิกัดจัดเก็บ</th>
                  <th className="text-right px-4 py-3.5">
                    {isBlindCount ? 'ยอดในระบบ (Blind)' : 'ยอดในระบบ'}
                  </th>
                  <th className="text-center px-4 py-3.5 w-32">นับจริง</th>
                  <th className="text-right px-4 py-3.5">ผลต่าง</th>
                  <th className="text-center px-4 py-3.5">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayItems.map(item => (
                  <tr key={item.sku} className="hover:bg-emerald-50/35 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.sku}</td>
                    <td className="px-4 py-3 text-left">
                      <span className="bg-slate-100 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold text-slate-700 border border-slate-200/80 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" /> {item.location}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 tabular-nums">
                      {isBlindCount ? (
                        <span className="text-slate-400 italic font-sans font-medium">🔒 ซ่อนไว้</span>
                      ) : (
                        item.systemQty.toLocaleString()
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.actualQty}
                        onChange={e => updateActualQty(item.sku, e.target.value)}
                        placeholder="กรอกยอดนับ"
                        className="w-full text-center px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-900 font-mono font-bold text-xs tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                      />
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${
                        isBlindCount
                          ? 'text-slate-400'
                          : item.variance > 0
                          ? 'text-emerald-700'
                          : item.variance < 0
                          ? 'text-rose-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {isBlindCount ? (
                        <span className="text-slate-400">🔒</span>
                      ) : item.actualQty !== '' ? (
                        item.variance > 0 ? (
                          `+${item.variance}`
                        ) : (
                          item.variance
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.actualQty !== '' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-500/12 text-sky-700 border border-sky-500/20 rounded-full text-[11px] font-bold">
                          <Check className="w-3 h-3" /> นับแล้ว
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-medium">รอนับ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="block md:hidden space-y-3 max-h-[60vh] overflow-y-auto p-3">
            {displayItems.map(item => (
              <div
                key={item.sku}
                className="bg-white/85 border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-slate-900 text-sm">{item.sku}</div>
                  <div>
                    {item.actualQty !== '' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-500/12 text-sky-700 border border-sky-500/20 rounded-full text-[11px] font-bold">
                        <Check className="w-3 h-3" /> นับแล้ว
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px] bg-slate-100 px-2.5 py-0.5 rounded-full font-semibold">
                        รอนับ
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 items-center text-xs text-slate-600">
                  <span className="bg-slate-100 px-2.5 py-0.5 rounded-full font-mono font-semibold border border-slate-200/80 text-slate-700">
                    📍 {item.location}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 items-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">
                      {isBlindCount ? 'ยอดในระบบ (Blind)' : 'ยอดในระบบ'}
                    </span>
                    <span className="font-bold text-slate-800 text-sm tabular-nums">
                      {isBlindCount ? '🔒 ซ่อนไว้' : item.systemQty.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">นับจริง (Actual)</span>
                    <input
                      type="number"
                      value={item.actualQty}
                      onChange={e => updateActualQty(item.sku, e.target.value)}
                      placeholder="กรอกยอด"
                      className="w-full text-center px-2 py-1.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-900 text-sm tabular-nums outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Embedded Camera Scanner for Continuous Stock Audit */}
      <CameraScannerModal
        isOpen={showCountCam}
        onClose={() => setShowCountCam(false)}
        onScan={handleItemCountScan}
        continuous={true}
        title="สแกนตรวจนับสต็อก (Cycle Count)"
        description="ส่องกล้องไปที่บาร์โค้ดสินค้าบนเชลฟ์เพื่อเพิ่มยอดนับทีละ 1 ชิ้นอัตโนมัติ (สแกนต่อเนื่องได้)"
      />
    </div>
  );
}
