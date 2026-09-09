'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';

interface CycleRecord {
  id?: string;
  product_name: string;
  location: string;
  count_date: string;
  inspector: string;
  system_qty: number;
  actual_qty: number;
  variance: number;
  status: string;
  notes?: string;
}

function CycleCountDoc() {
  const [records, setRecords] = useState<CycleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cycle-count', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(d => setRecords(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DocLoading />;
  if (records.length === 0) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบประวัติการตรวจนับสต็อก</div>;

  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const matched = records.filter(r => Number(r.variance) === 0).length;
  const discrepancies = records.filter(r => Number(r.variance) !== 0).length;
  const totalVariance = records.reduce((s, r) => s + (Number(r.variance) || 0), 0);

  return (
    <DocumentShell
      docType="ใบบันทึกผลตรวจนับสต็อก"
      docTypeEn="Cycle Count Audit &amp; Variance Sheet"
      docNo={`CC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`}
      printLabel="พิมพ์รายงานตรวจนับ"
      meta={[
        { label: 'วันที่ตรวจนับ', value: today },
        { label: 'จำนวนนับทั้งหมด', value: `${records.length} รายการ` },
        { label: 'ยอดตรง (Match)', value: <span className="text-emerald-600 font-bold">{matched} รายการ</span> },
        { label: 'ยอดต่าง (Discrepancy)', value: <span className="text-rose-600 font-bold">{discrepancies} รายการ</span> },
      ]}
    >
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-center">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="text-xs text-slate-400 font-bold uppercase">รายการที่ตรวจนับ</div>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{records.length}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
          <div className="text-xs text-emerald-700 font-bold uppercase">อัตราความถูกต้อง (Accuracy)</div>
          <div className="text-2xl font-black text-emerald-700 mt-0.5">
            {records.length > 0 ? ((matched / records.length) * 100).toFixed(1) : '100'}%
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200">
          <div className="text-xs text-rose-700 font-bold uppercase">ผลต่างสุทธิ (Net Variance)</div>
          <div className={`text-2xl font-black mt-0.5 ${totalVariance < 0 ? 'text-rose-600' : totalVariance > 0 ? 'text-blue-600' : 'text-slate-800'}`}>
            {totalVariance > 0 ? `+${totalVariance}` : totalVariance} ชิ้น
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b-2 border-slate-200">
              <th className="py-2 pr-2 font-semibold w-8">#</th>
              <th className="py-2 px-2 font-semibold">ตำแหน่ง</th>
              <th className="py-2 px-2 font-semibold">สินค้า</th>
              <th className="py-2 px-2 font-semibold text-right">ยอดระบบ</th>
              <th className="py-2 px-2 font-semibold text-right">นับจริง</th>
              <th className="py-2 px-2 font-semibold text-right">ผลต่าง</th>
              <th className="py-2 pl-2 font-semibold">ผู้ตรวจ / หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const diff = Number(r.variance) || 0;
              const isMatch = diff === 0;
              return (
                <tr key={r.id || i} className="border-b border-slate-100">
                  <td className="py-3 pr-2 text-slate-400 text-xs">{i + 1}</td>
                  <td className="py-3 px-2 font-mono font-bold text-xs">{r.location || '-'}</td>
                  <td className="py-3 px-2 font-medium text-slate-800 max-w-[220px]">{r.product_name}</td>
                  <td className="py-3 px-2 text-right font-mono text-slate-500 tabular-nums">{r.system_qty}</td>
                  <td className="py-3 px-2 text-right font-mono font-bold text-slate-900 tabular-nums">{r.actual_qty}</td>
                  <td className="py-3 px-2 text-right font-mono font-black tabular-nums">
                    <span className={`px-2 py-0.5 rounded text-xs ${isMatch ? 'bg-emerald-50 text-emerald-700' : diff < 0 ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </td>
                  <td className="py-3 pl-2 text-xs text-slate-500">
                    <div className="font-semibold text-slate-700">{r.inspector || 'System'}</div>
                    {r.notes && <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{r.notes}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-slate-200 text-sm">
        <div className="border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">เจ้าหน้าที่ตรวจนับสต็อก (Auditor)</div>
          <div className="border-b border-dashed border-slate-400 w-48 mx-auto mb-2" />
          <div className="text-xs text-slate-500">ลงชื่อ / วันที่</div>
        </div>
        <div className="border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">ผู้จัดการคลังสินค้าผู้อนุมัติผล (Warehouse Manager)</div>
          <div className="border-b border-dashed border-slate-400 w-48 mx-auto mb-2" />
          <div className="text-xs text-slate-500">ลงชื่อ / วันที่</div>
        </div>
      </div>
    </DocumentShell>
  );
}

export default function CycleCountPrintPage() {
  return (
    <Suspense fallback={<DocLoading />}>
      <CycleCountDoc />
    </Suspense>
  );
}
