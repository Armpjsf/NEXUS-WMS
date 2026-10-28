'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';
import { CheckCircle2, AlertCircle, Banknote, CreditCard, ShieldCheck } from 'lucide-react';
import type { CodOrderRecord } from '@/lib/data/cod';

function thaiBahtText(num: number): string {
  if (isNaN(num) || num === 0) return 'ศูนย์บาทถ้วน';
  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const [intStr, decStr = ''] = Math.abs(num).toFixed(2).split('.');

  function convertGroup(nStr: string): string {
    let res = '';
    const len = nStr.length;
    for (let i = 0; i < len; i++) {
      const d = parseInt(nStr[i], 10);
      const pos = len - i - 1;
      if (d !== 0) {
        if (pos === 1 && d === 1) {
          res += 'สิบ';
        } else if (pos === 1 && d === 2) {
          res += 'ยี่สิบ';
        } else if (pos === 0 && d === 1 && len > 1 && nStr[len - 2] !== '0') {
          res += 'เอ็ด';
        } else {
          res += digits[d] + positions[pos];
        }
      }
    }
    return res;
  }

  let bahtPart = '';
  if (intStr.length > 6) {
    const millionPart = intStr.slice(0, intStr.length - 6);
    const lowerPart = intStr.slice(intStr.length - 6);
    bahtPart = convertGroup(millionPart) + 'ล้าน' + convertGroup(lowerPart);
  } else {
    bahtPart = convertGroup(intStr);
  }

  let satangPart = '';
  const satangVal = parseInt(decStr.slice(0, 2), 10);
  if (satangVal > 0) {
    satangPart = convertGroup(decStr.slice(0, 2)) + 'สตางค์';
  } else {
    satangPart = 'ถ้วน';
  }

  return `${num < 0 ? 'ลบ' : ''}${bahtPart}บาท${satangPart}`;
}

