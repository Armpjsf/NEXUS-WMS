'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { DocumentShell, DocLoading } from '@/components/print/DocumentShell';
import { MapPin, UserCheck, ShieldCheck, PenLine, CheckCircle2, Truck } from 'lucide-react';

const SignatureModal = dynamic(() => import('@/components/SignatureModal'), { ssr: false });

interface OrderLine {
  sku: string;
  name: string;
  qty: number;
}

interface DeliveryDestination {
  drop: number;
  name: string;
  phone: string;
  address: string;
  notes?: string;
}

interface QCSignatures {
  clientSignature?: string;
  clientName?: string;
  staffSignature?: string;
  staffName?: string;
  // Cross-dock handover signatures captured at the loading dock (what the
  // dispatch screen actually saves).
  customerStaffSignature?: string;
  customerStaffName?: string;
  checkerSignature?: string;
  checkerName?: string;
  signedAt?: string;
  notes?: string;
}

interface Order {
  id: string;
  orderNo: string;
  status?: string;
  customerName: string;
  phone: string;
  shipAddress: string;
  items: OrderLine[];
  totalQty: number;
  createdAt: string;
  pickedAt?: string | null;
  packedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  carrier?: string;
  driverName?: string;
  vehiclePlate?: string;
  notes?: string;
  destinations?: DeliveryDestination[];
  qcSignatures?: QCSignatures;
  pickupName?: string;
  pickupAddress?: string;
}

