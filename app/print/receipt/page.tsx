'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';

interface Line { sku: string; name: string; expectedQty: number; receivedQty?: number; putawayBin?: string; }
interface Receipt {
  receiptNo: string; poNumber: string; supplier: string; status: string;
  items: Line[]; createdAt: string; completedAt: string | null;
}

function ReceiptDoc() {
  const id = useSearchParams().get('id');
  const [rc, setRc] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/receiving?id=${id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(setRc).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DocLoading />;
  if (!rc) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบใบรับเข้า</div>;

  const date = rc.createdAt ? new Date(rc.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
  const totalRecv = rc.items.reduce((s, l) => s + (Number(l.receivedQty) || 0), 0);

  return (
    <DocumentShell docType="ใบรับเข้าสินค้า" docTypeEn="Goods Received Note" docNo={rc.receiptNo} printLabel="พิมพ์ใบรับเข้า"
      meta={[
        { label: 'วันที่', value: date },
        { label: 'ผู้ขาย', value: rc.supplier || '-' },
        ...(rc.poNumber ? [{ label: 'อ้างอิง PO', value: <span className="font-mono">{rc.poNumber}</span> }] : []),
      ]}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b-2 border-slate-200">
              <th className="py-2 pr-2 font-semibold w-8">#</th>
              <th className="py-2 px-2 font-semibold">รหัส</th>
              <th className="py-2 px-2 font-semibold">รายการ</th>
              <th className="py-2 px-2 font-semibold text-right">คาด</th>
              <th className="py-2 px-2 font-semibold text-right">รับจริง</th>
              <th className="py-2 pl-2 font-semibold">เก็บที่</th>
            </tr>
          </thead>
          <tbody>
            {rc.items.map((l, i) => (
              <tr key={l.sku + i} className="border-b border-slate-100">
                <td className="py-2.5 pr-2 text-slate-400">{i + 1}</td>
                <td className="py-2.5 px-2 font-mono text-xs">{l.sku}</td>
                <td className="py-2.5 px-2 font-medium">{l.name}</td>
                <td className="py-2.5 px-2 text-right tabular-nums text-slate-400">{l.expectedQty}</td>
                <td className="py-2.5 px-2 text-right font-bold tabular-nums">{(l.receivedQty ?? 0).toLocaleString()}</td>
                <td className="py-2.5 pl-2 font-mono text-xs">{l.putawayBin || '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-black">
              <td colSpan={4} className="py-3 px-2 text-right">รวมรับจริง</td>
              <td className="py-3 px-2 text-right tabular-nums">{totalRecv.toLocaleString()}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-10 mt-14 text-sm">
        <div className="text-center"><div className="h-16 border-b border-slate-300" /><div className="mt-2 text-slate-500">ผู้รับเข้า / ตรวจนับ</div></div>
        <div className="text-center"><div className="h-16 border-b border-slate-300" /><div className="mt-2 text-slate-500">ผู้ส่งมอบ</div></div>
      </div>
    </DocumentShell>
  );
}

export default function Page() {
  return <Suspense fallback={<DocLoading />}><ReceiptDoc /></Suspense>;
}
