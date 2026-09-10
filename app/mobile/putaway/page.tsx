'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Scan,
  MapPin,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';
import CameraScannerModal from '@/components/CameraScannerModal';

export default function MobilePutawayPage() {
  const [step, setStep] = useState<'SCAN_ITEM' | 'CONFIRM_LOCATION' | 'DONE'>('SCAN_ITEM');
  const [scannedSku, setScannedSku] = useState('');
  const [productName, setProductName] = useState('');
  const [recommendedLoc, setRecommendedLoc] = useState('A-02-03-B');
  const [scannedLoc, setScannedLoc] = useState('');
  const [cameraMode, setCameraMode] = useState<'ITEM' | 'LOC' | null>(null);

  const handleScanItem = (code: string) => {
    setScannedSku(code);
    setProductName(`สินค้า ${code}`);
    setRecommendedLoc('A-02-03-B');
    setCameraMode(null);
    setStep('CONFIRM_LOCATION');
  };

  const handleScanLocation = (code: string) => {
    setScannedLoc(code);
    setCameraMode(null);
  };

  const handleConfirmPutaway = () => {
    setStep('DONE');
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
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>จัดเก็บขึ้นชั้น (Putaway)</span>
        </h1>
        <div className="w-9" />
      </div>

      {step === 'SCAN_ITEM' && (
        <div className="mt-8 space-y-5 text-center">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <Package className="w-10 h-10" />
          </div>

          <div>
            <div className="text-lg font-black text-white">ขั้นตอนที่ 1: สแกนบาร์โค้ดสินค้า</div>
            <p className="text-xs text-slate-400 mt-1">
              ยิงบาร์โค้ดสินค้าที่เพิ่งรับเข้า เพื่อให้ระบบแนะนำชั้นวางที่เหมาะสม
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <button
              onClick={() => setCameraMode('ITEM')}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <Scan className="w-5 h-5" />
              <span>เปิดกล้องสแกนสินค้า</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500 my-2">
              <div className="flex-1 h-px bg-slate-800" />
              <span>หรือพิมพ์ SKU</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="เช่น SKU-001"
                value={scannedSku}
                onChange={e => setScannedSku(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-mono text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleScanItem(scannedSku || 'SKU-001')}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl text-xs font-bold"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'CONFIRM_LOCATION' && (
        <div className="mt-6 space-y-5">
          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
            <div className="text-xs text-slate-400">สินค้าที่กำลังจัดเก็บ:</div>
            <div className="text-base font-bold text-white">{productName}</div>
            <div className="text-xs text-slate-400 font-mono">SKU: {scannedSku}</div>
          </div>

          {/* Recommended Location Card */}
          <div className="p-5 bg-gradient-to-br from-emerald-950/60 to-slate-900 border-2 border-emerald-500/50 rounded-3xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <MapPin className="w-4 h-4" />
              <span>ตำแหน่งชั้นวางที่ระบบแนะนำ</span>
            </div>
            <div className="text-3xl font-black text-white font-mono tracking-tight">
              {recommendedLoc}
            </div>
            <p className="text-xs text-slate-400">
              นำสินค้าไปวางที่ช่องนี้ จากนั้นสแกนบาร์โค้ดประจำชั้นเพื่อยืนยัน
            </p>
          </div>

          {/* Scan Location */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-300">
              ขั้นตอนที่ 2: สแกนบาร์โค้ดชั้นวาง (Rack Barcode)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="สแกนหรือพิมพ์รหัสชั้น..."
                value={scannedLoc}
                onChange={e => setScannedLoc(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={() => setCameraMode('LOC')}
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
              >
                <Scan className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmPutaway}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>ยืนยันการจัดเก็บเรียบร้อย</span>
          </button>
        </div>
      )}

      {step === 'DONE' && (
        <div className="mt-12 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl text-center space-y-3 animate-in fade-in zoom-in-95">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
          <div className="text-lg font-black text-white">จัดเก็บสินค้าขึ้นชั้นสำเร็จ!</div>
          <div className="text-xs text-slate-300">
            สินค้า <span className="font-bold text-emerald-400">{scannedSku}</span> ถูกบันทึกไว้ที่ตำแหน่ง{' '}
            <span className="font-bold text-emerald-400">{scannedLoc || recommendedLoc}</span> เรียบร้อยแล้ว
          </div>

          <button
            onClick={() => {
              setStep('SCAN_ITEM');
              setScannedSku('');
              setScannedLoc('');
            }}
            className="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-xs font-bold text-white transition-all active:scale-95"
          >
            จัดเก็บชิ้นถัดไป
          </button>
        </div>
      )}

      {cameraMode && (
        <CameraScannerModal
          isOpen={!!cameraMode}
          onClose={() => setCameraMode(null)}
          onScan={code => {
            if (cameraMode === 'ITEM') handleScanItem(code);
            else handleScanLocation(code);
          }}
        />
      )}
    </div>
  );
}
