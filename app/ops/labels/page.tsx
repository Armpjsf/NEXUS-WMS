'use client';

import React, { useState, useRef } from 'react';
import {
  Tags,
  Printer,
  Sliders,
  Sparkles,
  QrCode,
  Barcode as BarcodeIcon,
  RefreshCw,
  Copy,
  LayoutGrid,
  CheckCircle2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { cn } from '@/lib/utils';

type LabelSize = '100x75' | '50x30' | '40x25' | 'a4';

export default function LabelDesignerPage() {
  const [size, setSize] = useState<LabelSize>('50x30');
  const [barcodeType, setBarcodeType] = useState<'BARCODE' | 'QR' | 'BOTH'>('BOTH');
  const [sku, setSku] = useState('SKU-001');
  const [productName, setProductName] = useState('กล่องกระดาษลูกฟูก เบอร์ 0');
  const [price, setPrice] = useState('12.50');
  const [lotNo, setLotNo] = useState('LOT-2026-09');
  const [expiryDate, setExpiryDate] = useState('2027-09-30');
  const [location, setLocation] = useState('A-02-03-B');
  const [copies, setCopies] = useState(1);

  const [showPrice, setShowPrice] = useState(true);
  const [showLot, setShowLot] = useState(true);
  const [showLocation, setShowLocation] = useState(true);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-slate-50/60">
      {/* Non-print controls header */}
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-500/20">
              <Tags className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                ออกแบบ & พิมพ์ฉลากสินค้า (Barcode & QR Label Designer)
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                พิมพ์สติกเกอร์บาร์โค้ด QR Code ระบุ Lot No. วันหมดอายุ และตำแหน่งชั้นวาง
              </p>
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-slate-900/20 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>สั่งพิมพ์ฉลาก (Print)</span>
          </button>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Form Settings */}
          <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-amber-500" />
              <span>กำหนดค่าฉลาก (Label Configuration)</span>
            </div>

            {/* Size Preset */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">ขนาดสติกเกอร์ / กระดาษ</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: '50x30', label: '50 x 30 มม. (ติดสินค้า/ชั้น)' },
                  { id: '100x75', label: '100 x 75 มม. (ใบปะกล่องลัง)' },
                  { id: '40x25', label: '40 x 25 มม. (ชิ้นเล็ก/บาร์โค้ด)' },
                  { id: 'a4', label: 'กระดาษ A4 (ตารางหลายดวง)' },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSize(p.id as LabelSize)}
                    className={cn(
                      "p-2.5 rounded-xl border text-xs font-bold text-left transition-all",
                      size === p.id
                        ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Barcode Type */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">รูปแบบโค้ด</label>
              <div className="grid grid-cols-3 gap-2">
                {(['BOTH', 'BARCODE', 'QR'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBarcodeType(t)}
                    className={cn(
                      "py-2 rounded-xl border text-xs font-bold transition-all",
                      barcodeType === t
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {t === 'BOTH' && 'บาร์โค้ด + QR'}
                    {t === 'BARCODE' && 'บาร์โค้ดเท่านั้น'}
                    {t === 'QR' && 'QR Code เท่านั้น'}
                  </button>
                ))}
              </div>
            </div>

            {/* Field Inputs */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">รหัส SKU / บาร์โค้ด *</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ราคา (บาท)</label>
                  <input
                    type="text"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ชื่อสินค้า *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Lot / Batch No.</label>
                  <input
                    type="text"
                    value={lotNo}
                    onChange={e => setLotNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">วันหมดอายุ (Expiry)</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ตำแหน่งชั้นวาง (Location)</label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">จำนวนดวงที่จะพิมพ์</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={copies}
                    onChange={e => setCopies(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Toggle fields */}
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600 pt-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={e => setShowPrice(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>แสดงราคา</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLot}
                  onChange={e => setShowLot(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>แสดง Lot/Exp</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={e => setShowLocation(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>แสดงตำแหน่ง</span>
              </label>
            </div>
          </div>

          {/* Live Preview Area */}
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>ภาพตัวอย่างฉลากจริง (Real-time Preview)</span>
            </div>

            <div className="border border-slate-300 rounded-2xl p-4 bg-slate-50/50 shadow-inner flex items-center justify-center">
              <LabelItem
                size={size}
                barcodeType={barcodeType}
                sku={sku}
                productName={productName}
                price={price}
                lotNo={lotNo}
                expiryDate={expiryDate}
                location={location}
                showPrice={showPrice}
                showLot={showLot}
                showLocation={showLocation}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Print Target (Only visible when printing) */}
      <div className="hidden print:block">
        <div className={cn(
          "grid gap-4",
          size === 'a4' ? "grid-cols-3 gap-2" : "grid-cols-1"
        )}>
          {Array.from({ length: copies }).map((_, idx) => (
            <div key={idx} className="page-break-inside-avoid mb-2">
              <LabelItem
                size={size}
                barcodeType={barcodeType}
                sku={sku}
                productName={productName}
                price={price}
                lotNo={lotNo}
                expiryDate={expiryDate}
                location={location}
                showPrice={showPrice}
                showLot={showLot}
                showLocation={showLocation}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LabelItem({
  size,
  barcodeType,
  sku,
  productName,
  price,
  lotNo,
  expiryDate,
  location,
  showPrice,
  showLot,
  showLocation,
}: {
  size: LabelSize;
  barcodeType: 'BARCODE' | 'QR' | 'BOTH';
  sku: string;
  productName: string;
  price: string;
  lotNo: string;
  expiryDate: string;
  location: string;
  showPrice: boolean;
  showLot: boolean;
  showLocation: boolean;
}) {
  const isLarge = size === '100x75';
  const isSmall = size === '40x25';

  return (
    <div
      className={cn(
        "bg-white border border-black text-black font-sans flex flex-col justify-between overflow-hidden shadow-sm",
        size === '100x75' && "w-[380px] h-[285px] p-5",
        size === '50x30' && "w-[280px] h-[170px] p-3",
        size === '40x25' && "w-[220px] h-[135px] p-2",
        size === 'a4' && "w-[230px] h-[140px] p-2.5"
      )}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between border-b border-black pb-1 mb-1">
          <span className="font-black text-[10px] tracking-wider uppercase">NEXUS WMS</span>
          {showLocation && location && (
            <span className="font-mono font-bold text-[10px] bg-black text-white px-1.5 py-0.2 rounded">
              {location}
            </span>
          )}
        </div>

        <div className={cn(
          "font-bold line-clamp-2 leading-tight",
          isLarge ? "text-base" : isSmall ? "text-[11px]" : "text-xs"
        )}>
          {productName || 'ชื่อสินค้า'}
        </div>
      </div>

      {/* Barcode & QR Center */}
      <div className="my-auto flex items-center justify-center gap-3">
        {(barcodeType === 'BARCODE' || barcodeType === 'BOTH') && (
          <div className="flex flex-col items-center">
            <Barcode
              value={sku || 'SKU-001'}
              width={isLarge ? 1.8 : isSmall ? 1.0 : 1.2}
              height={isLarge ? 45 : isSmall ? 25 : 32}
              fontSize={isLarge ? 11 : 9}
              margin={0}
            />
          </div>
        )}

        {(barcodeType === 'QR' || barcodeType === 'BOTH') && (
          <div className="shrink-0">
            <QRCodeSVG
              value={sku || 'SKU-001'}
              size={isLarge ? 65 : isSmall ? 35 : 45}
            />
          </div>
        )}
      </div>

      {/* Bottom Info Footer */}
      <div className="border-t border-black pt-1 flex items-center justify-between text-[9px] font-semibold">
        {showLot && (lotNo || expiryDate) ? (
          <div>
            {lotNo && <div>Lot: {lotNo}</div>}
            {expiryDate && <div>Exp: {expiryDate}</div>}
          </div>
        ) : (
          <span className="font-mono">{sku}</span>
        )}

        {showPrice && price && (
          <div className={cn("font-black text-right", isLarge ? "text-sm" : "text-xs")}>
            ฿{price}
          </div>
        )}
      </div>
    </div>
  );
}
