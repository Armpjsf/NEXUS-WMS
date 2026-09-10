'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Scan,
  RotateCcw,
  CheckCircle2,
  Package,
  AlertCircle
} from 'lucide-react';
import CameraScannerModal from '@/components/CameraScannerModal';

export default function MobileReturnsPage() {
  const [returnNo, setReturnNo] = useState('');
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState(1);
  const [condition, setCondition] = useState<'RESTOCK' | 'QUARANTINE' | 'SCRAP'>('RESTOCK');
  const [notes, setNotes] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleScan = (code: string) => {
    if (!returnNo) setReturnNo(code);
    else setSku(code);
    setCameraOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
    }, 600);
  };

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
        <h1 className="text-base font-bold tracking-wide flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4 text-purple-400" />
          <span>รับคืนสินค้า (RMA Returns)</span>
        </h1>
        <div className="w-9" />
      </div>

      {success ? (
        <div className="mt-12 p-6 bg-purple-500/10 border border-purple-500/30 rounded-3xl text-center space-y-3 animate-in fade-in zoom-in-95">
          <CheckCircle2 className="w-12 h-12 text-purple-400 mx-auto" />
          <div className="font-bold text-sm text-purple-300">รับคืนสินค้าเรียบร้อย!</div>
          <p className="text-xs text-slate-400">
            {condition === 'RESTOCK'
              ? `สินค้า ${sku || 'ตามใบรับคืน'} จำนวน ${qty} ชิ้น ถูกนำกลับเข้าสต็อกพร้อมจำหน่ายแล้ว`
              : `สินค้าถูกย้ายเข้าสู่โซนกักกัน (Quarantine) เพื่อรอตรวจสอบ`}
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setReturnNo('');
              setSku('');
              setQty(1);
            }}
            className="mt-4 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold text-white transition-colors"
          >
            รับคืนรายการถัดไป
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              เลขที่ใบส่งสินค้า / ออเดอร์ที่รับคืน *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="เช่น ORD-20260910-001"
                value={returnNo}
                onChange={e => setReturnNo(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-mono text-white focus:outline-none focus:border-purple-400"
                required
              />
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
              >
                <Scan className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              SKU สินค้าที่รับคืน
            </label>
            <input
              type="text"
              placeholder="SKU-001 หรือสแกนบาร์โค้ด"
              value={sku}
              onChange={e => setSku(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-mono text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              จำนวนชิ้นที่รับคืน *
            </label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(Math.max(1, Number(e.target.value)))}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-base font-bold text-white text-center focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              ผลการตรวจสภาพสินค้า *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCondition('RESTOCK')}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                  condition === 'RESTOCK'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                สภาพดี (เติมสต็อก)
              </button>
              <button
                type="button"
                onClick={() => setCondition('QUARANTINE')}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                  condition === 'QUARANTINE'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                มีตำหนิ (กักกัน)
              </button>
              <button
                type="button"
                onClick={() => setCondition('SCRAP')}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                  condition === 'SCRAP'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                ชำรุด (ทิ้ง/เคลม)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              เหตุผลการคืน / หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="เช่น ลูกค้าสั่งผิดไซส์, เปลี่ยนใจ"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!returnNo || submitting}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-purple-600/25 active:scale-98 disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'กำลังบันทึก...' : 'ยืนยันการรับคืนสินค้า'}
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
