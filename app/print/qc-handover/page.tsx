'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';
import { MapPin, UserCheck, ShieldCheck } from 'lucide-react';

interface OrderLine {
  sku: string;
  name: string;
  qty: number;
}

interface DeliveryDestination {
  drop: number;
  name: string;
  phone: string;
  address: string;
  notes?: string;
}

interface QCSignatures {
  clientSignature?: string;
  clientName?: string;
  staffSignature?: string;
  staffName?: string;
  signedAt?: string;
  notes?: string;
}

interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  phone: string;
  shipAddress: string;
  items: OrderLine[];
  totalQty: number;
  createdAt: string;
  pickedAt?: string | null;
  destinations?: DeliveryDestination[];
  qcSignatures?: QCSignatures;
}

function QCHandoverSlip() {
  const params = useSearchParams();
  const id = params.get('id');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/orders?id=${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DocLoading />;
  if (!order) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบข้อมูลออเดอร์</div>;

  const signTime = order.qcSignatures?.signedAt || order.pickedAt || order.createdAt;
  const dateStr = signTime
    ? new Date(signTime).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  const destinations =
    order.destinations && order.destinations.length > 0
      ? order.destinations
      : [
          {
            drop: 1,
            name: order.customerName || 'ผู้รับสินค้า',
            phone: order.phone || '',
            address: order.shipAddress || '-',
          },
        ];

  return (
    <DocumentShell
      docType="ใบตรวจรับมอบสินค้า"
      docTypeEn="QC & HANDOVER SLIP"
      docNo={order.orderNo}
      printLabel="พิมพ์ใบตรวจรับมอบ (PDF)"
      meta={[
        { label: 'วันที่-เวลาตรวจรับ', value: dateStr },
        { label: 'ลูกค้าผู้ส่งมอบ', value: order.customerName || '-' },
        ...(order.phone ? [{ label: 'เบอร์โทรศัพท์', value: order.phone }] : []),
      ]}
    >
      {/* Customer Header Info */}
      <div className="mb-6 rounded-xl bg-slate-50 border border-slate-200/80 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          ลูกค้า / ผู้ส่งมอบสินค้า
        </div>
        <div className="font-black text-base text-slate-900">{order.customerName || '-'}</div>
        {order.phone && <div className="text-sm text-slate-600">เบอร์ติดต่อ: {order.phone}</div>}
      </div>

      {/* Part 1: Inspection Items Table */}
      <div className="mb-8">
        <div className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>รายการสินค้าที่ตรวจรับมอบ ({order.items.length} รายการ)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b-2 border-slate-200 bg-slate-50/50">
                <th className="py-2.5 px-3 font-bold w-12 text-center">ลำดับ</th>
                <th className="py-2.5 px-3 font-bold w-36">รหัสสินค้า (SKU)</th>
                <th className="py-2.5 px-3 font-bold">ชื่อรายการสินค้า</th>
                <th className="py-2.5 px-3 font-bold text-right w-28">จำนวนตรวจรับ</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={it.sku + i} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-slate-400 text-center font-medium">{i + 1}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-xs">{it.sku}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{it.name}</td>
                  <td className="py-2.5 px-3 text-right font-black font-mono text-emerald-800">
                    {it.qty.toLocaleString()} ชิ้น
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-black bg-slate-50/80">
                <td colSpan={3} className="py-3 px-3 text-right text-slate-700">
                  รวมจำนวนสินค้าที่ตรวจรับมอบทั้งสิ้น:
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-700 text-base">
                  {order.totalQty.toLocaleString()} ชิ้น
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Part 2: Multi-Drop Delivery Destinations */}
      <div className="mb-8">
        <div className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-cyan-600" />
          <span>สถานที่จัดส่งปลายทาง ({destinations.length} จุดส่ง)</span>
        </div>
        <div className="space-y-2.5">
          {destinations.map((d) => (
            <div key={d.drop} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-black text-cyan-900 bg-cyan-100 px-2.5 py-0.5 rounded-md">
                  ดรอปที่ {d.drop}
                </span>
                {d.phone && <span className="font-semibold text-slate-600">โทร: {d.phone}</span>}
              </div>
              <div className="font-bold text-slate-800 text-sm mb-0.5">{d.name}</div>
              <div className="text-slate-600 leading-relaxed whitespace-pre-line">{d.address}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Part 3: Dual Signatures */}
      <div className="mt-8 pt-4 border-t-2 border-slate-200">
        <div className="text-xs font-black uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-1.5">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>การลงนามยืนยันความถูกต้อง 2 ฝ่าย</span>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Customer Signature (Sender) */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center justify-between min-h-[160px]">
            <div className="text-xs font-bold text-slate-500 uppercase text-center mb-1">
              ผู้ส่งมอบสินค้า (ตัวแทนลูกค้า)
            </div>
            <div className="h-20 flex items-center justify-center w-full my-1">
              {order.qcSignatures?.clientSignature ? (
                <img
                  src={order.qcSignatures.clientSignature}
                  alt="ลายเซ็นผู้ส่งมอบ"
                  className="max-h-16 max-w-[90%] object-contain"
                />
              ) : (
                <div className="w-48 border-b-2 border-dashed border-slate-300 h-10" />
              )}
            </div>
            <div className="text-center w-full border-t border-slate-200 pt-2">
              <div className="font-bold text-slate-800 text-xs">
                ( {order.qcSignatures?.clientName || order.customerName || '...................................................'} )
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                วันที่: {dateStr}
              </div>
            </div>
          </div>

          {/* Warehouse Staff Signature (Receiver QC) */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center justify-between min-h-[160px]">
            <div className="text-xs font-bold text-slate-500 uppercase text-center mb-1">
              ผู้ตรวจรับมอบสินค้า (เจ้าหน้าที่ QC คลัง)
            </div>
            <div className="h-20 flex items-center justify-center w-full my-1">
              {order.qcSignatures?.staffSignature ? (
                <img
                  src={order.qcSignatures.staffSignature}
                  alt="ลายเซ็นผู้ตรวจรับ"
                  className="max-h-16 max-w-[90%] object-contain"
                />
              ) : (
                <div className="w-48 border-b-2 border-dashed border-slate-300 h-10" />
              )}
            </div>
            <div className="text-center w-full border-t border-slate-200 pt-2">
              <div className="font-bold text-slate-800 text-xs">
                ( {order.qcSignatures?.staffName || 'เจ้าหน้าที่ QC ตรวจรับ'} )
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                วันที่: {dateStr}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DocumentShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<DocLoading />}>
      <QCHandoverSlip />
    </Suspense>
  );
}
