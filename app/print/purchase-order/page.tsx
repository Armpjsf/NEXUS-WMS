'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';

interface Line { sku?: string; id?: string; name: string; qty: number; price?: number; total?: number; }

function PurchaseOrderDoc() {
  const id = useSearchParams().get('id');
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/po/create?id=${id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setPo(d?.order || null)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DocLoading />;
  if (!po) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบใบสั่งซื้อ</div>;

  const items: Line[] = Array.isArray(po.items_json) ? po.items_json : [];
  const date = po.created_at ? new Date(po.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
  const grand = Number(po.total_amount || 0);

  return (
    <DocumentShell docType="ใบสั่งซื้อ" docTypeEn="Purchase Order" docNo={po.po_number} printLabel="พิมพ์ใบสั่งซื้อ"
      meta={[
        { label: 'วันที่', value: date },
        { label: 'ผู้ขาย', value: po.supplier || '-' },
        { label: 'สถานะ', value: po.status || 'DRAFT' },
      ]}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b-2 border-slate-200">
              <th className="py-2 pr-2 font-semibold w-8">#</th>
              <th className="py-2 px-2 font-semibold">รายการ</th>
              <th className="py-2 px-2 font-semibold text-right">จำนวน</th>
              <th className="py-2 px-2 font-semibold text-right">ราคา/หน่วย</th>
              <th className="py-2 pl-2 font-semibold text-right">รวม</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => {
              const lineTotal = Number(l.total ?? (Number(l.qty || 0) * Number(l.price || 0)));
              return (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2.5 pr-2 text-slate-400">{i + 1}</td>
                  <td className="py-2.5 px-2 font-medium">{l.name}{(l.sku || l.id) && <span className="ml-2 font-mono text-xs text-slate-400">{l.sku || l.id}</span>}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{Number(l.qty || 0).toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-slate-500">฿{Number(l.price || 0).toLocaleString()}</td>
                  <td className="py-2.5 pl-2 text-right font-bold tabular-nums">฿{lineTotal.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-black text-base"><td colSpan={4} className="py-3 px-2 text-right">ยอดรวมทั้งสิ้น</td><td className="py-3 pl-2 text-right tabular-nums">฿{grand.toLocaleString()}</td></tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-10 mt-14 text-sm">
        <div className="text-center"><div className="h-16 border-b border-slate-300" /><div className="mt-2 text-slate-500">ผู้สั่งซื้อ</div></div>
        <div className="text-center"><div className="h-16 border-b border-slate-300" /><div className="mt-2 text-slate-500">ผู้อนุมัติ</div></div>
      </div>
    </DocumentShell>
  );
}

export default function Page() {
  return <Suspense fallback={<DocLoading />}><PurchaseOrderDoc /></Suspense>;
}
