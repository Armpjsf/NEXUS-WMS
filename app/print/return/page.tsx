'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';

interface Line { sku: string; name: string; qty: number; }
interface Rma {
  rmaNo: string; orderNo: string; customerName: string; reason: string; status: string;
  disposition: string; items: Line[]; createdAt: string;
}

const STATUS_TH: Record<string, string> = { REQUESTED: 'ขอคืน', APPROVED: 'อนุมัติ', RECEIVED: 'รับของคืน', RESTOCKED: 'คืนสต็อก', SCRAPPED: 'ทิ้ง/เสีย', REJECTED: 'ปฏิเสธ' };

function ReturnDoc() {
  const id = useSearchParams().get('id');
  const [rma, setRma] = useState<Rma | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/returns?id=${id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(setRma).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DocLoading />;
  if (!rma) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบใบคืนสินค้า</div>;

  const date = rma.createdAt ? new Date(rma.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
  const total = rma.items.reduce((s, l) => s + l.qty, 0);

  return (
    <DocumentShell docType="ใบคืนสินค้า" docTypeEn="Return / RMA" docNo={rma.rmaNo} printLabel="พิมพ์ใบคืน"
      meta={[
        { label: 'วันที่', value: date },
        { label: 'สถานะ', value: STATUS_TH[rma.status] || rma.status },
        ...(rma.orderNo ? [{ label: 'อ้างอิงออเดอร์', value: <span className="font-mono">{rma.orderNo}</span> }] : []),
      ]}>
      <div className="mb-6 rounded-xl bg-slate-50 border border-slate-100 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">ลูกค้า / เหตุผลการคืน</div>
        <div className="font-black text-base">{rma.customerName || '-'}</div>
        {rma.reason && <div className="text-sm text-slate-600 mt-0.5">เหตุผล: {rma.reason}</div>}
      </div>

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
            {rma.items.map((l, i) => (
              <tr key={l.sku + i} className="border-b border-slate-100">
                <td className="py-2.5 pr-2 text-slate-400">{i + 1}</td>
                <td className="py-2.5 px-2 font-mono text-xs">{l.sku}</td>
                <td className="py-2.5 px-2 font-medium">{l.name}</td>
                <td className="py-2.5 pl-2 text-right font-bold tabular-nums">{l.qty.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-black"><td colSpan={3} className="py-3 px-2 text-right">รวมจำนวน</td><td className="py-3 pl-2 text-right tabular-nums">{total.toLocaleString()} ชิ้น</td></tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-10 mt-14 text-sm">
        <div className="text-center"><div className="h-16 border-b border-slate-300" /><div className="mt-2 text-slate-500">ผู้คืนสินค้า</div></div>
        <div className="text-center"><div className="h-16 border-b border-slate-300" /><div className="mt-2 text-slate-500">ผู้รับคืน</div></div>
      </div>
    </DocumentShell>
  );
}

export default function Page() {
  return <Suspense fallback={<DocLoading />}><ReturnDoc /></Suspense>;
}
