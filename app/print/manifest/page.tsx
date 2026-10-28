'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';
import { Truck, CheckCircle, Package } from 'lucide-react';

interface OrderItem {
  id: string;
  orderNo: string;
  customerName: string;
  phone: string;
  shipAddress: string;
  totalQty: number;
  totalAmount: number;
  boxCount?: number;
  weightKg?: number;
  driverName?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  tmsJobId?: string;
  notes?: string;
}

function ManifestContent() {
  const params = useSearchParams();
  const tripId = params.get('trip') || params.get('id') || '';
  const orderIdsParam = params.get('orderIds') || '';

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/orders?status=ALL', { cache: 'no-store' });
        const json = await res.json();
        const allOrders: OrderItem[] = json.orders || [];

        let filtered: OrderItem[] = [];
        if (tripId) {
          filtered = allOrders.filter(
            o => o.tmsJobId === tripId || String(o.notes || '').includes(`[Trip: ${tripId}]`)
          );
        } else if (orderIdsParam) {
          const ids = orderIdsParam.split(',');
          filtered = allOrders.filter(o => ids.includes(o.id) || ids.includes(o.orderNo));
        }

        setOrders(filtered);
      } catch (err) {
        console.error('Failed to load manifest orders:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tripId, orderIdsParam]);

  if (loading) return <DocLoading />;
  if (orders.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-500 font-bold p-8 text-center">
        ไม่พบข้อมูลออเดอร์ในทริปจัดส่งนี้
      </div>
    );
  }

  const driver = orders[0]?.driverName || '-';
  const plate = orders[0]?.vehiclePlate || '-';
  const vehicleType = orders[0]?.vehicleType || '4-Wheel';
  const totalBoxes = orders.reduce((sum, o) => sum + (o.boxCount || 1), 0);
  const totalQty = orders.reduce((sum, o) => sum + (o.totalQty || 0), 0);
  const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <DocumentShell
      docType="ใบกำกับการจัดส่งสินค้า (ทริปรวม)"
      docTypeEn="Delivery Manifest Run Sheet"
      docNo={tripId || 'MANIFEST-RUNSHEET'}
      printLabel="พิมพ์ใบกำกับทริป"
      meta={[
        { label: 'วันที่จัดส่ง', value: today },
        { label: 'พนักงานขับรถ', value: driver },
        { label: 'ทะเบียนรถ', value: plate },
        { label: 'ประเภทรถ', value: vehicleType },
        { label: 'จำนวนจุดส่ง', value: `${orders.length} จุด (Drops)` },
        { label: 'รวมกล่อง/ชิ้น', value: `${totalBoxes} กล่อง (${totalQty} ชิ้น)` },
      ]}
    >
      <div className="space-y-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Truck className="w-5 h-5 text-indigo-600" />
            <span>เส้นทางวิ่งส่งสินค้าประจำวัน (Multi-Drop Sequence)</span>
          </div>
          <div className="text-slate-500">
            ยอดเงินเรียกเก็บปลายทางรวม (COD): <b className="text-slate-900 text-sm font-black">{totalAmount.toLocaleString()} บาท</b>
          </div>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-800 text-slate-800 font-bold uppercase text-[11px]">
              <th className="py-2.5 px-2 w-12 text-center">จุดที่</th>
              <th className="py-2.5 px-3">เลขที่ออเดอร์</th>
              <th className="py-2.5 px-3">ผู้รับ / ลูกค้า</th>
              <th className="py-2.5 px-3">ที่อยู่จัดส่ง & เบอร์โทร</th>
              <th className="py-2.5 px-2 text-center w-16">กล่อง</th>
              <th className="py-2.5 px-3 text-right">ยอดเก็บเงิน</th>
              <th className="py-2.5 px-4 text-center w-36">ลายมือชื่อผู้รับสินค้า</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {orders.map((o, idx) => (
              <tr key={o.id || idx} className="hover:bg-slate-50/50">
                <td className="py-3 px-2 text-center font-black text-indigo-700 text-sm">
                  #{idx + 1}
                </td>
                <td className="py-3 px-3 font-mono font-bold text-slate-900">
                  {o.orderNo}
                </td>
                <td className="py-3 px-3 font-bold text-slate-800">
                  {o.customerName}
                </td>
                <td className="py-3 px-3 text-slate-600 max-w-xs">
                  <div>{o.shipAddress || '-'}</div>
                  {o.phone && <div className="text-[11px] text-slate-500 font-mono mt-0.5">📞 {o.phone}</div>}
                </td>
                <td className="py-3 px-2 text-center font-bold text-slate-800">
                  {o.boxCount || 1}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                  {o.totalAmount > 0 ? `${o.totalAmount.toLocaleString()} ฿` : '-'}
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-center pb-1 text-[10px] text-slate-400">
                    (เซ็นชื่อผู้รับ)
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer signoff */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
          <div className="text-center p-4 border border-dashed border-slate-300 rounded-xl space-y-6">
            <div className="font-bold text-slate-700">ผู้จัดจ่ายสินค้า / คลังสินค้า (Dispatcher)</div>
            <div className="h-10 border-b border-slate-400 w-48 mx-auto" />
            <div className="text-slate-500 text-[11px]">วันที่: _____/_____/_________</div>
          </div>
          <div className="text-center p-4 border border-dashed border-slate-300 rounded-xl space-y-6">
            <div className="font-bold text-slate-700">พนักงานขับรถขนส่ง (Driver Acknowledgement)</div>
            <div className="h-10 border-b border-slate-400 w-48 mx-auto" />
            <div className="text-slate-500 text-[11px]">วันที่: _____/_____/_________</div>
          </div>
        </div>
      </div>
    </DocumentShell>
  );
}

export default function ManifestPrintPage() {
  return (
    <Suspense fallback={<DocLoading />}>
      <ManifestContent />
    </Suspense>
  );
}
