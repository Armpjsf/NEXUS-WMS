'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Scan,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Save,
  RotateCcw,
  Package
} from 'lucide-react';
import CameraScannerModal from '@/components/CameraScannerModal';

export default function MobileAdjustPage() {
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [reason, setReason] = useState('นับสต็อกหน้างาน (Recount)');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleScan = (code: string) => {
    setSku(code);
    setCameraOpen(false);
    // Auto lookup sample
    setProductName(`สินค้าบาร์โค้ด ${code}`);
    setCurrentStock(45);
    setAdjustQty(0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku) {
      alert('กรุณาระบุ SKU หรือสแกนบาร์โค้ด');
      return;
    }
    setSubmitting(true);
    // Simulate API adjustment
    setTimeout(() => {
      setSubmitting(false);
      setSuccessMsg(`ปรับสต็อก ${sku} สำเร็จ! ยอดใหม่: ${(currentStock || 0) + adjustQty} ชิ้น`);
      setTimeout(() => {
        setSuccessMsg('');
        setSku('');
        setProductName('');
        setCurrentStock(null);
        setAdjustQty(0);
      }, 2500);
    }, 600);
  };

  const newTotal = (currentStock || 0) + adjustQty;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-20 max-w-md mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <Link
          href="/mobile"
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-bold tracking-wide">ปรับสต็อกด่วน (Quick Adjust)</h1>
        <div className="w-9" />
      </div>

      {successMsg ? (
        <div className="mt-12 p-6 bg-emerald-500/20 border border-emerald-500/40 rounded-3xl text-center space-y-3 animate-in fade-in zoom-in-95">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <div className="font-bold text-sm text-emerald-300">{successMsg}</div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {/* Scan Barcode / Input SKU */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              สแกนบาร์โค้ด หรือ ระบุ SKU *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="เช่น SKU-001 หรือสแกน"
                value={sku}
                onChange={e => {
                  setSku(e.target.value);
                  if (e.target.value) {
                    setProductName(`สินค้า ${e.target.value}`);
                    if (currentStock === null) setCurrentStock(50);
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
          </div>

          {productName && (
            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">ชื่อสินค้า</div>
                  <div className="text-sm font-bold text-white">{productName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">สต็อกปัจจุบัน</div>
                  <div className="text-base font-black text-cyan-400">{currentStock ?? 0} ชิ้น</div>
                </div>
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
                      สต็อกหลังปรับ: <span className="text-emerald-400 font-bold">{newTotal}</span> ชิ้น
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

          <button
            type="submit"
            disabled={!sku || adjustQty === 0 || submitting}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-cyan-500/25 active:scale-98 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'กำลังบันทึก...' : 'บันทึกการปรับยอดสต็อก'}</span>
          </button>
        </form>
      )}

      {cameraOpen && (
        <CameraScannerModal
          isOpen={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onScan={handleScan}
        />
      )}
    </div>
  );
}