function CodReceiptContent() {
  const params = useSearchParams();
  const receiptNoParam = params.get('receiptNo') || params.get('no') || '';
  const orderIdsParam = params.get('orderIds') || '';
  const tripParam = params.get('trip') || '';

  const [records, setRecords] = useState<CodOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/finance/cod?status=ALL', { cache: 'no-store' });
        const json = await res.json();
        const allRecords: CodOrderRecord[] = json.records || [];

        let matched: CodOrderRecord[] = [];
        if (receiptNoParam) {
          matched = allRecords.filter(r => r.settlement.receiptNo === receiptNoParam);
        } else if (tripParam) {
          matched = allRecords.filter(r => r.tripId === tripParam);
        } else if (orderIdsParam) {
          const ids = orderIdsParam.split(',');
          matched = allRecords.filter(r => ids.includes(r.id) || ids.includes(r.orderNo));
        } else {
          matched = allRecords.filter(r => r.settlement.settled).slice(0, 5);
        }

        setRecords(matched);
      } catch (err) {
        console.error('Failed to load COD receipt data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [receiptNoParam, orderIdsParam, tripParam]);

  if (loading) return <DocLoading />;

  if (records.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">ไม่พบข้อมูลใบเสร็จรับเงิน</h2>
          <p className="text-slate-500 text-sm">
            ไม่พบรายการรับเงินนำส่งที่ตรงกับเงื่อนไข ({receiptNoParam || tripParam || orderIdsParam || 'ไม่ระบุ'})
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700"
          >
            กลับสู่หน้ารายการ
          </button>
        </div>
      </div>
    );
  }

  const firstRec = records[0];
  const receiptNo = firstRec.settlement.receiptNo || receiptNoParam || 'REC-OFFLINE';
  const driverName = records.find(r => r.driverName)?.driverName || 'ไม่ระบุคนขับ';
  const vehiclePlate = records.find(r => r.vehiclePlate)?.vehiclePlate || 'ไม่ระบุทะเบียน';
  const tripId = records.find(r => r.tripId)?.tripId || 'ทริปเฉพาะกิจ';
  const paymentChannel = firstRec.settlement.paymentChannel || 'CASH';
  const transferRef = firstRec.settlement.transferRef;
  const settledAt = firstRec.settlement.settledAt
    ? new Date(firstRec.settlement.settledAt).toLocaleString('th-TH')
    : new Date().toLocaleString('th-TH');
  const settledBy = firstRec.settlement.settledBy || 'แคชเชียร์คลังสินค้า';

  const totalExpected = records.reduce((s, r) => s + r.expectedCod, 0);
  const totalSettled = records.reduce((s, r) => s + (r.settlement.settledAmount || r.expectedCod), 0);
  const totalShortage = records.reduce((s, r) => s + (r.settlement.shortageAmount || 0), 0);

  return (
    <DocumentShell
      docType="ใบสำคัญรับเงินนำส่ง (คนขับ / COD)"
      docTypeEn="DRIVER CASH REMITTANCE RECEIPT"
      docNo={receiptNo}
      printLabel="พิมพ์ใบสำคัญรับเงิน"
      meta={[
        { label: 'เลขที่ใบสำคัญ', value: <span className="font-mono font-bold text-slate-900">{receiptNo}</span> },
        { label: 'วัน-เวลาที่รับเงิน', value: settledAt },
        { label: 'รหัสทริปส่งสินค้า', value: <span className="font-mono text-indigo-700">{tripId}</span> },
        {
          label: 'ช่องทางรับชำระ',
          value: (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
              {paymentChannel === 'TRANSFER' ? <CreditCard className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
              {paymentChannel === 'TRANSFER' ? 'สแกน QR / เงินโอน' : 'เงินสด (Cash)'}
              {transferRef ? ` (Ref: ${transferRef})` : ''}
            </span>
          ),
        },
      ]}
    >
      <div className="space-y-6 text-xs text-slate-700">
        {/* Personnel & Vehicle Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">พนักงานขับรถผู้ส่งมอบ</div>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{driverName}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">ทะเบียนรถจัดส่ง</div>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{vehiclePlate}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">เจ้าหน้าที่คลังผู้รับเงิน</div>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{settledBy}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">สถานะการกระทบยอด</div>
            <div className="font-bold text-emerald-600 text-sm mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>กระทบยอดเรียบร้อย</span>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-hidden border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">เลขที่ออเดอร์</th>
                <th className="py-2.5 px-3">ลูกค้า / ปลายทาง</th>
                <th className="py-2.5 px-3 text-right">ยอดเรียกเก็บ (Expected)</th>
                <th className="py-2.5 px-3 text-right">ยอดรับจริง (Remitted)</th>
                <th className="py-2.5 px-3 text-right">ส่วนต่าง (Shortage)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {records.map((r, idx) => {
                const settledAmt = r.settlement.settledAmount || r.expectedCod;
                const shortage = r.settlement.shortageAmount || 0;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">
                      {r.orderNo}
                      {r.dropSeq ? (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-sans">
                          {r.dropSeq}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800">{r.customerName}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-xs">{r.shipAddress}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      ฿{r.expectedCod.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      ฿{settledAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                      {shortage > 0 ? (
                        <span>-฿{shortage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Shortage Reason Banner if exists */}
        {firstRec.settlement.shortageReason && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">หมายเหตุส่วนต่าง / ยอดค้างชำระ: </span>
              <span>{firstRec.settlement.shortageReason}</span>
            </div>
          </div>
        )}

        {/* Summary Card with Thai Baht Text */}
        <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-300 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              จำนวนเงินรวมทั้งสิ้น (ตัวอักษร)
            </div>
            <div className="font-bold text-slate-900 text-sm bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-sm inline-block">
              ({thaiBahtText(totalSettled)})
            </div>
          </div>

          <div className="text-right space-y-1 w-full sm:w-auto">
            <div className="flex justify-between sm:justify-end gap-6 text-slate-600">
              <span>ยอดเรียกเก็บรวม:</span>
              <span className="font-mono">฿{totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {totalShortage > 0 && (
              <div className="flex justify-between sm:justify-end gap-6 text-rose-600 font-bold">
                <span>ส่วนต่างขาด:</span>
                <span className="font-mono">-฿{totalShortage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between sm:justify-end gap-6 text-slate-900 font-bold text-base pt-2 border-t border-slate-300">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                ยอดเงินสด/เงินโอนรับเข้าจริง:
              </span>
              <span className="font-mono text-emerald-700 text-lg">
                ฿{totalSettled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Triple Signatures Section */}
        <div className="pt-8 grid grid-cols-3 gap-6 text-center">
          <div className="space-y-12">
            <div className="h-14 border-b border-dashed border-slate-400"></div>
            <div>
              <div className="font-bold text-slate-800">{driverName}</div>
              <div className="text-[10px] text-slate-400">พนักงานขับรถผู้ส่งมอบเงิน</div>
              <div className="text-[9px] text-slate-400 mt-1">วันที่ ......../......../............</div>
            </div>
          </div>

          <div className="space-y-12">
            <div className="h-14 border-b border-dashed border-slate-400"></div>
            <div>
              <div className="font-bold text-slate-800">{settledBy}</div>
              <div className="text-[10px] text-slate-400">เจ้าหน้าที่คลัง / แคชเชียร์ผู้รับเงิน</div>
              <div className="text-[9px] text-slate-400 mt-1">วันที่ ......../......../............</div>
            </div>
          </div>

          <div className="space-y-12">
            <div className="h-14 border-b border-dashed border-slate-400"></div>
            <div>
              <div className="font-bold text-slate-800">( .................................................... )</div>
              <div className="text-[10px] text-slate-400">หัวหน้ากะ / พยานผู้ตรวจสอบ (Supervisor)</div>
              <div className="text-[9px] text-slate-400 mt-1">วันที่ ......../......../............</div>
            </div>
          </div>
        </div>
      </div>
    </DocumentShell>
  );
}

export default function CodReceiptPage() {
  return (
    <Suspense fallback={<DocLoading />}>
      <CodReceiptContent />
    </Suspense>
  );
}
