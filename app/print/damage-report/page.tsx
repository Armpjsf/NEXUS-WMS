'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';

interface DamageRecord {
  id: string;
  report_date: string;
  product_name: string;
  quantity: number;
  unit: string;
  reason: string;
  notes: string;
  reported_by: string;
  status: string;
  approved_by: string;
  approved_date: string;
  sent_to_hq?: string;
  created_at: string;
}

function DamageReportDoc() {
  const id = useSearchParams().get('id');
  const [record, setRecord] = useState<DamageRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/damage', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list: DamageRecord[] = d?.records || (Array.isArray(d) ? d : []);
        if (id) {
          const found = list.find(r => r.id === id);
          setRecord(found || null);
        } else {
          // If no specific ID, take first or create summary
          setRecord(list[0] || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DocLoading />;
  if (!record) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบรายการความเสียหาย</div>;

  const docNo = record.id ? `DMG-${record.id.slice(0, 8).toUpperCase()}` : 'DMG-REPORT';
  const reportDate = record.report_date || (record.created_at ? new Date(record.created_at).toLocaleDateString('th-TH') : '-');

  return (
    <DocumentShell
      docType="รายงานสินค้าชำรุด &amp; ตัดจำหน่าย"
      docTypeEn="Damage &amp; Scrap Incident Report"
      docNo={docNo}
      printLabel="พิมพ์รายงานชำรุด"
      meta={[
        { label: 'วันที่รายงาน', value: reportDate },
        { label: 'ผู้รายงานความเสียหาย', value: record.reported_by || 'เจ้าหน้าที่คลัง' },
        { label: 'สถานะการอนุมัติ', value: record.status || 'รอดำเนินการ' },
        { label: 'ผู้อนุมัติตัดสต็อก', value: record.approved_by || 'รอการอนุมัติ' },
      ]}
    >
      <div className="space-y-6">
        {/* Incident Summary Card */}
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5">
          <div className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2">รายละเอียดสินค้าที่ชำรุด / เสียหาย</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400">ชื่อสินค้า</div>
              <div className="text-lg font-black text-slate-900">{record.product_name}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">จำนวนที่เสียหาย</div>
              <div className="text-2xl font-black text-rose-600">
                {Number(record.quantity).toLocaleString()} <span className="text-sm font-semibold text-slate-600">{record.unit || 'ชิ้น'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reason and Notes */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">สาเหตุความเสียหาย (Root Cause)</div>
            <div className="text-slate-800 font-medium bg-white p-3 rounded-xl border border-slate-200">
              {record.reason || 'ไม่ระบุสาเหตุ'}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">บันทึกเพิ่มเติม / แนวทางการจัดการ (Disposal Action)</div>
            <div className="text-slate-800 font-medium bg-white p-3 rounded-xl border border-slate-200">
              {record.notes || 'ส่งทำลายตามระเบียบบริษัท / แยกเก็บโซนสินค้าชำรุด'}
            </div>
          </div>
        </div>

        {/* Action Taken */}
        <div className="text-xs text-slate-500 border border-slate-200 rounded-xl p-4">
          <div className="font-bold text-slate-700 mb-1">ผลกระทบทางบัญชีและการควบคุมสินค้า:</div>
          รายการนี้ได้รับการปรับปรุงยอดสต็อกออกจากคลังสินค้าขายจริง เพื่อความถูกต้องของการประเมินมูลค่าสินค้าคงคลัง (Inventory Valuation) และความปลอดภัยในการจัดส่งสินค้าแก่ลูกค้า
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-6 mt-10 pt-6 border-t border-slate-200 text-sm">
          <div className="border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">ผู้สำรวจและรายงาน</div>
            <div className="border-b border-dashed border-slate-400 w-36 mx-auto mb-2" />
            <div className="text-xs text-slate-600">{record.reported_by || 'ลงชื่อ'}</div>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">ผู้จัดการคลังสินค้า</div>
            <div className="border-b border-dashed border-slate-400 w-36 mx-auto mb-2" />
            <div className="text-xs text-slate-600">{record.approved_by || 'ผู้อนุมัติ'}</div>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">ฝ่ายบัญชี / ตรวจสอบ</div>
            <div className="border-b border-dashed border-slate-400 w-36 mx-auto mb-2" />
            <div className="text-xs text-slate-600">ลงชื่อ / วันที่</div>
          </div>
        </div>
      </div>
    </DocumentShell>
  );
}

export default function DamageReportPage() {
  return (
    <Suspense fallback={<DocLoading />}>
      <DamageReportDoc />
    </Suspense>
  );
}
