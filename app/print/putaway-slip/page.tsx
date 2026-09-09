'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';
import Barcode from 'react-barcode';

interface Line { sku: string; name: string; expectedQty: number; receivedQty?: number; putawayBin?: string; }
interface Receipt {
  id: string;
  receiptNo: string;
  poNumber: string;
  supplier: string;
  status: string;
  items: Line[];
  createdAt: string;
  completedAt: string | null;
}

function PutawaySlipDoc() {
  const id = useSearchParams().get('id');
  const [rc, setRc] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/receiving?id=${id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(setRc).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DocLoading />;
  if (!rc) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบเอกสารรับเข้า</div>;

  const date = rc.createdAt ? new Date(rc.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
  const totalQty = rc.items.reduce((s, l) => s + (l.receivedQty || l.expectedQty || 0), 0);

  // Sort items by target putaway bin so staff walk smoothly
  const sortedItems = [...rc.items].sort((a, b) => (a.putawayBin || 'ZZZ').localeCompare(b.putawayBin || 'ZZZ'));

  return (
    <DocumentShell
      docType="ใบนำส่งจัดเก็บเข้าที่"
      docTypeEn="Putaway Task Slip"
      docNo={rc.receiptNo}
      printLabel="พิมพ์ใบจัดเก็บเข้าช่อง"
      meta={[
        { label: 'วันที่รับเข้า', value: date },
        { label: 'ผู้ขาย / แหล่งที่มา', value: rc.supplier || '-' },
        ...(rc.poNumber ? [{ label: 'เลขอ้างอิง PO', value: <span className="font-mono">{rc.poNumber}</span> }] : []),
        { label: 'จำนวนรายการ', value: `${rc.items.length} รายการ (${totalQty.toLocaleString()} ชิ้น)` },
      ]}
    >
      <div className="mb-4 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <span className="font-bold text-slate-700">คำแนะนำพนักงานจัดเก็บ (Putaway Instructions):</span> นำสินค้าไปวางยังช่องจัดเก็บ (Bin) ที่ระบุในตาราง แล้วใช้เครื่องสแกนบาร์โค้ดสแกนยืนยันช่องจัดเก็บ
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b-2 border-slate-200">
              <th className="py-2 pr-2 font-semibold w-8">#</th>
              <th className="py-2 px-2 font-semibold">ตำแหน่งเป้าหมาย (Bin)</th>
              <th className="py-2 px-2 font-semibold">บาร์โค้ด / รหัส SKU</th>
              <th className="py-2 px-2 font-semibold">รายการสินค้า</th>
              <th className="py-2 px-2 font-semibold text-right">จำนวนเก็บ</th>
              <th className="py-2 pl-2 font-semibold text-center w-16">ตรวจสอบ</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((l, i) => {
              const qty = l.receivedQty !== undefined ? l.receivedQty : l.expectedQty;
              return (
                <tr key={l.sku + i} className="border-b border-slate-100">
                  <td className="py-3 pr-2 text-slate-400">{i + 1}</td>
                  <td className="py-3 px-2">
                    <span className="font-mono font-black text-base px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300">
                      {l.putawayBin || 'รอจัดสรร'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="font-mono text-xs font-bold text-slate-800">{l.sku}</div>
                    <div className="mt-1 hidden print:block">
                      <Barcode value={l.sku} width={1.2} height={26} fontSize={10} displayValue={false} margin={0} />
                    </div>
                  </td>
                  <td className="py-3 px-2 font-medium text-slate-800 max-w-[240px]">{l.name}</td>
                  <td className="py-3 px-2 text-right font-black text-base tabular-nums text-slate-900">{qty.toLocaleString()}</td>
                  <td className="py-3 pl-2 text-center">
                    <span className="inline-block w-6 h-6 border-2 border-slate-300 rounded" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-bold">
              <td colSpan={4} className="py-3 text-right">รวมจำนวนสินค้าทั้งหมด:</td>
              <td className="py-3 px-2 text-right font-black text-lg text-slate-900">{totalQty.toLocaleString()}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-slate-200 text-sm">
        <div className="border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">พนักงานจัดเก็บ (Putaway Operator)</div>
          <div className="border-b border-dashed border-slate-400 w-48 mx-auto mb-2" />
          <div className="text-xs text-slate-500">ลงชื่อ / วันที่</div>
        </div>
        <div className="border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">หัวหน้าคลังตรวจรับ (Warehouse Supervisor)</div>
          <div className="border-b border-dashed border-slate-400 w-48 mx-auto mb-2" />
          <div className="text-xs text-slate-500">ลงชื่อ / วันที่</div>
        </div>
      </div>
    </DocumentShell>
  );
}

export default function PutawaySlipPage() {
  return (
    <Suspense fallback={<DocLoading />}>
      <PutawaySlipDoc />
    </Suspense>
  );
}
