'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';

interface Line { sku: string; name: string; qty: number; price?: number; }
interface Order {
  orderNo: string; customerName: string; phone: string; shipAddress: string; status: string;
  items: Line[]; totalQty: number; totalAmount: number; carrier: string; trackingNo: string;
  createdAt: string; podNote: string; podSignature: string;
}

function DeliveryNote() {
  const params = useSearchParams();
  const id = params.get('id');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/orders?id=${id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(setOrder).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DocLoading />;
  if (!order) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบออเดอร์</div>;

  const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

  return (
    <DocumentShell
      docType="ใบส่งสินค้า"
      docTypeEn="Delivery Note"
      docNo={order.orderNo}
      printLabel="พิมพ์ใบส่ง"
      meta={[
        { label: 'วันที่', value: date },
        ...(order.carrier ? [{ label: 'ขนส่ง', value: order.carrier }] : []),
        ...(order.trackingNo ? [{ label: 'Tracking', value: <span className="font-mono">{order.trackingNo}</span> }] : []),
      ]}
    >
      {/* Recipient */}
      <div className="mb-6 rounded-xl bg-slate-50 border border-slate-100 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">ผู้รับสินค้า</div>
        <div className="font-black text-base">{order.customerName || '-'}</div>
        {order.phone && <div className="text-sm text-slate-600">โทร. {order.phone}</div>}
        {order.shipAddress && <div className="text-sm text-slate-600 mt-0.5 whitespace-pre-line">{order.shipAddress}</div>}
      </div>

      {/* Items */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b-2 border-slate-200">
              <th className="py-2 pr-2 font-semibold w-8">#</th>
              <th className="py-2 px-2 font-semibold">รหัส</th>
              <th className="py-2 px-2 font-semibold">รายการ</th>
              <th className="py-2 pl-2 font-semibold text-right">จำนวน</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((l, i) => (
              <tr key={l.sku + i} className="border-b border-slate-100">
                <td className="py-2.5 pr-2 text-slate-400">{i + 1}</td>
                <td className="py-2.5 px-2 font-mono text-xs">{l.sku}</td>
                <td className="py-2.5 px-2 font-medium">{l.name}</td>
                <td className="py-2.5 pl-2 text-right font-bold tabular-nums">{l.qty.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-black">
              <td colSpan={3} className="py-3 px-2 text-right">รวมจำนวน</td>
              <td className="py-3 pl-2 text-right tabular-nums">{order.totalQty.toLocaleString()} ชิ้น</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-10 mt-14 text-sm">
        <div className="text-center">
          <div className="h-20 border-b border-slate-300 flex items-end justify-center pb-1">
            {order.podSignature && <img src={order.podSignature} alt="ลายเซ็นผู้รับ" className="h-16 object-contain" />}
          </div>
          <div className="mt-2 text-slate-500">ผู้รับสินค้า{order.podNote ? ` · ${order.podNote}` : ''}</div>
        </div>
        <div className="text-center">
          <div className="h-20 border-b border-slate-300" />
          <div className="mt-2 text-slate-500">ผู้ส่งสินค้า</div>
        </div>
      </div>
    </DocumentShell>
  );
}

export default function Page() {
  return <Suspense fallback={<DocLoading />}><DeliveryNote /></Suspense>;
}
