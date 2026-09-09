'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Line { sku: string; name: string; qty: number; }
interface Order {
  id: string;
  orderNo: string;
  channel: string;
  customerName: string;
  phone: string;
  shipAddress: string;
  carrier: string;
  trackingNo: string;
  items: Line[];
  totalQty: number;
  totalAmount: number;
  createdAt: string;
}

interface Org {
  name: string;
  brandingLogo: string;
  brandingColor: string;
}

function ShippingLabelDoc() {
  const id = useSearchParams().get('id');
  const [order, setOrder] = useState<Order | null>(null);
  const [org, setOrg] = useState<Org>({ name: 'WMS 360 PRO', brandingLogo: '', brandingColor: '#0ea5e9' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/orders?id=${id}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/org', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    ]).then(([dOrder, dOrg]) => {
      setOrder(dOrder);
      if (dOrg?.name) setOrg(dOrg);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-slate-400">กำลังเตรียมพิมพ์ฉลาก...</div>;
  }
  if (!order) {
    return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบข้อมูลออเดอร์</div>;
  }

  // Extract postal code from address if possible
  const postalMatch = (order.shipAddress || '').match(/\b\d{5}\b/);
  const postalCode = postalMatch ? postalMatch[0] : '';
  const carrierName = (order.carrier || 'STANDARD DELIVERY').toUpperCase();
  const tracking = order.trackingNo || order.orderNo;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-4 print:p-0 flex flex-col items-center">
      {/* Control bar */}
      <div className="w-full max-w-[100mm] mb-4 flex justify-between items-center no-print">
        <Link href="/ops/orders" className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> กลับหน้าออเดอร์
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-md active:scale-95 transition-transform"
        >
          <Printer className="w-4 h-4" /> พิมพ์สติกเกอร์ (100x150 mm)
        </button>
      </div>

      {/* 4x6 Thermal Label Container (100mm x 150mm) */}
      <div
        className="w-[100mm] min-h-[150mm] bg-white border border-slate-300 print:border-none shadow-xl print:shadow-none p-3.5 flex flex-col justify-between text-slate-900 overflow-hidden box-border"
        style={{ fontFamily: 'sans-serif' }}
      >
        <style>{`
          @media print {
            .no-print { display: none !important; }
            @page { size: 100mm 150mm; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>

        {/* Top Header: Carrier & Channel */}
        <div className="border-b-2 border-black pb-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-2xl font-black tracking-tight leading-none text-black">
                {carrierName}
              </div>
              <div className="text-[10px] font-bold text-slate-500 tracking-wider mt-0.5">
                EXPRESS DOMESTIC DELIVERY
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 bg-black text-white font-bold text-xs uppercase rounded">
                {order.channel || 'STANDARD'}
              </span>
              <div className="text-[10px] font-mono font-bold text-slate-600 mt-1">{order.orderNo}</div>
            </div>
          </div>

          {/* Big Tracking Barcode */}
          <div className="mt-2 text-center flex flex-col items-center">
            <Barcode
              value={tracking}
              width={1.7}
              height={44}
              fontSize={13}
              margin={0}
              displayValue={true}
            />
          </div>
        </div>

        {/* Sender & Recipient Section */}
        <div className="border-b-2 border-black py-2.5 space-y-2 text-xs">
          {/* Sender */}
          <div className="text-[11px] leading-snug">
            <span className="font-bold text-black">ผู้ส่ง (FROM): </span>
            <span className="font-semibold">{org.name}</span>
            <span className="text-slate-600"> (ศูนย์กระจายสินค้าหลัก)</span>
          </div>

          {/* Recipient */}
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ผู้รับ (TO):</div>
            <div className="text-sm font-black text-black mt-0.5">{order.customerName || 'ลูกค้าปลายทาง'}</div>
            {order.phone && <div className="text-xs font-bold text-slate-800">โทร: {order.phone}</div>}
            <div className="text-xs text-slate-700 mt-1 leading-relaxed">{order.shipAddress || 'ไม่ระบุที่อยู่'}</div>

            {/* Big Postal Code Box */}
            {postalCode && (
              <div className="mt-2 flex justify-end">
                <div className="border-2 border-black px-3 py-1 text-center bg-black text-white font-mono font-black text-lg tracking-widest rounded">
                  {postalCode}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Package Contents Summary */}
        <div className="py-2 border-b border-dashed border-slate-300 flex-1">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            <span>รายการสินค้า ({order.items.length} รายการ · รวม {order.totalQty} ชิ้น)</span>
            <span>จำนวน</span>
          </div>
          <div className="space-y-1 text-xs max-h-24 overflow-hidden">
            {order.items.slice(0, 4).map((l, i) => (
              <div key={i} className="flex justify-between items-center text-[11px]">
                <span className="truncate pr-2 text-slate-700">{l.name}</span>
                <span className="font-mono font-bold text-black shrink-0">x{l.qty}</span>
              </div>
            ))}
            {order.items.length > 4 && (
              <div className="text-[10px] text-slate-400 italic">...และรายการอื่นๆ อีก {order.items.length - 4} รายการ</div>
            )}
          </div>
        </div>

        {/* Bottom Bar: QR Code, COD, Signatures */}
        <div className="pt-2 flex justify-between items-end text-xs">
          <div className="flex items-center gap-2">
            <QRCodeSVG value={tracking} size={42} />
            <div className="text-[10px] text-slate-500 leading-tight">
              <div>สแกนตรวจสอบพัสดุ</div>
              <div className="font-mono font-bold text-black">{new Date(order.createdAt).toLocaleDateString('th-TH')}</div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase">ยอดเก็บเงิน (COD)</div>
            <div className="text-base font-black text-black">
              ฿{order.totalAmount ? order.totalAmount.toLocaleString() : '0.00'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShippingLabelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-slate-400">กำลังโหลด...</div>}>
      <ShippingLabelDoc />
    </Suspense>
  );
}
