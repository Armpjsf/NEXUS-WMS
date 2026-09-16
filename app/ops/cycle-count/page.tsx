'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Loader2,
  ClipboardCheck,
  Check,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Barcode,
  Sparkles,
  MapPin,
  Printer,
  Camera,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { toast } from 'react-hot-toast';
import { triggerHaptic } from '@/lib/voiceAssistant';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';

interface CountItem {
  sku: string;
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
          sku: p.name,
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
      it => it.sku.toLowerCase() === q || it.location.toLowerCase() === q
    );

    if (found) {
      const current = parseInt(found.actualQty) || 0;
      const next = current + 1;
      updateActualQty(found.sku, next.toString());
      triggerHaptic('success');
      toast.success(`นับเพิ่ม ${found.sku}: ${next} ชิ้น`);
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
      i => i.sku.toLowerCase() === query || i.location.toLowerCase() === query
    );

    if (target) {
      const currentVal = parseInt(target.actualQty) || 0;
      updateActualQty(target.sku, (currentVal + 1).toString());
      triggerHaptic('success');
      toast.success(`นับเพิ่ม: ${target.sku} (${currentVal + 1})`);
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
            systemQty: i.systemQty,
            actualQty: parseInt(i.actualQty),
            variance: i.variance,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      triggerHaptic('success');
      toast.success(`บันทึก Cycle Count ${summary.counted} รายการเรียบร้อย!`);
    } catch (e: any) {
      toast.error('Error: ' + e.message);
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
      <div className="min-h-screen flex items-center justify-center bg-[#1b2027]">
        <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-4 py-6 pb-20 sm:px-6 lg:p-8 bg-[#1b2027]">
      <AmbientBackground />

      <div className="max-w-[1500px] mx-auto relative z-10 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-[#30353d] bg-[#171c23] px-3 py-2 text-xs font-bold text-[#d1c6ab] shadow-sm transition-colors hover:bg-teal-500/10 hover:text-teal-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> กลับ Dashboard
          </Link>

          <div className="relative overflow-hidden rounded-[1.75rem] border border-teal-500/30 bg-[#171c23] p-6 shadow-xl shadow-teal-900/5 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-amber-500" />
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-teal-600 to-emerald-600 rounded-2xl shadow-lg text-white">
                <ClipboardCheck className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-700">
                  Counting Workstation
                </p>
                <h1 className="text-2xl sm:text-3xl font-black text-[#dee2ec] tracking-tight">
                  Cycle Count & Blind Audit
                </h1>
                <p className="text-[#8a92a6] text-xs mt-0.5">
                  ตรวจนับสต๊อกจริง • โหมด Blind Count ปิดยอดในระบบป้องกันความเอนเอียง • บันทึกผลต่าง (Variance)
                </p>
              </div>
            </div>

            {/* Actions: Print and Blind Count Switch */}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="/print/cycle-count"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 border border-[#30353d] bg-[#171c23] text-[#d1c6ab] hover:bg-[#1b2027] transition-all shadow-sm"
              >
                <Printer className="w-4 h-4 text-[#8a92a6]" />
                พิมพ์รายงานผลตรวจนับ
              </a>
              <button
                type="button"
                onClick={() => {
                  setIsBlindCount(!isBlindCount);
                  toast.success(isBlindCount ? 'ปิดโหมด Blind (แสดงยอดในระบบ)' : 'เปิดโหมด Blind Count (ซ่อนยอดระบบ)');
                }}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 border transition-all ${
                  isBlindCount
                    ? 'bg-slate-900 text-amber-300 border-slate-800 shadow-md font-black'
                    : 'bg-[#171c23] text-[#d1c6ab] border-[#30353d] hover:bg-[#1b2027]'
                }`}
              >
                {isBlindCount ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                {isBlindCount ? 'โหมด Blind Count: เปิด (ซ่อนยอด)' : 'โหมดปกติ (แสดงยอด)'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="bg-[#171c23] border border-[#30353d] rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl sm:text-3xl font-black text-[#dee2ec]">{summary.total}</p>
            <p className="text-xs text-[#8a92a6] mt-0.5">สินค้าทั้งหมด</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl sm:text-3xl font-black text-blue-600">{summary.counted}</p>
            <p className="text-xs text-blue-600 mt-0.5">นับแล้ว</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl sm:text-3xl font-black text-emerald-600">
              {isBlindCount ? '🔒' : summary.matches}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">✓ ตรงกัน</p>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl sm:text-3xl font-black text-rose-600">
              {isBlindCount ? '🔒' : summary.variances}
            </p>
            <p className="text-xs text-rose-600 mt-0.5">⚠ มีผลต่าง</p>
          </div>
        </div>

        {/* Barcode Quick Count Bar */}
        <div className="bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-md">
          <form onSubmit={handleBarcodeScan} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 absolute left-3.5 top-2.5 text-[#8a92a6]" />
              <input
                ref={barcodeRef}
                type="text"
                placeholder="สแกนบาร์โค้ดสินค้าหรือพิกัด เพื่อเพิ่มยอดนับทีละ 1 (+1)..."
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                className="w-full pl-11 pr-4 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl text-xs font-medium focus:outline-none focus:border-teal-500 focus:bg-[#171c23] transition-all"
              />
            </div>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => setShowCountCam(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
              >
                <Camera className="w-3.5 h-3.5 text-teal-400" />
                <span>เปิดกล้องสแกน</span>
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-colors shrink-0"
              >
                สแกนบาร์โค้ด
              </button>
              <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#252a32] text-[#d1c6ab] text-[11px] font-bold rounded-xl border border-[#30353d] shrink-0">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>PDA พร้อม</span>
              </div>
            </div>
          </form>
        </div>

        {/* Info & Actions */}
        <div className="flex flex-wrap gap-4 items-center justify-between rounded-2xl border border-[#30353d] bg-[#171c23] p-4 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="date"
              value={countDate}
              onChange={e => setCountDate(e.target.value)}
              className="px-3 py-2 border border-[#30353d] rounded-xl bg-[#1b2027] font-bold text-xs text-[#d1c6ab]"
            />
            <input
              type="text"
              value={countNote}
              onChange={e => setCountNote(e.target.value)}
              placeholder="หมายเหตุรอบตรวจนับ (ถ้ามี)"
              className="px-3 py-2 border border-[#30353d] rounded-xl w-60 bg-[#1b2027] font-medium text-xs text-[#d1c6ab]"
            />
          </div>
          <div className="flex items-center gap-2">
            {!isBlindCount && (
              <button
                onClick={() => setShowOnlyVariance(!showOnlyVariance)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  showOnlyVariance
                    ? 'bg-rose-500/20 text-rose-700 border border-rose-500/30'
                    : 'bg-[#252a32] text-[#d1c6ab] border border-[#30353d]'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                แสดงเฉพาะผลต่าง
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving || summary.counted === 0}
              className="px-5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 disabled:opacity-50 transition-all shadow-md"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกผลการนับ
            </button>
          </div>
        </div>

        {/* Count Table Container */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[#171c23] border border-[#30353d] rounded-2xl overflow-hidden shadow-lg"
        >
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-slate-300 w-1/3">สินค้า</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-300">พิกัดจัดเก็บ</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-300">
                    {isBlindCount ? 'ยอดในระบบ (Blind)' : 'ยอดในระบบ'}
                  </th>
                  <th className="text-center px-4 py-3 font-bold text-slate-300 w-32">นับจริง</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-300">ผลต่าง</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-300">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30353d] text-xs">
                {displayItems.map(item => (
                  <tr key={item.sku} className="hover:bg-[#1b2027]/75 transition-colors">
                    <td className="px-4 py-3 font-bold text-[#dee2ec]">{item.sku}</td>
                    <td className="px-4 py-3 text-left">
                      <span className="bg-[#252a32] px-2 py-1 rounded text-xs font-mono font-bold text-[#d1c6ab] border border-[#30353d] inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-teal-600" /> {item.location}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#d1c6ab]">
                      {isBlindCount ? (
                        <span className="text-[#8a92a6] italic">🔒 ซ่อนไว้</span>
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
                        className="w-full text-center px-2 py-1.5 border border-[#30353d] rounded-lg font-mono font-bold text-xs focus:border-teal-500 focus:bg-teal-500/10/20"
                      />
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-bold ${
                        isBlindCount
                          ? 'text-[#8a92a6]'
                          : item.variance > 0
                          ? 'text-emerald-600'
                          : item.variance < 0
                          ? 'text-rose-600'
                          : 'text-[#8a92a6]'
                      }`}
                    >
                      {isBlindCount ? (
                        <span className="text-[#8a92a6]">🔒</span>
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-500/20 text-blue-800 rounded-full text-xs font-bold">
                          <Check className="w-3 h-3" /> นับแล้ว
                        </span>
                      ) : (
                        <span className="text-[#8a92a6] text-xs">รอนับ</span>
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
                className="bg-[#171c23] border border-[#30353d] rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-[#dee2ec] text-sm">{item.sku}</div>
                  <div>
                    {item.actualQty !== '' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-500/20 text-blue-800 rounded-full text-xs font-bold">
                        <Check className="w-3 h-3" /> นับแล้ว
                      </span>
                    ) : (
                      <span className="text-[#8a92a6] text-xs bg-[#252a32] px-2.5 py-0.5 rounded-full font-bold">
                        รอนับ
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 items-center text-xs text-[#8a92a6]">
                  <span className="bg-[#252a32] px-2 py-0.5 rounded font-mono font-bold border border-[#30353d] text-[#d1c6ab]">
                    📍 {item.location}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#30353d] items-center">
                  <div>
                    <span className="text-[10px] text-[#8a92a6] block font-bold">
                      {isBlindCount ? 'ยอดในระบบ (Blind)' : 'ยอดในระบบ'}
                    </span>
                    <span className="font-bold text-[#d1c6ab] text-sm">
                      {isBlindCount ? '🔒 ซ่อนไว้' : item.systemQty.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8a92a6] block font-bold">นับจริง (Actual)</span>
                    <input
                      type="number"
                      value={item.actualQty}
                      onChange={e => updateActualQty(item.sku, e.target.value)}
                      placeholder="กรอกยอด"
                      className="w-full text-center px-2 py-1.5 border border-[#30353d] rounded-lg bg-[#1b2027] font-bold text-[#dee2ec] text-sm focus:border-teal-500 focus:bg-[#171c23]"
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
