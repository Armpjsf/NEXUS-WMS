'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Scan,
  ShieldAlert,
  Camera,
  CheckCircle2,
  Upload,
  AlertTriangle
} from 'lucide-react';
import CameraScannerModal from '@/components/CameraScannerModal';

export default function MobileDamagePage() {
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('กล่องบุบ / ฉีกขาดระหว่างขนถ่าย');
  const [notes, setNotes] = useState('');
  const [cameraScanOpen, setCameraScanOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleScan = (code: string) => {
    setSku(code);
    setProductName(`สินค้าบาร์โค้ด ${code}`);
    setCameraScanOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku) {
      alert('กรุณาระบุ SKU หรือสแกนบาร์โค้ด');
      return;
    }
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
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>แจ้งสินค้าชำรุด (Damage)</span>
        </h1>
        <div className="w-9" />
      </div>

      {success ? (
        <div className="mt-12 p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl text-center space-y-3 animate-in fade-in zoom-in-95">
          <CheckCircle2 className="w-12 h-12 text-rose-400 mx-auto" />
          <div className="font-bold text-sm text-rose-300">บันทึกสินค้าชำรุดเรียบร้อย</div>
          <p className="text-xs text-slate-400">
            ตัดจ่ายออกจากสต็อกพร้อมจำหน่ายแล้ว {qty} ชิ้น รอหัวหน้าคลังอนุมัติแทงตัดบัญชี
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setSku('');
              setProductName('');
              setQty(1);
              setNotes('');
            }}
            className="mt-4 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white transition-colors"
          >
            แจ้งชำรุดรายการอื่นต่อ
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* SKU / Barcode */}
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
                  setProductName(`สินค้า ${e.target.value}`);
                }}
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-mono text-white focus:outline-none focus:border-rose-400"
                required
              />
              <button
                type="button"
                onClick={() => setCameraScanOpen(true)}
                className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
              >
                <Scan className="w-5 h-5" />
              </button>
            </div>
          </div>

          {productName && (
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300">
              <span className="text-slate-400">ชื่อสินค้า:</span> <span className="font-bold text-white">{productName}</span>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              จำนวนชิ้นที่ชำรุด *
            </label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(Math.max(1, Number(e.target.value)))}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-base font-bold text-white text-center focus:outline-none focus:border-rose-400"
              required
            />
          </div>

          {/* Damage Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              ประเภทความเสียหาย / สาเหตุ *
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-semibold text-white focus:outline-none"
            >
              <option value="กล่องบุบ / ฉีกขาดระหว่างขนถ่าย">กล่องบุบ / ฉีกขาดระหว่างขนถ่าย</option>
              <option value="สินค้าแตกหัก / แตกหักจากตกหล่น">สินค้าแตกหัก / ตกหล่น</option>
              <option value="เปียกน้ำ / ความชื้น">เปียกน้ำ / ความชื้น</option>
              <option value="หมดอายุคาชั้นวาง">หมดอายุคาชั้นวาง</option>
              <option value="บรรจุภัณฑ์ซีลเปิด / เสียสภาพ">บรรจุภัณฑ์ซีลเปิด / เสียสภาพ</option>
              <option value="อื่นๆ (ระบุในหมายเหตุ)">อื่นๆ (ระบุในหมายเหตุ)</option>
            </select>
          </div>

          {/* Photo attach placeholder */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              ถ่ายภาพหลักฐานสินค้าชำรุด (Photo Proof)
            </label>
            <button
              type="button"
              onClick={() => alert('เปิดกล้องถ่ายภาพความเสียหายเรียบร้อยแล้ว')}
              className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <Camera className="w-6 h-6 text-slate-400" />
              <span className="text-xs font-medium">แตะเพื่อถ่ายรูปด้วยกล้องมือถือ</span>
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              หมายเหตุเพิ่มเติม
            </label>
            <input
              type="text"
              placeholder="เช่น พบตอนจัดเก็บโซน A-02"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!sku || submitting}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-rose-600/25 active:scale-98 disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'กำลังบันทึก...' : 'บันทึกแจ้งสินค้าชำรุด'}
          </button>
        </form>
      )}

      {cameraScanOpen && (
        <CameraScannerModal
          isOpen={cameraScanOpen}
          onClose={() => setCameraScanOpen(false)}
          onScan={handleScan}
        />
      )}
    </div>
  );
}
