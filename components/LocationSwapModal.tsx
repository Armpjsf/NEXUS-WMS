'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  MoveRight,
  MapPin,
  Package,
  Search,
  CheckCircle2,
  X,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductItem {
  id: string | number;
  name: string;
  sku: string;
  location?: string;
  stock?: number;
}

interface LocationSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceProduct: ProductItem | null;
  allProducts: ProductItem[];
  onSwapSuccess: () => void;
}

export function LocationSwapModal({
  isOpen,
  onClose,
  sourceProduct,
  allProducts,
  onSwapSuccess
}: LocationSwapModalProps) {
  const [mode, setMode] = useState<'SWAP' | 'RELOCATE'>('SWAP');
  const [searchTarget, setSearchTarget] = useState('');
  const [selectedTargetProduct, setSelectedTargetProduct] = useState<ProductItem | null>(null);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableTargets = useMemo(() => {
    if (!sourceProduct) return [];
    return allProducts.filter(p => {
      if (String(p.id) === String(sourceProduct.id)) return false;
      if (!searchTarget) return true;
      const q = searchTarget.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.location && p.location.toLowerCase().includes(q))
      );
    });
  }, [allProducts, sourceProduct, searchTarget]);

  if (!isOpen || !sourceProduct) return null;

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === 'SWAP') {
        if (!selectedTargetProduct) {
          toast.error('กรุณาเลือกสินค้าเป้าหมายที่ต้องการสลับพิกัดด้วย');
          setIsSubmitting(false);
          return;
        }

        const res = await fetch('/api/locations/swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'SWAP',
            sourceId: sourceProduct.id,
            targetId: selectedTargetProduct.id,
            reason: reasonInput
          })
        });

        const data = await res.json();
        if (data.success) {
          toast.success(data.message || 'สลับพิกัดจัดเก็บเรียบร้อยแล้ว!');
          onSwapSuccess();
          onClose();
        } else {
          toast.error(data.error || 'สลับพิกัดไม่สำเร็จ');
        }
      } else {
        // Mode: RELOCATE
        if (!newLocationInput.trim()) {
          toast.error('กรุณากรอกพิกัดตำแหน่งใหม่');
          setIsSubmitting(false);
          return;
        }

        const res = await fetch('/api/locations/swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'RELOCATE',
            sourceId: sourceProduct.id,
            newLocation: newLocationInput.trim(),
            reason: reasonInput
          })
        });

        const data = await res.json();
        if (data.success) {
          toast.success(data.message || 'ย้ายพิกัดสินค้าเรียบร้อยแล้ว!');
          onSwapSuccess();
          onClose();
        } else {
          toast.error(data.error || 'ย้ายพิกัดไม่สำเร็จ');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sourceLoc = sourceProduct.location || 'Unassigned';
  const targetLoc = selectedTargetProduct?.location || 'Unassigned';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Tactical Top Gradient Bar */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />

        {/* Modal Header */}
        <div className="p-5 border-b border-[#30353d] flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4cd7f6] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#4cd7f6]" />
              SMART LOCATION RELOCATION & SWAP
            </span>
            <h3 className="text-lg font-black text-[#dee2ec] flex items-center gap-2 mt-0.5">
              <ArrowLeftRight className="w-5 h-5 text-[#facc15]" />
              สลับพิกัดจัดเก็บสินค้า (1-Click Location Swap)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8a92a6] hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-5 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('SWAP')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              mode === 'SWAP'
                ? 'bg-[#facc15] text-[#1b1600] shadow-md shadow-[#facc15]/20'
                : 'bg-[#1e242e] text-[#8a92a6] hover:text-[#dee2ec]'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            สลับที่กับสินค้าอื่น (Item-to-Item Swap)
          </button>
          <button
            type="button"
            onClick={() => setMode('RELOCATE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              mode === 'RELOCATE'
                ? 'bg-[#4cd7f6] text-[#042027] shadow-md shadow-[#4cd7f6]/20'
                : 'bg-[#1e242e] text-[#8a92a6] hover:text-[#dee2ec]'
            }`}
          >
            <MoveRight className="w-4 h-4" />
            ย้ายไปพิกัดใหม่ / ช่องว่าง (Relocate to New Bin)
          </button>
        </div>

        <form onSubmit={handleExecute} className="p-5 space-y-4 text-xs font-mono">
          {/* Comparison Cards: Source ➔ Target */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
            {/* Left: Source Product Card */}
            <div className="p-4 rounded-xl border border-[#30353d] bg-[#12161d] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[#8a92a6]">สินค้าต้นทาง (Source)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#facc15]/10 text-[#facc15] border border-[#facc15]/30">
                  กำลังเลือก
                </span>
              </div>
              <div className="text-sm font-black text-[#dee2ec] truncate font-headline">{sourceProduct.name}</div>
              <div className="text-[11px] text-[#4cd7f6]">SKU: {sourceProduct.sku}</div>
              <div className="pt-2 border-t border-[#262c36] flex items-center justify-between">
                <span className="text-[#8a92a6]">พิกัดปัจจุบัน:</span>
                <span className="text-sm font-black text-[#facc15] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#facc15]" />
                  {sourceLoc}
                </span>
              </div>
            </div>

            {/* Right: Target Swap or New Location Card */}
            <div className={`p-4 rounded-xl border space-y-2 ${
              mode === 'SWAP' && selectedTargetProduct
                ? 'border-[#57ec7f]/50 bg-[#12161d]'
                : mode === 'RELOCATE' && newLocationInput
                ? 'border-[#4cd7f6]/50 bg-[#12161d]'
                : 'border-[#30353d] bg-[#12161d]/50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[#8a92a6]">
                  {mode === 'SWAP' ? 'สินค้าปลายทางที่จะสลับด้วย' : 'พิกัดใหม่ปลายทาง'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#57ec7f]/10 text-[#57ec7f] border border-[#57ec7f]/30">
                  {mode === 'SWAP' ? 'คู่สลับ (Target)' : 'พิกัดใหม่'}
                </span>
              </div>

              {mode === 'SWAP' ? (
                selectedTargetProduct ? (
                  <>
                    <div className="text-sm font-black text-[#dee2ec] truncate font-headline">{selectedTargetProduct.name}</div>
                    <div className="text-[11px] text-[#57ec7f]">SKU: {selectedTargetProduct.sku}</div>
                    <div className="pt-2 border-t border-[#262c36] flex items-center justify-between">
                      <span className="text-[#8a92a6]">พิกัดปัจจุบัน:</span>
                      <span className="text-sm font-black text-[#57ec7f] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#57ec7f]" />
                        {targetLoc}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center text-[#8a92a6] italic">
                    คลิกเลือกสินค้าจากรายการด้านล่างเพื่อสลับ
                  </div>
                )
              ) : (
                <div className="space-y-2 py-1">
                  <label className="text-[#8a92a6] block text-[11px]">ระบุรหัสพิกัดใหม่ (เช่น B-01-02-01):</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น B-01-02-01"
                    value={newLocationInput}
                    onChange={(e) => setNewLocationInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1c222b] border border-[#30353d] rounded-xl text-[#dee2ec] font-bold text-sm font-mono focus:border-[#4cd7f6] focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* If Mode === 'SWAP': Target Selector Search & List */}
          {mode === 'SWAP' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#8a92a6] font-bold">เลือกสินค้าที่ต้องการสลับพิกัดด้วย:</span>
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a92a6]" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ, SKU หรือพิกัด..."
                    value={searchTarget}
                    onChange={(e) => setSearchTarget(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#12161d] border border-[#30353d] rounded-lg text-[#dee2ec] text-xs focus:border-[#4cd7f6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="max-h-44 overflow-y-auto rounded-xl border border-[#30353d] bg-[#12161d] divide-y divide-[#262c36]">
                {availableTargets.length === 0 ? (
                  <div className="p-4 text-center text-[#8a92a6]">ไม่พบสินค้าอื่นที่ตรงกับคำค้นหา</div>
                ) : (
                  availableTargets.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedTargetProduct(p)}
                      className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                        selectedTargetProduct?.id === p.id
                          ? 'bg-[#facc15]/10 border-l-4 border-l-[#facc15]'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-[#dee2ec] truncate">{p.name}</div>
                        <div className="text-[10px] text-[#8a92a6]">SKU: {p.sku} | คงเหลือ: {p.stock ?? 0}</div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-[#1e242e] text-[#4cd7f6] border border-[#30353d]">
                        📍 {p.location || 'Unassigned'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Swap Outcome Summary Preview */}
          {mode === 'SWAP' && selectedTargetProduct && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-[#17202c] to-[#14261f] border border-[#30353d] flex items-center justify-around text-xs">
              <div className="text-center">
                <span className="text-[#8a92a6] block text-[10px]">{sourceProduct.sku}</span>
                <span className="font-bold text-[#facc15]">{sourceLoc} ➔ {targetLoc}</span>
              </div>
              <ArrowLeftRight className="w-5 h-5 text-[#57ec7f] animate-pulse" />
              <div className="text-center">
                <span className="text-[#8a92a6] block text-[10px]">{selectedTargetProduct.sku}</span>
                <span className="font-bold text-[#57ec7f]">{targetLoc} ➔ {sourceLoc}</span>
              </div>
            </div>
          )}

          {/* Reason Input */}
          <div>
            <label className="text-[#8a92a6] block mb-1">เหตุผลในการสลับพิกัด (บันทึกลง Audit Trail):</label>
            <input
              type="text"
              placeholder="เช่น ย้ายสินค้าขายดีมาหน้าแร็ค, จัดระเบียบโซน A..."
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              className="w-full px-3 py-2 bg-[#12161d] border border-[#30353d] rounded-xl text-[#dee2ec] text-xs focus:border-[#4cd7f6] focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#30353d] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[#8a92a6] hover:text-white bg-[#1e242e] transition font-bold"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (mode === 'SWAP' && !selectedTargetProduct) || (mode === 'RELOCATE' && !newLocationInput)}
              className="px-6 py-2.5 rounded-xl bg-[#facc15] hover:bg-[#eab308] text-[#1b1600] font-black shadow-lg shadow-[#facc15]/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                'กำลังบันทึก...'
              ) : mode === 'SWAP' ? (
                <>
                  <ArrowLeftRight className="w-4 h-4" />
                  ยืนยันสลับพิกัดทันที (1-Click Swap)
                </>
              ) : (
                <>
                  <MoveRight className="w-4 h-4" />
                  ยืนยันย้ายพิกัด (Relocate)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
