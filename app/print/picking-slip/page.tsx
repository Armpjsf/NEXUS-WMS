'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';

interface Line { sku: string; name: string; qty: number; location?: string; }
interface Order {
  orderNo: string; customerName: string; status: string; priority: string;
  items: Line[]; totalQty: number; createdAt: string;
}

function PickingSlipDoc() {
  const id = useSearchParams().get('id');
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
  // Sort by bin location for an efficient pick path
  const items = [...order.items].sort((a, b) => (a.location || '').localeCompare(b.location || ''));

  return (
    <DocumentShell docType="ใบเบิกสินค้า" docTypeEn="Picking Slip" docNo={order.orderNo} printLabel="พิมพ์ใบเบิก"
      meta={[
        { label: 'วันที่', value: date },
        { label: 'ลูกค้า', value: order.customerName || '-' },
        ...(order.priority === 'URGENT' ? [{ label: 'ความสำคัญ', value: 'ด่วน' }] : []),
      ]}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b-2 border-slate-200">
              <th className="py-2 pr-2 font-semibold">ตำแหน่ง</th>
              <th className="py-2 px-2 font-semibold">รหัส</th>
              <th className="py-2 px-2 font-semibold">รายการ</th>
              <th className="py-2 px-2 font-semibold text-right">หยิบ</th>
              <th className="py-2 pl-2 font-semibold text-center w-16">✓</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={l.sku + i} className="border-b border-slate-100">
                <td className="py-3 pr-2 font-mono font-bold">{l.location || '-'}</td>
                <td className="py-3 px-2 font-mono text-xs">{l.sku}</td>
                <td className="py-3 px-2 font-medium">{l.name}</td>
                <td className="py-3 px-2 text-right font-black tabular-nums text-lg">{l.qty.toLocaleString()}</td>
                <td className="py-3 pl-2 text-center"><span className="inline-block w-5 h-5 border-2 border-slate-300 rounded" /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-black"><td colSpan={3} className="py-3 px-2 text-right">รวมหยิบ</td><td className="py-3 px-2 text-right tabular-nums">{order.totalQty.toLocaleString()} ชิ้น</td><td /></tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-14 text-sm max-w-xs">
        <div className="h-16 border-b border-slate-300" /><div className="mt-2 text-slate-500 text-center">ผู้หยิบสินค้า</div>
      </div>
    </DocumentShell>
  );
}

export default function Page() {
  return <Suspense fallback={<DocLoading />}><PickingSlipDoc /></Suspense>;
}