function QCHandoverSlip() {
  const params = useSearchParams();
  const id = params.get('id');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffDocSig, setStaffDocSig] = useState<string>('');
  const [driverDocSig, setDriverDocSig] = useState<string>('');
  const [signModalRole, setSignModalRole] = useState<null | 'staff' | 'driver'>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    // Public endpoint (share-by-link) so the slip loads without a login too.
    fetch(`/api/public/qc-handover?id=${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const ord = j?.order || null;
        setOrder(ord);
        if (ord?.orderNo) {
          fetch(`/api/documents/signatures?docType=qc-handover&docId=${encodeURIComponent(ord.orderNo)}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              const sigs = d?.signatures || [];
              const sSig = sigs.find((s: any) => s.role === 'staff')?.data_url;
              const dSig = sigs.find((s: any) => s.role === 'driver')?.data_url;
              if (sSig) setStaffDocSig(sSig);
              if (dSig) setDriverDocSig(dSig);
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveSignature = async (role: 'staff' | 'driver', dataUrl: string) => {
    if (!order) return;
    if (role === 'staff') setStaffDocSig(dataUrl);
    else setDriverDocSig(dataUrl);
    setSignModalRole(null);
    await fetch('/api/documents/signatures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docType: 'qc-handover',
        docId: order.orderNo,
        role,
        signerName: role === 'staff' ? 'เจ้าหน้าที่คลัง / QC' : (order.driverName || 'คนขับรถ / ตัวแทนขนส่ง'),
        dataUrl,
      }),
    }).catch(() => {});
  };

  if (loading) return <DocLoading />;
  if (!order) return <div className="min-h-screen grid place-items-center text-slate-500">ไม่พบข้อมูลออเดอร์</div>;

  const signTime = order.qcSignatures?.signedAt || order.pickedAt || order.createdAt;
  const dateStr = signTime
    ? new Date(signTime).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  const destinations =
    order.destinations && order.destinations.length > 0
      ? order.destinations
      : [
          {
            drop: 1,
            name: order.customerName || 'ผู้รับสินค้า',
            phone: order.phone || '',
            address: order.shipAddress || '-',
          },
        ];

  return (
    <DocumentShell
      docType="ใบตรวจปล่อยสินค้าและส่งมอบขึ้นรถ"
      docTypeEn="QC & DISPATCH HANDOVER SLIP"
      docNo={order.orderNo}
      printLabel="พิมพ์ใบตรวจปล่อยสินค้า (PDF)"
      meta={[
        { label: 'วันที่-เวลาตรวจปล่อย', value: dateStr },
        { label: 'ลูกค้าปลายทาง', value: order.pickupName || order.customerName || '-' },
        ...(order.phone ? [{ label: 'เบอร์โทรศัพท์', value: order.phone }] : []),
      ]}
    >
      {/* Customer Header Info */}
      <div className="mb-6 rounded-xl bg-slate-50 border border-slate-200/80 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          ลูกค้าปลายทาง
        </div>
        <div className="font-black text-base text-slate-900">{order.pickupName || order.customerName || '-'}</div>
        {order.pickupAddress && <div className="text-sm text-slate-600">{order.pickupAddress}</div>}
        {order.phone && <div className="text-sm text-slate-600">เบอร์ติดต่อ: {order.phone}</div>}
      </div>

      {/* Part 1: Inspection Items Table */}
      <div className="mb-8">
        <div className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>รายการสินค้าที่ตรวจปล่อย ({order.items.length} รายการ)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b-2 border-slate-200 bg-slate-50/50">
                <th className="py-2.5 px-3 font-bold w-12 text-center">ลำดับ</th>
                <th className="py-2.5 px-3 font-bold w-36">รหัสสินค้า (SKU)</th>
                <th className="py-2.5 px-3 font-bold">ชื่อรายการสินค้า</th>
                <th className="py-2.5 px-3 font-bold text-right w-28">จำนวนตรวจปล่อย</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={it.sku + i} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-slate-400 text-center font-medium">{i + 1}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-xs">{it.sku}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{it.name}</td>
                  <td className="py-2.5 px-3 text-right font-black font-mono text-emerald-800">
                    {it.qty.toLocaleString()} ชิ้น
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-black bg-slate-50/80">
                <td colSpan={3} className="py-3 px-3 text-right text-slate-700">
                  รวมจำนวนสินค้าที่ตรวจปล่อยทั้งสิ้น:
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-700 text-base">
                  {order.totalQty.toLocaleString()} ชิ้น
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Part 2: Multi-Drop Delivery Destinations */}
      <div className="mb-8">
        <div className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-cyan-600" />
          <span>สถานที่จัดส่งปลายทาง ({destinations.length} จุดส่ง)</span>
        </div>
        <div className="space-y-2.5">
          {destinations.map((d) => (
            <div key={d.drop} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-black text-cyan-900 bg-cyan-100 px-2.5 py-0.5 rounded-md">
                  ดรอปที่ {d.drop}
                </span>
                {d.phone && <span className="font-semibold text-slate-600">โทร: {d.phone}</span>}
              </div>
              <div className="font-bold text-slate-800 text-sm mb-0.5">{d.name}</div>
              <div className="text-slate-600 leading-relaxed whitespace-pre-line">{d.address}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Part 3: Dual Signatures & Digital Verification */}
      <div className="mt-8 pt-4 border-t-2 border-slate-200">
        <div className="text-xs font-black uppercase tracking-wider text-slate-600 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>การยืนยันความถูกต้องและการส่งมอบสินค้า 2 ฝ่าย</span>
          </div>
          <span className="no-print text-[11px] font-medium text-slate-400">
            รองรับทั้งตราประทับบาร์โค้ดดิจิทัล หรือกดเซ็นลายมือบนหน้าจอ
          </span>
        </div>

        {(() => {
          const staffSigUrl =
            staffDocSig ||
            order.qcSignatures?.staffSignature ||
            order.qcSignatures?.checkerSignature ||
            '';
          const driverSigUrl =
            driverDocSig ||
            order.qcSignatures?.clientSignature ||
            order.qcSignatures?.customerStaffSignature ||
            '';
          const isBarcodeVerified =
            Boolean(order.notes?.includes('[QC:PASSED')) ||
            ['PICKED', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(order.status || '');
          const isDispatched =
            ['SHIPPED', 'DELIVERED'].includes(order.status || '') ||
            Boolean(order.driverName || order.vehiclePlate || order.shippedAt);
          const driverDisplay =
            order.qcSignatures?.clientName ||
            order.qcSignatures?.customerStaffName ||
            (order.driverName
              ? `คนขับ: ${order.driverName}${order.vehiclePlate ? ` · ทะเบียน ${order.vehiclePlate}` : ''}`
              : order.vehiclePlate
              ? `ทะเบียนรถ: ${order.vehiclePlate}`
              : 'คนขับรถ / ผู้รับมอบสินค้า');

          return (
            <div className="grid grid-cols-2 gap-8">
              {/* Warehouse QC Signature (Dispatcher) */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center justify-between min-h-[175px]">
                <div className="text-xs font-bold text-slate-500 uppercase text-center mb-1">
                  ผู้ตรวจจ่ายสินค้า (เจ้าหน้าที่คลัง / QC)
                </div>
                <div className="min-h-[80px] flex flex-col items-center justify-center w-full my-1">
                  {staffSigUrl ? (
                    <img
                      src={staffSigUrl}
                      alt="ลายเซ็นผู้ตรวจจ่ายสินค้า"
                      className="max-h-16 max-w-[90%] object-contain"
                    />
                  ) : isBarcodeVerified ? (
                    <div className="px-3.5 py-2 rounded-xl border-2 border-emerald-600/70 bg-emerald-50/90 text-center shadow-2xs">
                      <div className="text-[11px] font-black text-emerald-800 uppercase tracking-wide flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        VERIFIED BY BARCODE QC
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                        ตรวจเช็คสินค้าผ่านระบบบาร์โค้ดครบ 100%
                      </div>
                    </div>
                  ) : (
                    <div className="w-48 border-b-2 border-dashed border-slate-300 h-10" />
                  )}
                  <button
                    type="button"
                    onClick={() => setSignModalRole('staff')}
                    className="no-print mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 text-[11px] font-bold shadow-2xs active:scale-95"
                  >
                    <PenLine className="w-3 h-3" />
                    {staffSigUrl ? 'เซ็นใหม่' : 'เซ็นชื่อกำกับบนหน้าจอ'}
                  </button>
                </div>
                <div className="text-center w-full border-t border-slate-200 pt-2">
                  <div className="font-bold text-slate-800 text-xs">
                    ( {order.qcSignatures?.staffName || order.qcSignatures?.checkerName || 'เจ้าหน้าที่คลัง / QC'} )
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    วันที่: {dateStr}
                  </div>
                </div>
              </div>

              {/* Driver / Carrier Signature (Receiver) */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center justify-between min-h-[175px]">
                <div className="text-xs font-bold text-slate-500 uppercase text-center mb-1">
                  ผู้ตรวจรับสินค้าขึ้นรถ (คนขับรถ / ตัวแทนขนส่ง)
                </div>
                <div className="min-h-[80px] flex flex-col items-center justify-center w-full my-1">
                  {driverSigUrl ? (
                    <img
                      src={driverSigUrl}
                      alt="ลายเซ็นผู้ตรวจรับสินค้าขึ้นรถ"
                      className="max-h-16 max-w-[90%] object-contain"
                    />
                  ) : isDispatched ? (
                    <div className="px-3.5 py-2 rounded-xl border-2 border-cyan-600/70 bg-cyan-50/90 text-center shadow-2xs">
                      <div className="text-[11px] font-black text-cyan-900 uppercase tracking-wide flex items-center justify-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-cyan-700" />
                        DISPATCHED TO FLEET / TMS
                      </div>
                      <div className="text-[10px] font-bold text-cyan-800 mt-0.5">
                        ส่งมอบงานขึ้นรถผ่านระบบดิจิทัลแล้ว
                      </div>
                    </div>
                  ) : (
                    <div className="w-48 border-b-2 border-dashed border-slate-300 h-10" />
                  )}
                  <button
                    type="button"
                    onClick={() => setSignModalRole('driver')}
                    className="no-print mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 text-[11px] font-bold shadow-2xs active:scale-95"
                  >
                    <PenLine className="w-3 h-3" />
                    {driverSigUrl ? 'เซ็นใหม่' : 'เซ็นชื่อกำกับบนหน้าจอ'}
                  </button>
                </div>
                <div className="text-center w-full border-t border-slate-200 pt-2">
                  <div className="font-bold text-slate-800 text-xs">
                    ( {driverDisplay} )
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    วันที่: {dateStr}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {signModalRole && (
        <SignatureModal
          isOpen={Boolean(signModalRole)}
          docNum={`${signModalRole === 'staff' ? 'เจ้าหน้าที่คลัง / QC' : 'คนขับรถ / ผู้รับมอบ'} · ${order.orderNo}`}
          onClose={() => setSignModalRole(null)}
          onSave={(url) => handleSaveSignature(signModalRole, url)}
        />
      )}
    </DocumentShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<DocLoading />}>
      <QCHandoverSlip />
    </Suspense>
  );
}
