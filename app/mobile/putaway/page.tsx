'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Scan,
  MapPin,
  CheckCircle2,
  Package,
  Layers,
  Search,
  Volume2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CameraScannerModal from '@/components/CameraScannerModal';
import BinQuickSelect from '@/components/stock/BinQuickSelect';
import { speakPutawayLocation, triggerHaptic } from '@/lib/voiceAssistant';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { errorMessage } from '@/lib/errors';

export default function MobilePutawayPage() {
  const [step, setStep] = useState<'SCAN_ITEM' | 'CONFIRM_LOCATION' | 'DONE'>('SCAN_ITEM');
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProds, setLoadingProds] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected Product & Bin state
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [targetBin, setTargetBin] = useState('');
  const [putawayQty, setPutawayQty] = useState<number>(1);
  const [lotNumber, setLotNumber] = useState('');
  
  // Camera Scanner modal
  const [cameraMode, setCameraMode] = useState<'ITEM' | 'LOC' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoadingProds(true);
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setProducts(data);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoadingProds(false);
      }
    }
    loadProducts();
  }, []);

  const handleSelectItem = (p: any) => {
    setSelectedProduct(p);
    // Initial suggested bin is current primary location, or A-01-01
    const loc = (p.location && p.location !== 'Unassigned' && p.location !== '-') 
      ? p.location 
      : 'A-01-01';
    setTargetBin(loc);
    setPutawayQty(1);
    setCameraMode(null);
    setStep('CONFIRM_LOCATION');
    triggerHaptic('success');
    toast.success(`เลือกสินค้า: ${p.name}`);
  };

  const handleScanBarcode = (code: string) => {
    const q = code.trim().toLowerCase();
    if (step === 'SCAN_ITEM') {
      const match = products.find(p => 
        (p.sku || '').toLowerCase() === q ||
        (p.id || '').toLowerCase() === q ||
        (p.barcode || '').toLowerCase() === q ||
        (p.name || '').toLowerCase() === q
      );
      if (match) {
        playScannerAudio('success');
        handleSelectItem(match);
      } else {
        playScannerAudio('error');
        triggerHaptic('error');
        toast.error(`ไม่พบสินค้ารหัส "${code}" ในระบบ`);
      }
    } else if (step === 'CONFIRM_LOCATION') {
      // In confirm location, barcode scan updates the bin
      setTargetBin(code.trim().toUpperCase());
      setCameraMode(null);
      playScannerAudio('success');
      triggerHaptic('success');
      speakPutawayLocation(code.trim().toUpperCase());
      toast.success(`เลือกพิกัด: ${code.trim().toUpperCase()}`);
    }
  };

  usePdaScanner({
    onScan: handleScanBarcode,
    enabled: !cameraMode,
    playSound: false,
  });

  const handleConfirmPutaway = async () => {
    if (!selectedProduct) return;
    if (!targetBin.trim()) {
      toast.error('กรุณาระบุพิกัดจัดเก็บ (Bin)');
      return;
    }
    if (putawayQty <= 0) {
      toast.error('จำนวนจัดเก็บต้องมากกว่า 0');
      return;
    }

    setSubmitting(true);
    try {
      const sku = selectedProduct.sku || selectedProduct.id;
      const res = await fetch('/api/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          qty: putawayQty,
          location: targetBin.trim().toUpperCase(),
          batch: lotNumber.trim() || undefined,
          docRef: `PUTAWAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'จัดเก็บเข้าพิกัดไม่สำเร็จ');

      triggerHaptic('success');
      toast.success(`จัดเก็บ ${selectedProduct.name} เข้า ${targetBin.toUpperCase()} เรียบร้อย!`);
      setStep('DONE');
    } catch (err) {
      triggerHaptic('error');
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการจัดเก็บ');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    );
  }).slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 max-w-md mx-auto">
      {/* Top Bar - Tactical Header */}
      <div className="bg-[#171c23] text-white p-4 border-b border-[#30353d] relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#facc15] via-[#4cd7f6] to-[#57ec7f]" />
        <div className="flex items-center justify-between">
          <Link
            href="/mobile"
            className="p-2 rounded-xl bg-[#252a32] border border-[#30353d] text-[#dee2ec] hover:text-[#facc15] active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold tracking-wide flex items-center gap-1.5 text-[#dee2ec]">
            <Layers className="w-4 h-4 text-[#57ec7f]" />
            <span>จัดเก็บขึ้นชั้น (Putaway)</span>
          </h1>
          <button
            type="button"
            onClick={() => setCameraMode(step === 'SCAN_ITEM' ? 'ITEM' : 'LOC')}
            className="p-2 rounded-xl bg-[#252a32] border border-[#30353d] text-[#dee2ec] hover:text-[#facc15] active:scale-95"
            title="เปิดกล้องสแกน"
          >
            <Scan className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {step === 'SCAN_ITEM' && (
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto">
                <Package className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">ขั้นตอนที่ 1: สแกนหรือเลือกสินค้า</h2>
                <p className="text-xs text-slate-500 mt-1">
                  ยิงบาร์โค้ดสินค้าที่ต้องการนำขึ้นชั้นวาง หรือพิมพ์ค้นหาจากแคตตาล็อก
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCameraMode('ITEM')}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <Scan className="w-5 h-5" />
                <span>เปิดกล้องสแกนบาร์โค้ดสินค้า</span>
              </button>
            </div>

            {/* Manual Search Box */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="พิมพ์ค้นหาชื่อ หรือ SKU สินค้า..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>

              {/* Search Results */}
              {filteredProducts.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg divide-y divide-slate-100 overflow-hidden">
                  {filteredProducts.map(p => (
                    <div
                      key={p.id || p.sku}
                      onClick={() => handleSelectItem(p)}
                      className="p-3 hover:bg-emerald-50/50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-sm font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                          <span>SKU: {p.sku || p.id}</span>
                          {p.location && (
                            <span className="flex items-center gap-0.5 text-emerald-600">
                              <MapPin className="w-3 h-3" /> {p.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-slate-100 text-slate-700 shrink-0">
                        {p.stock ?? 0} {p.unit || 'ชิ้น'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'CONFIRM_LOCATION' && selectedProduct && (
          <div className="space-y-4">
            {/* Selected Product Banner */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                สินค้าที่กำลังจัดเก็บ (Target SKU):
              </span>
              <div className="text-base font-black text-slate-900 leading-tight">
                {selectedProduct.name}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span className="font-mono">SKU: {selectedProduct.sku || selectedProduct.id}</span>
                <span>สต็อกรวมปัจจุบัน: <strong className="text-slate-900 font-mono font-black">{selectedProduct.stock ?? 0}</strong> {selectedProduct.unit || 'ชิ้น'}</span>
              </div>
            </div>

            {/* Putaway Bin Selection Section */}
            <div className="p-5 bg-white rounded-3xl border-2 border-emerald-500/40 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>พิกัดจัดเก็บเป้าหมาย (Putaway Bin):</span>
                </div>
                <button
                  type="button"
                  onClick={() => speakPutawayLocation(targetBin || 'A-01')}
                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  title="ฟังเสียงพิกัด"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* Big Bin Readout & Manual Override */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={targetBin}
                  onChange={e => setTargetBin(e.target.value.toUpperCase())}
                  placeholder="เช่น A-01-01"
                  className="flex-1 px-4 py-3 text-center text-2xl font-black font-mono tracking-wider bg-slate-50 border-2 border-emerald-500/50 rounded-2xl text-emerald-700 focus:outline-none focus:border-emerald-600 uppercase"
                />
                <button
                  type="button"
                  onClick={() => setCameraMode('LOC')}
                  className="p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center active:scale-95 shadow-md"
                  title="สแกนบาร์โค้ดชั้นวาง"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>

              {/* BinQuickSelect for Consolidation or picking existing bin */}
              <div className="pt-2 border-t border-slate-100">
                <BinQuickSelect
                  sku={selectedProduct.sku || selectedProduct.id}
                  selectedBin={targetBin}
                  onSelectBin={bin => {
                    setTargetBin(bin);
                    speakPutawayLocation(bin);
                  }}
                  mode="putaway"
                  theme="light"
                  label="พิกัดที่มีสินค้านี้อยู่แล้ว (แตะเพื่อรวมกอง Consolidation):"
                />
              </div>
            </div>

            {/* Quantity to Putaway */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <label className="block text-xs font-bold text-slate-600">
                จำนวนที่นำขึ้นชั้นวาง ({selectedProduct.unit || 'ชิ้น'}):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPutawayQty(Math.max(1, putawayQty - 1))}
                  className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-lg text-slate-700 flex items-center justify-center active:scale-95"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={putawayQty}
                  onChange={e => setPutawayQty(Math.max(1, Number(e.target.value) || 1))}
                  className="flex-1 py-3 text-center text-xl font-black font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setPutawayQty(putawayQty + 1)}
                  className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-lg text-slate-700 flex items-center justify-center active:scale-95"
                >
                  +
                </button>
              </div>

              {/* Quick increment buttons */}
              <div className="flex gap-2">
                {[5, 10, 20, 50].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPutawayQty(prev => prev + amt)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold font-mono text-slate-700"
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              {/* Optional Lot No */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  เลข Lot / Batch (ถ้ามี):
                </label>
                <input
                  type="text"
                  placeholder="เช่น LOT-2026-09"
                  value={lotNumber}
                  onChange={e => setLotNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('SCAN_ITEM')}
                className="w-1/3 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-bold text-xs active:scale-95 transition-all"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={handleConfirmPutaway}
                disabled={submitting}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ยืนยันจัดเก็บขึ้นพิกัด</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'DONE' && selectedProduct && (
          <div className="mt-8 p-6 bg-white border-2 border-emerald-500/50 rounded-3xl text-center space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-slate-900">จัดเก็บสินค้าขึ้นชั้นสำเร็จ!</div>
              <p className="text-xs text-slate-500">
                ระบบได้บันทึกการนำสินค้าเข้าสู่พิกัดและกระทบยอดคงเหลือรวมเรียบร้อยแล้ว
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">สินค้า:</span>
                <span className="font-bold text-slate-900">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">พิกัดจัดเก็บ (Bin):</span>
                <span className="font-mono font-black text-emerald-600 text-sm">{targetBin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">จำนวนที่จัดเก็บ:</span>
                <span className="font-mono font-bold text-slate-900">{putawayQty} {selectedProduct.unit || 'ชิ้น'}</span>
              </div>
              {lotNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Lot:</span>
                  <span className="font-mono text-slate-700">{lotNumber}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setStep('SCAN_ITEM');
                setSelectedProduct(null);
                setTargetBin('');
                setPutawayQty(1);
                setLotNumber('');
                setSearchQuery('');
              }}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
            >
              จัดเก็บชิ้นถัดไป
            </button>
          </div>
        )}
      </div>

      {cameraMode && (
        <CameraScannerModal
          isOpen={!!cameraMode}
          onClose={() => setCameraMode(null)}
          onScan={handleScanBarcode}
          title={cameraMode === 'ITEM' ? 'สแกนบาร์โค้ดสินค้า' : 'สแกนบาร์โค้ดพิกัดชั้นวาง (Bin)'}
          description={cameraMode === 'ITEM' ? 'เล็งกล้องไปที่บาร์โค้ดหรือ QR Code สินค้า' : 'เล็งกล้องไปที่ป้ายพิกัดช่องหรือเชลฟ์'}
        />
      )}
    </div>
  );
}
