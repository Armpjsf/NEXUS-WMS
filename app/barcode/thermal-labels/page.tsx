'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  Barcode as BarcodeIcon,
  QrCode,
  Truck,
  Box,
  MapPin,
  Sparkles,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { usePdaScanner } from '@/hooks/usePdaScanner';

type LabelType = 'SHIPPING_100x150' | 'SHELF_100x50' | 'PRODUCT_50x30';

function ThermalLabelsContent() {
  const searchParams = useSearchParams();
  const [labelType, setLabelType] = useState<LabelType>('SHIPPING_100x150');

  // Shipping Label Form Data
  const [carrier, setCarrier] = useState('Flash Express');
  const [trackingNo, setTrackingNo] = useState('TH0123456789A');
  const [orderNo, setOrderNo] = useState('ORD-2026-9876');
  const [senderName, setSenderName] = useState('คลังสินค้า WMS 360 PRO (ศูนย์กระจายสินค้าหลัก)');
  const [senderPhone, setSenderPhone] = useState('02-999-8888');
  const [senderAddress, setSenderAddress] = useState('88/8 หมู่ 5 ถ.พหลโยธิน คลองหนึ่ง คลองหลวง ปทุมธานี 12120');

  const [recipientName, setRecipientName] = useState('คุณสมชาย ใจดี');
  const [recipientPhone, setRecipientPhone] = useState('081-234-5678');
  const [recipientAddress, setRecipientAddress] = useState('123/45 หมู่บ้านสุขสันต์ ซอย 9 แขวงบางเขน เขตสายไหม กรุงเทพมหานคร 10220');
  const [postalCode, setPostalCode] = useState('10220');

  const [codAmount, setCodAmount] = useState('0');
  const [notes, setNotes] = useState('ระวังแตก / กรุณาโทรแจ้งก่อนส่ง');
  const [items, setItems] = useState([
    { name: 'สินค้าตัวอย่าง A (SKU-001)', qty: 2 },
    { name: 'สินค้าตัวอย่าง B (SKU-002)', qty: 1 },
  ]);

  // Shelf Label Data
  const [shelfLocation, setShelfLocation] = useState('A-01-02-B');
  const [shelfZone, setShelfZone] = useState('Zone A (Fast Moving)');
  const [shelfDesc, setShelfDesc] = useState('ชั้นวางสินค้าชิ้นเล็ก ด้านหน้าคลัง');

  // Product Label Data
  const [productSku, setProductSku] = useState('SKU-PRD-8899');
  const [productName, setProductName] = useState('กล่องพัสดุ เบอร์ 0 (11x17x6 cm)');
  const [productPrice, setProductPrice] = useState('120');
  const [productUnit, setProductUnit] = useState('แพ็ก');

  useEffect(() => {
    const typeParam = searchParams.get('type') as LabelType | null;
    if (typeParam && ['SHIPPING_100x150', 'SHELF_100x50', 'PRODUCT_50x30'].includes(typeParam)) {
      setLabelType(typeParam);
    }
    if (searchParams.get('carrier')) setCarrier(searchParams.get('carrier')!);
    if (searchParams.get('tracking')) setTrackingNo(searchParams.get('tracking')!);
    if (searchParams.get('order')) setOrderNo(searchParams.get('order')!);
    if (searchParams.get('recipientName')) setRecipientName(searchParams.get('recipientName')!);
    if (searchParams.get('recipientPhone')) setRecipientPhone(searchParams.get('recipientPhone')!);
    if (searchParams.get('recipientAddress')) setRecipientAddress(searchParams.get('recipientAddress')!);
    if (searchParams.get('postalCode')) setPostalCode(searchParams.get('postalCode')!);
    if (searchParams.get('cod')) setCodAmount(searchParams.get('cod')!);
    if (searchParams.get('notes')) setNotes(searchParams.get('notes')!);

    if (searchParams.get('location')) setShelfLocation(searchParams.get('location')!);
    if (searchParams.get('zone')) setShelfZone(searchParams.get('zone')!);
    if (searchParams.get('desc')) setShelfDesc(searchParams.get('desc')!);

    if (searchParams.get('sku')) setProductSku(searchParams.get('sku')!);
    if (searchParams.get('name')) setProductName(searchParams.get('name')!);
    if (searchParams.get('price')) setProductPrice(searchParams.get('price')!);
    if (searchParams.get('unit')) setProductUnit(searchParams.get('unit')!);
  }, [searchParams]);

  // PDA Scanner auto-fill
  usePdaScanner({
    onScan: (scanned) => {
      if (labelType === 'SHIPPING_100x150') {
        setTrackingNo(scanned);
        toast.success(`PDA สแกนเลข Tracking: ${scanned}`);
      } else if (labelType === 'SHELF_100x50') {
        setShelfLocation(scanned);
        toast.success(`PDA สแกนพิกัด: ${scanned}`);
      } else {
        setProductSku(scanned);
        toast.success(`PDA สแกน SKU: ${scanned}`);
      }
    },
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8 bg-slate-50">
      <AmbientBackground />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[1.75rem] border border-amber-200 bg-white/90 p-6 shadow-xl shadow-amber-900/5 backdrop-blur-xl print:hidden">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/barcode/print"
                className="p-3 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 text-amber-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
                  <Printer className="w-8 h-8 text-amber-600" />
                  Thermal Label Designer (100x150 mm)
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  ระบบพิมพ์ใบปะหน้ากล่องพัสดุและสติ๊กเกอร์พิกัดชั้นวางสำหรับเครื่องพิมพ์ความร้อน (Thermal Printer)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black rounded-xl text-sm shadow-lg shadow-amber-600/20 flex items-center gap-2 transition-all"
              >
                <Printer className="w-4 h-4" /> สั่งพิมพ์เดี๋ยวนี้ (Print)
              </button>
            </div>
          </div>
        </header>

        {/* Template Switcher */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm print:hidden">
          <button
            onClick={() => setLabelType('SHIPPING_100x150')}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2',
              labelType === 'SHIPPING_100x150'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <Truck className="w-4 h-4" />
            ใบปะหน้าขนส่ง (Waybill 100x150 mm / 4x6 นิ้ว)
          </button>

          <button
            onClick={() => setLabelType('SHELF_100x50')}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2',
              labelType === 'SHELF_100x50'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <MapPin className="w-4 h-4" />
            สติ๊กเกอร์พิกัดชั้นวาง (Shelf/Bin 100x50 mm)
          </button>

          <button
            onClick={() => setLabelType('PRODUCT_50x30')}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2',
              labelType === 'PRODUCT_50x30'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <BarcodeIcon className="w-4 h-4" />
            สติ๊กเกอร์บาร์โค้ดสินค้า (Product 50x30 mm)
          </button>
        </div>

        {/* Main Grid: Form Controls (Left) + Live Preview (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Controls */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4 print:hidden">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              กำหนดข้อมูลใบปะหน้า (Parameters)
            </h2>

            {labelType === 'SHIPPING_100x150' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">บริษัทขนส่ง (Carrier)</label>
                    <select
                      value={carrier}
                      onChange={e => setCarrier(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    >
                      <option>Flash Express</option>
                      <option>J&T Express</option>
                      <option>Kerry Express / KEX</option>
                      <option>ไปรษณีย์ไทย (EMS)</option>
                      <option>Shopee Xpress</option>
                      <option>Lazada Express</option>
                      <option>ขนส่งเอกชน (Private)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">เลขออเดอร์ (Order No)</label>
                    <input
                      type="text"
                      value={orderNo}
                      onChange={e => setOrderNo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">
                    เลขพัสดุ (Tracking No / Barcode)
                  </label>
                  <input
                    type="text"
                    value={trackingNo}
                    onChange={e => setTrackingNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-amber-300 rounded-xl font-mono font-black text-amber-900"
                  />
                  <span className="text-[10px] text-slate-400">
                    💡 สามารถใช้เครื่องสแกน PDA ยิงเลขพัสดุเข้าฟิลด์นี้ได้โดยตรง
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-700 block mb-2">ข้อมูลผู้รับ (Recipient)</span>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="ชื่อผู้รับ"
                        value={recipientName}
                        onChange={e => setRecipientName(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                      />
                      <input
                        type="text"
                        placeholder="เบอร์โทร"
                        value={recipientPhone}
                        onChange={e => setRecipientPhone(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <textarea
                      rows={2}
                      placeholder="ที่อยู่จัดส่ง"
                      value={recipientAddress}
                      onChange={e => setRecipientAddress(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="รหัสไปรษณีย์"
                        value={postalCode}
                        onChange={e => setPostalCode(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="ยอดเก็บเงินปลายทาง COD (0 = ไม่มี)"
                        value={codAmount}
                        onChange={e => setCodAmount(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1">หมายเหตุเพิ่มเติม</span>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}

            {labelType === 'SHELF_100x50' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">รหัสพิกัดชั้นวาง (Location Code)</label>
                  <input
                    type="text"
                    value={shelfLocation}
                    onChange={e => setShelfLocation(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-amber-300 rounded-xl font-mono font-black text-lg text-amber-950"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">ชื่อโซน (Zone Name)</label>
                  <input
                    type="text"
                    value={shelfZone}
                    onChange={e => setShelfZone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">คำอธิบายตำแหน่ง</label>
                  <input
                    type="text"
                    value={shelfDesc}
                    onChange={e => setShelfDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            )}

            {labelType === 'PRODUCT_50x30' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">รหัสสินค้า / SKU</label>
                  <input
                    type="text"
                    value={productSku}
                    onChange={e => setProductSku(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-amber-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">ชื่อสินค้า</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">ราคา (บาท)</label>
                    <input
                      type="text"
                      value={productPrice}
                      onChange={e => setProductPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">หน่วยนับ</label>
                    <input
                      type="text"
                      value={productUnit}
                      onChange={e => setProductUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Thermal Preview (Right) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center">
            <div className="text-xs text-slate-400 font-mono mb-3 print:hidden">
              🔍 Live Print Preview (อัตราส่วนจริงตามขนาดกระดาษความร้อน)
            </div>

            {/* Printable Container */}
            <div className="print-label-container shadow-2xl rounded-lg overflow-hidden border border-slate-300 bg-white">
              {/* 1. SHIPPING LABEL 100x150 mm */}
              {labelType === 'SHIPPING_100x150' && (
                <div
                  className="shipping-label-100x150 p-4 bg-white text-black font-sans flex flex-col justify-between"
                  style={{ width: '100mm', minHeight: '150mm', boxSizing: 'border-box' }}
                >
                  {/* Carrier & Order Header */}
                  <div className="border-b-2 border-black pb-2 flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-black tracking-tighter uppercase">{carrier}</div>
                      <div className="text-[11px] font-mono font-bold">Ref: {orderNo}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono border-2 border-black px-2 py-0.5 rounded">
                        {postalCode}
                      </div>
                    </div>
                  </div>

                  {/* Tracking Barcode */}
                  <div className="py-2 text-center border-b-2 border-black flex flex-col items-center justify-center">
                    <Barcode
                      value={trackingNo}
                      width={1.7}
                      height={48}
                      fontSize={13}
                      margin={2}
                      displayValue={true}
                      font="monospace"
                    />
                  </div>

                  {/* Recipient & Sender Box */}
                  <div className="py-2 border-b-2 border-black grid grid-cols-12 gap-2 text-xs">
                    {/* Recipient (Major) */}
                    <div className="col-span-8 pr-2 border-r border-black">
                      <div className="text-[10px] font-bold uppercase tracking-wider">ผู้รับ (To):</div>
                      <div className="font-black text-sm">{recipientName}</div>
                      <div className="font-mono font-bold text-xs">{recipientPhone}</div>
                      <div className="text-[11px] leading-tight mt-1">{recipientAddress}</div>
                    </div>

                    {/* QR Code */}
                    <div className="col-span-4 flex flex-col items-center justify-center">
                      <QRCodeSVG value={`https://track.wms.internal/${trackingNo}`} size={64} />
                      <span className="text-[8px] font-mono mt-1 text-center font-bold">SCAN TO TRACK</span>
                    </div>
                  </div>

                  {/* Sender (Minor) */}
                  <div className="py-1.5 border-b border-black text-[10px] leading-tight">
                    <span className="font-bold">ผู้ส่ง (From): </span>
                    <span>{senderName} ({senderPhone}) {senderAddress}</span>
                  </div>

                  {/* COD & Notes */}
                  <div className="py-2 border-b-2 border-black grid grid-cols-2 gap-2 text-xs">
                    <div className="border-r border-black pr-2">
                      <span className="text-[10px] font-bold block">ยอดเก็บเงินปลายทาง (COD):</span>
                      <span className="text-lg font-black font-mono">
                        {Number(codAmount) > 0 ? `฿${Number(codAmount).toLocaleString()}` : 'ไม่มี (ชำระแล้ว)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold block">คำแนะนำ / หมายเหตุ:</span>
                      <span className="text-[11px] font-medium leading-tight">{notes}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="pt-2 text-[10px]">
                    <div className="font-bold mb-1">รายการสินค้าภายในกล่อง:</div>
                    <div className="space-y-0.5 font-mono">
                      {items.map((it, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="truncate max-w-[200px]">• {it.name}</span>
                          <span className="font-bold">x{it.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-2 pt-1 border-t border-dashed border-black text-[8px] text-center font-mono">
                    WMS 360 PRO • FULFILLMENT AUTOMATION SYSTEM
                  </div>
                </div>
              )}

              {/* 2. SHELF LABEL 100x50 mm */}
              {labelType === 'SHELF_100x50' && (
                <div
                  className="shelf-label-100x50 p-4 bg-white text-black font-sans flex flex-col justify-between"
                  style={{ width: '100mm', height: '50mm', boxSizing: 'border-box' }}
                >
                  <div className="flex justify-between items-start border-b border-black pb-1">
                    <div>
                      <div className="text-[10px] font-bold uppercase">{shelfZone}</div>
                      <div className="text-[9px] text-gray-700">{shelfDesc}</div>
                    </div>
                    <div className="text-[10px] font-mono font-bold">WMS-LOC</div>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-3xl font-black font-mono tracking-tight">{shelfLocation}</div>
                    </div>
                    <QRCodeSVG value={shelfLocation} size={48} />
                  </div>

                  <div className="flex justify-center border-t border-black pt-1">
                    <Barcode
                      value={shelfLocation}
                      width={1.6}
                      height={24}
                      fontSize={10}
                      margin={0}
                      displayValue={false}
                    />
                  </div>
                </div>
              )}

              {/* 3. PRODUCT LABEL 50x30 mm */}
              {labelType === 'PRODUCT_50x30' && (
                <div
                  className="product-label-50x30 p-2 bg-white text-black font-sans flex flex-col justify-between text-center"
                  style={{ width: '50mm', height: '30mm', boxSizing: 'border-box' }}
                >
                  <div className="text-[10px] font-bold truncate">{productName}</div>
                  <div className="flex justify-center my-0.5">
                    <Barcode
                      value={productSku}
                      width={1.2}
                      height={28}
                      fontSize={9}
                      margin={0}
                      displayValue={true}
                    />
                  </div>
                  <div className="text-xs font-black font-mono">
                    ฿{Number(productPrice).toLocaleString()} / {productUnit}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Print CSS for exact 100x150 mm Thermal Output */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-label-container,
          .print-label-container * {
            visibility: visible;
          }
          .print-label-container {
            position: absolute;
            left: 0;
            top: 0;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          @page {
            size: auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default function ThermalLabelsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-600">กำลังโหลดเทมเพลตฉลาก...</p>
          </div>
        </div>
      }
    >
      <ThermalLabelsContent />
    </Suspense>
  );
}

