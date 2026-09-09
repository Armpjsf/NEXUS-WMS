'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';
import Barcode from 'react-barcode';

interface PickItem {
  id: string;
  sku: string;
  productName: string;
  requestedQty: number;
  pickedQty?: number;
  location: string;
  pickSequence?: number;
  category?: string;
  unit?: string;
}

interface Wave {
  id: string;
  waveNumber: string;
  pickerName?: string;
  status: string;
  totalOrders: number;
  totalItems: number;
  totalQty: number;
  items: PickItem[];
  createdAt: string;
}

function WaveSlipDoc() {
  const id = useSearchParams().get('id');
  const [wave, setWave] = useState<Wave | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/orders/fulfillment?id=${id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.wave) setWave(d.wave);
        else if (d?.id) setWave(d);
        else setWave(null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DocLoading />;
  if (!wave) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบข้อมูล Wave Picking</div>;

  const date = wave.createdAt ? new Date(wave.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  const items = [...(wave.items || [])].sort((a, b) => (a.pickSequence || 0) - (b.pickSequence || 0));

  return (
    <DocumentShell
      docType="ใบรวมหยิบสินค้า"
      docTypeEn="Wave Picking Slip (S-Shape)"
      docNo={wave.waveNumber}
      printLabel="พิมพ์ใบรวมหยิบ"
      meta={[
        { label: 'วันที่รวม Wave', value: date },
        { label: 'พนักงานหยิบ (Picker)', value: wave.pickerName || 'พนักงานคลัง' },
        { label: 'จำนวนออเดอร์', value: `${wave.totalOrders || 1} ออเดอร์` },
        { label: 'ยอดรวมสินค้า', value: `${wave.totalQty || items.reduce((s, l) => s + l.requestedQty, 0)} ชิ้น (${items.length} จุดหยิบ)` },
      ]}
    >
      <div className="mb-4 text-xs text-slate-600 bg-amber-50/80 p-3 rounded-xl border border-amber-200">
        <span className="font-bold text-amber-800">S-Shape Optimized Route:</span> รายการถูกจัดเรียงตามลำดับเส้นทางเดินในคลังสินค้าแบบตัว S (Aisle คี่เดินขึ้น / Aisle คู่เดินลง) เพื่อลดระยะทางและเวลาเดินหยิบสูงสุด
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b-2 border-slate-200">
              <th className="py-2 pr-2 font-semibold w-12 text-center">ลำดับ</th>
              <th className="py-2 px-2 font-semibold">ตำแหน่ง (Bin)</th>
              <th className="py-2 px-2 font-semibold">บาร์โค้ด / SKU</th>
              <th className="py-2 px-2 font-semibold">รายการสินค้า</th>
              <th className="py-2 px-2 font-semibold text-right">จำนวนหยิบ</th>
              <th className="py-2 pl-2 font-semibold text-center w-16">หยิบแล้ว</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id || it.sku + i} className="border-b border-slate-100">
                <td className="py-3 pr-2 text-center font-bold text-amber-600">
                  <span className="inline-block w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs leading-6">
                    {it.pickSequence || (i + 1)}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <span className="font-mono font-black text-base px-2.5 py-1 rounded bg-slate-100 text-slate-800">
                    {it.location || 'Unassigned'}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <div className="font-mono text-xs font-bold text-slate-800">{it.sku}</div>
                  <div className="mt-1 hidden print:block">
                    <Barcode value={it.sku} width={1.2} height={24} fontSize={10} displayValue={false} margin={0} />
                  </div>
                </td>
                <td className="py-3 px-2 font-medium text-slate-800 max-w-[240px]">{it.productName}</td>
                <td className="py-3 px-2 text-right font-black text-lg tabular-nums text-slate-900">
                  {it.requestedQty.toLocaleString()} {it.unit || 'pcs'}
                </td>
                <td className="py-3 pl-2 text-center">
                  <span className="inline-block w-6 h-6 border-2 border-slate-300 rounded" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-bold">
              <td colSpan={4} className="py-3 text-right">รวมจำนวนสินค้าทั้งหมดที่ต้องหยิบ:</td>
              <td className="py-3 px-2 text-right font-black text-xl text-slate-900">
                {items.reduce((s, l) => s + l.requestedQty, 0).toLocaleString()}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-slate-200 text-sm">
        <div className="border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">พนักงานเดินหยิบ (Order Picker)</div>
          <div className="border-b border-dashed border-slate-400 w-48 mx-auto mb-2" />
          <div className="text-xs text-slate-500">ลงชื่อ / เวลาเริ่ม-เสร็จ</div>
        </div>
        <div className="border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">พนักงานตรวจสอบยอดและแพ็ก (Packing QC)</div>
          <div className="border-b border-dashed border-slate-400 w-48 mx-auto mb-2" />
          <div className="text-xs text-slate-500">ลงชื่อ / เวลาตรวจ</div>
        </div>
      </div>
    </DocumentShell>
  );
}

export default function WaveSlipPage() {
  return (
    <Suspense fallback={<DocLoading />}>
      <WaveSlipDoc />
    </Suspense>
  );
}
