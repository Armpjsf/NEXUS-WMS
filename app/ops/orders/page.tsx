'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Package, Plus, X, Truck, ClipboardCheck, CheckCircle2,
  ArrowRight, Search, Trash2, MapPin, ArrowLeft, FileText,
  Printer, ExternalLink, UserCheck, Camera, Zap, RefreshCw,
  ShieldCheck, Eye, Download
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';
import { exportToExcel } from '@/lib/export/excel';

type Status = 'NEW' | 'PICKING' | 'PICKED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

interface Line { sku: string; name: string; qty: number; picked?: number; packed?: number; location?: string; price?: number; }
interface Order {
  id: string; orderNo: string; channel: string; customerName: string; status: Status;
  priority: string; items: Line[]; totalQty: number; totalAmount: number;
  carrier: string; trackingNo: string; createdAt: string; shipAddress: string; phone: string;
  podSignature?: string; podPhoto?: string; podNote?: string; deliveredAt?: string | null;
  tmsJobId?: string; tmsStatus?: string; tmsSyncedAt?: string | null; branchCode?: string;
}
interface Carrier {
  id: string; code: string; name: string; trackingUrlTemplate: string; isDefault: boolean;
}

const FLOW: Status[] = ['NEW', 'PICKING', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED'];
const NEXT_LABEL: Record<string, string> = {
  NEW: 'เริ่มหยิบ', PICKING: 'หยิบเสร็จ', PICKED: 'แพ็กเสร็จ', PACKED: 'จัดส่งพัสดุ', SHIPPED: 'ยืนยันส่งถึง',
};
const STATUS_STYLE: Record<Status, string> = {
  NEW: 'bg-slate-100 text-slate-600 ring-slate-200',
  PICKING: 'bg-amber-100 text-amber-700 ring-amber-200',
  PICKED: 'bg-blue-100 text-blue-700 ring-blue-200',
  PACKED: 'bg-violet-100 text-violet-700 ring-violet-200',
  SHIPPED: 'bg-cyan-100 text-cyan-700 ring-cyan-200',
  DELIVERED: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-rose-100 text-rose-600 ring-rose-200',
};
const STATUS_TH: Record<Status, string> = {
  NEW: 'ใหม่', PICKING: 'กำลังหยิบ', PICKED: 'หยิบแล้ว', PACKED: 'แพ็กแล้ว',
  SHIPPED: 'จัดส่งแล้ว', DELIVERED: 'ส่งถึงแล้ว', CANCELLED: 'ยกเลิก',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | Status>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchCam, setShowSearchCam] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [viewPodOrder, setViewPodOrder] = useState<Order | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // PDA Scanner for Order lookup
  usePdaScanner({
    onScan: (scanned) => {
      const q = scanned.trim();
      setSearchQuery(q);
      toast.success(`PDA สแกนค้นหา: ${q}`);
    },
    enabled: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [resOrders, resCarriers] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/carriers', { cache: 'no-store' }),
      ]);
      const jsonOrders = await resOrders.json();
      const jsonCarriers = await resCarriers.json();
      setOrders(jsonOrders.orders || []);
      setCarriers(jsonCarriers.carriers || []);
    } catch { toast.error('โหลดข้อมูลออเดอร์ไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncTms = async (orderId: string) => {
    setSyncingId(orderId);
    const t = toast.loading('กำลังตรวจสอบและซิงค์สถานะจาก TMS...');
    try {
      const res = await fetch('/api/orders/sync-tms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ซิงค์ไม่สำเร็จ');
      toast.success(json.message || 'ซิงค์ข้อมูลจาก TMS สำเร็จ', { id: t });
      load();
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาดในการซิงค์', { id: t });
    } finally {
      setSyncingId(null);
    }
  };

  const advance = async (o: Order) => {
    const idx = FLOW.indexOf(o.status);
    if (idx < 0 || idx >= FLOW.length - 1) return;
    const next = FLOW[idx + 1];

    // If next step is SHIPPED, open the modern dispatch modal
    if (next === 'SHIPPED') {
      setDispatchOrder(o);
      return;
    }

    const patch: any = { id: o.id, status: next };

    if (next === 'DELIVERED') {
      const note = prompt('บันทึกหลักฐานส่ง (ผู้รับ/หมายเหตุ):', '');
      if (note === null) return;
      patch.podNote = note;
    }

    const t = toast.loading('กำลังอัปเดต...');
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'อัปเดตไม่สำเร็จ');
      toast.success(`→ ${STATUS_TH[next]}`, { id: t });
      load();
    } catch (e: any) { toast.error(e.message, { id: t }); }
  };

  const cancelOrder = async (o: Order) => {
    if (!confirm(`ยกเลิกออเดอร์ ${o.orderNo}?`)) return;
    const res = await fetch('/api/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, status: 'CANCELLED' }),
    });
    if (res.ok) { toast.success('ยกเลิกแล้ว'); load(); } else toast.error('ยกเลิกไม่สำเร็จ');
  };

  const counts = FLOW.reduce((acc, s) => { acc[s] = orders.filter(o => o.status === s).length; return acc; }, {} as Record<string, number>);
  const tabFiltered = tab === 'ALL' ? orders.filter(o => o.status !== 'CANCELLED') : orders.filter(o => o.status === tab);
  const filtered = searchQuery.trim()
    ? tabFiltered.filter(o =>
        o.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.trackingNo || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabFiltered;

  const getTrackingUrl = (carrierName: string, trackingNo: string, tmsJobId?: string) => {
    if (tmsJobId) {
      return `https://tms-e-pod.vercel.app/track/${encodeURIComponent(tmsJobId)}`;
    }
    if (!carrierName || !trackingNo) return null;
    if (trackingNo.startsWith('JOB-') || carrierName.includes('บริษัท') || carrierName.includes('OWN_FLEET')) {
      return `https://tms-e-pod.vercel.app/track/${encodeURIComponent(trackingNo.trim())}`;
    }
    const c = carriers.find(item => item.name.toLowerCase().includes(carrierName.toLowerCase()) || carrierName.toLowerCase().includes(item.name.toLowerCase()));
    if (c?.trackingUrlTemplate) {
      return c.trackingUrlTemplate.replace('{trackingNo}', encodeURIComponent(trackingNo.trim()));
    }
    return null;
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="relative z-10 max-w-[1400px] mx-auto space-y-6">
        <Link href="/ops" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> ปฏิบัติการ
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25"><Package className="w-6 h-6" /></span>
              ออเดอร์ขาออก (Outbound Orders)
            </h1>
            <p className="text-slate-500 font-medium mt-1">ครบ loop: เบิก → หยิบ → แพ็ก → จัดส่ง (พร้อมเลขพัสดุ) → ส่งถึง (POD)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (filtered.length === 0) {
                  toast.error('ไม่มีออเดอร์สำหรับส่งออก');
                  return;
                }
                const rows = filtered.map((o: Order) => ({
                  'เลขที่ออเดอร์': o.orderNo,
                  'ชื่อลูกค้า': o.customerName,
                  'เบอร์โทร': o.phone,
                  'ที่อยู่จัดส่ง': o.shipAddress,
                  'สถานะ': STATUS_TH[o.status as Status] || o.status,
                  'จำนวนชิ้นรวม': o.totalQty,
                  'ผู้ให้บริการขนส่ง': o.carrier || '-',
                  'เลขพัสดุ (Tracking)': o.trackingNo || '-',
                  'รหัสงาน TMS (ePOD)': o.tmsJobId || '-',
                  'สถานะ TMS': o.tmsStatus || '-',
                  'วันที่สร้าง': new Date(o.createdAt).toLocaleString('th-TH'),
                }));
                exportToExcel(rows, `ออเดอร์ขาออก_${new Date().toISOString().slice(0, 10)}`, 'Orders');
                toast.success('ส่งออกไฟล์ Excel สำเร็จ!');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก Excel</span>
            </button>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold shadow-lg hover:bg-slate-800 active:scale-95 transition-all">
              <Plus className="w-5 h-5" /> สร้างออเดอร์
            </button>
          </div>
        </div>

        {/* Pipeline counts */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {FLOW.map((s) => (
            <button key={s} onClick={() => setTab(tab === s ? 'ALL' : s)}
              className={`text-left rounded-2xl border p-4 transition-all ${tab === s ? 'border-slate-900 bg-white shadow-md' : 'border-slate-200 bg-white/70 hover:bg-white'}`}>
              <div className="text-2xl font-black tabular-nums text-slate-900">{counts[s] || 0}</div>
              <div className="text-xs font-bold text-slate-500 mt-0.5">{STATUS_TH[s]}</div>
            </button>
          ))}
        </div>

        {/* Search Bar with Camera Scanner & PDA */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหา Order No., ชื่อลูกค้า หรือเลขพัสดุ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl font-medium outline-none focus:border-cyan-500 shadow-sm text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearchCam(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all shrink-0 active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>สแกนหาออเดอร์</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-2xl border border-slate-200 shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">PDA พร้อมยิง</span>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <span className="font-bold text-slate-700">
              {tab === 'ALL' ? 'ทั้งหมด' : STATUS_TH[tab as Status]} · {filtered.length} ออเดอร์
              {searchQuery && <span className="text-cyan-600 ml-1 text-xs font-normal">(`{searchQuery}`)</span>}
            </span>
            {tab !== 'ALL' && <button onClick={() => setTab('ALL')} className="text-xs font-bold text-cyan-600">ดูทั้งหมด</button>}
          </div>

          {loading ? (
            <div className="p-16 text-center text-slate-400">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              ยังไม่มีออเดอร์ในสถานะนี้
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((o) => {
                const trackUrl = getTrackingUrl(o.carrier, o.trackingNo, o.tmsJobId);
                const hasTmsJob = Boolean(o.tmsJobId || (o.trackingNo && o.trackingNo.startsWith('JOB-')));
                const tmsId = o.tmsJobId || o.trackingNo;
                const hasPodProof = Boolean(o.podSignature || o.podPhoto);

                return (
                  <div key={o.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900">{o.orderNo}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ring-1 ${STATUS_STYLE[o.status]}`}>{STATUS_TH[o.status]}</span>
                        {o.channel !== 'MANUAL' && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{o.channel}</span>}
                        {o.priority === 'URGENT' && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-600">ด่วน</span>}
                        {o.branchCode && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">สาขา: {o.branchCode}</span>}
                      </div>
                      <div className="text-sm text-slate-500 mt-1 truncate">
                        <span className="font-semibold text-slate-700">{o.customerName || 'ไม่ระบุลูกค้า'}</span> · {o.totalQty} ชิ้น · ฿{o.totalAmount.toLocaleString()}
                        {o.trackingNo && (
                          <span className="text-cyan-700 font-medium ml-2 inline-flex items-center gap-1 bg-cyan-50 px-2 py-0.5 rounded text-xs ring-1 ring-cyan-200">
                            <Truck className="w-3 h-3 text-cyan-600" />
                            {o.carrier}: {o.trackingNo}
                            {trackUrl && (
                              <a href={trackUrl} target="_blank" rel="noopener noreferrer" title="เช็กสถานะพัสดุ" className="text-blue-600 hover:text-blue-800 ml-1">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </span>
                        )}
                        {hasTmsJob && (
                          <span className="text-indigo-700 font-semibold ml-2 inline-flex items-center gap-1.5 bg-indigo-50 px-2 py-0.5 rounded text-xs ring-1 ring-indigo-200">
                            <Truck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>TMS: {tmsId}</span>
                            {o.tmsStatus && (
                              <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded text-[10px] font-bold">{o.tmsStatus}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* TMS Sync & Live Tracking Actions */}
                      {hasTmsJob && (
                        <>
                          <button
                            onClick={() => syncTms(o.id)}
                            disabled={syncingId === o.id}
                            title="ซิงค์สถานะและหลักฐาน POD ล่าสุดจากระบบ TMS"
                            className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${syncingId === o.id ? 'animate-spin text-indigo-600' : ''}`} />
                          </button>
                          <a
                            href={`https://tms-e-pod.vercel.app/track/${encodeURIComponent(tmsId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="เปิดดูแผนที่สดติดตามรถขนส่ง (TMS Live Tracking)"
                            className="p-2 rounded-xl text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </>
                      )}

                      {/* POD View button if delivered and has proof */}
                      {o.status === 'DELIVERED' && hasPodProof && (
                        <button
                          onClick={() => setViewPodOrder(o)}
                          title="ดูหลักฐานการจัดส่ง (ภาพถ่ายและลายเซ็น POD)"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all active:scale-95"
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>ดู POD</span>
                        </button>
                      )}

                      {/* Documents Print Suite */}
                      <a href={`/print/picking-slip?id=${o.id}`} target="_blank" rel="noopener noreferrer" title="พิมพ์ใบหยิบสินค้า (Picking Slip)"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                        <ClipboardCheck className="w-4 h-4" />
                      </a>
                      <a href={`/print/shipping-label?id=${o.id}`} target="_blank" rel="noopener noreferrer" title="พิมพ์ใบปะหน้ากล่อง 4x6 (Shipping Label)"
                        className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                        <Printer className="w-4 h-4" />
                      </a>
                      <a href={`/print/delivery-note?id=${o.id}`} target="_blank" rel="noopener noreferrer" title="พิมพ์ใบส่งสินค้า (Delivery Note / POD)"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                        <FileText className="w-4 h-4" />
                      </a>

                      {/* Advance buttons */}
                      {o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (
                        <>
                          <button onClick={() => advance(o)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 active:scale-95 transition-all">
                            {NEXT_LABEL[o.status]} <ArrowRight className="w-4 h-4" />
                          </button>
                          <button onClick={() => cancelOrder(o)} title="ยกเลิก" className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {o.status === 'DELIVERED' && !hasPodProof && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-sm px-3">
                          <CheckCircle2 className="w-5 h-5" /> เสร็จสิ้น
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dispatch / Shipping Modal */}
      <AnimatePresence>
        {dispatchOrder && (
          <DispatchModal
            order={dispatchOrder}
            carriers={carriers}
            onClose={() => setDispatchOrder(null)}
            onDone={() => { setDispatchOrder(null); load(); }}
          />
        )}
      </AnimatePresence>

      {/* Proof of Delivery (POD) Preview Modal */}
      <AnimatePresence>
        {viewPodOrder && (
          <PodProofModal
            order={viewPodOrder}
            onClose={() => setViewPodOrder(null)}
          />
        )}
      </AnimatePresence>

      {/* Create Order Modal */}
      <AnimatePresence>
        {showCreate && <CreateOrderModal carriers={carriers} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
      </AnimatePresence>

      {/* Camera Scanner for Order Search */}
      <CameraScannerModal
        isOpen={showSearchCam}
        onClose={() => setShowSearchCam(false)}
        onScan={(scanned) => {
          setSearchQuery(scanned.trim());
          setShowSearchCam(false);
          toast.success(`สแกนค้นหา: ${scanned.trim()}`);
        }}
        title="สแกนบาร์โค้ด / QR Code ค้นหาออเดอร์"
        description="ส่องกล้องไปที่ใบหยิบสินค้า (Picking Slip) หรือใบปะหน้าพัสดุเพื่อค้นหาออเดอร์ทันที"
      />
    </div>
  );
}

function DispatchModal({ order, carriers, onClose, onDone }: { order: Order; carriers: Carrier[]; onClose: () => void; onDone: () => void }) {
  const defaultCarrier = carriers.find(c => c.isDefault)?.name || carriers[0]?.name || 'Flash Express';
  const [carrier, setCarrier] = useState(order.carrier || defaultCarrier);
  const [trackingNo, setTrackingNo] = useState(order.trackingNo || '');
  const [submitting, setSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const selectedCarrierObj = carriers.find(c => c.name === carrier);
  const previewUrl = selectedCarrierObj?.trackingUrlTemplate && trackingNo
    ? selectedCarrierObj.trackingUrlTemplate.replace('{trackingNo}', trackingNo.trim())
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const t = toast.loading('กำลังบันทึกการจัดส่งและตัดสต็อก...');
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          status: 'SHIPPED',
          carrier,
          trackingNo: trackingNo.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกการจัดส่งไม่สำเร็จ');
      toast.success('ออเดอร์ถูกเปลี่ยนสถานะเป็น "จัดส่งแล้ว" และตัดสต็อกเรียบร้อย', { id: t });
      onDone();
    } catch (err: any) {
      toast.error(err.message, { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex justify-between items-center">
          <div className="font-black text-lg flex items-center gap-2">
            <Truck className="w-5 h-5" /> บันทึกการจัดส่งพัสดุ
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-sm">
            <div className="font-mono font-bold text-slate-900">{order.orderNo}</div>
            <div className="text-slate-600 mt-0.5">{order.customerName} · {order.totalQty} ชิ้น</div>
            {order.shipAddress && <div className="text-xs text-slate-400 mt-1 line-clamp-1">{order.shipAddress}</div>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ผู้ให้บริการขนส่ง *</label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 font-medium text-sm bg-white"
            >
              {carriers.map(c => (
                <option key={c.id} value={c.name}>{c.name} {c.isDefault ? '(ค่าเริ่มต้น)' : ''}</option>
              ))}
              <option value="รถขนส่งบริษัท">รถขนส่งบริษัท (จัดส่งเอง)</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
          </div>

          {(carrier.includes('บริษัท') || carrier.includes('จัดส่งเอง') || carrier.toLowerCase().includes('fleet') || carrier === 'OWN_FLEET') && (
            <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-xs text-indigo-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                <Truck className="w-4 h-4 text-indigo-600" />
                <span>เชื่อมโยงระบบ TMS ePOD อัตโนมัติ</span>
              </div>
              <p className="text-[11px] leading-relaxed text-indigo-700">
                เมื่อกดจัดส่ง ระบบจะสร้าง Job ใน TMS ทันที หากเว้นว่างเลขพัสดุไว้ ระบบจะนำ Job ID จาก TMS มาเป็นเลข Tracking พร้อมลิงก์แผนที่สด
              </p>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-600 uppercase">เลขพัสดุ (Tracking Number)</label>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 active:scale-95 transition-transform"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>สแกนบาร์โค้ดใบส่ง</span>
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="เช่น TH0123456789A หรือสแกนจากบาร์โค้ด"
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 transition-colors"
                title="เปิดกล้องสแกนเลข Tracking"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>

          {previewUrl && (
            <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-xs text-amber-800">
              <span className="font-bold">ลิงก์ติดตามพัสดุ:</span>
              <div className="truncate font-mono text-[11px] text-blue-600 mt-0.5">{previewUrl}</div>
            </div>
          )}

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
              ยกเลิก
            </button>
            <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold shadow-lg shadow-orange-500/25 active:scale-95 transition-all">
              {submitting ? 'กำลังบันทึก...' : 'ยืนยันการจัดส่ง'}
            </button>
          </div>
        </form>

        {/* Embedded Camera Scanner for Tracking Number */}
        <CameraScannerModal
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onScan={(scanned) => {
            setTrackingNo(scanned.trim());
            setShowCamera(false);
            toast.success(`สแกนเลขพัสดุ: ${scanned.trim()}`);
          }}
          title="สแกนบาร์โค้ดเลขพัสดุ (Tracking No.)"
          description="ส่องกล้องไปที่บาร์โค้ดบนใบปะหน้าพัสดุ Flash, Kerry, J&T หรือไปรษณีย์ไทย"
        />
      </motion.div>
    </div>
  );
}

function CreateOrderModal({ carriers, onClose, onDone }: { carriers: Carrier[]; onClose: () => void; onDone: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedCustId, setSelectedCustId] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [carrier, setCarrier] = useState(carriers.find(c => c.isDefault)?.name || 'Flash Express');
  const [saving, setSaving] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/products', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/customers', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([dProd, dCust]) => {
      setProducts(Array.isArray(dProd) ? dProd : []);
      setCustomers(dCust.customers || []);
    }).catch(() => {});
  }, []);

  const onSelectCustomer = (custId: string) => {
    setSelectedCustId(custId);
    const found = customers.find(c => c.id === custId);
    if (found) {
      setCustomer(found.name);
      setPhone(found.phone || '');
      setAddress(found.address || '');
      if (found.defaultCarrier) setCarrier(found.defaultCarrier);
    }
  };

  const addLine = (p: any) => {
    if (lines.some(l => l.sku === p.id)) { toast('มีในรายการแล้ว'); return; }
    setLines([...lines, { sku: p.id, name: p.name, qty: 1, location: p.location, price: p.price }]);
  };
  const setQty = (sku: string, qty: number) => setLines(lines.map(l => l.sku === sku ? { ...l, qty: Math.max(1, qty) } : l));
  const removeLine = (sku: string) => setLines(lines.filter(l => l.sku !== sku));

  const handleScanProduct = (scanned: string) => {
    const q = scanned.trim().toLowerCase();
    const matched = products.find(p => (p.id || '').toLowerCase() === q || (p.name || '').toLowerCase() === q || (p.barcode || '').toLowerCase() === q);
    if (matched) {
      addLine(matched);
      toast.success(`เพิ่ม ${matched.name} ลงออเดอร์แล้ว`);
      setShowCameraScanner(false);
    } else {
      toast.error(`ไม่พบรหัสสินค้า "${scanned}"`);
    }
  };

  const total = lines.reduce((s, l) => s + l.qty * (l.price || 0), 0);
  const shown = search ? products.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.id || '').toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [];

  const submit = async () => {
    if (lines.length === 0) { toast.error('เพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
    setSaving(true);
    try {
      // Tag the order with the branch currently selected in the URL so shipped
      // orders route to the right branch (in TMS too). Empty = no branch.
      const branchCode = typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('branchId') || 'URT')
        : 'URT';
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: customer, phone, shipAddress: address, carrier, items: lines, branchCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างไม่สำเร็จ');
      toast.success(`สร้าง ${json.order.orderNo} แล้ว`);
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-black text-slate-900">สร้างออเดอร์ขาออก</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">เลือกลูกค้าจากฐานข้อมูล (หรือกรอกเอง)</label>
            <select
              value={selectedCustId}
              onChange={(e) => onSelectCustomer(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-cyan-500 text-sm"
            >
              <option value="">-- พิมพ์กรอกข้อมูลเอง --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.code} - {c.name} ({c.phone || 'ไม่มีเบอร์'})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="ชื่อลูกค้า *" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-cyan-500" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="เบอร์โทรศัพท์" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-cyan-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="ที่อยู่จัดส่งสินค้า..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-cyan-500" />
            </div>
            <div>
              <select
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-cyan-500 text-sm"
              >
                {carriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                <option value="รถขนส่งบริษัท">รถขนส่งบริษัท</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาสินค้าเพื่อเพิ่มลงออเดอร์..." className="w-full pl-11 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-cyan-500" />
              {shown.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {shown.map(p => (
                    <button key={p.id} onClick={() => { addLine(p); setSearch(''); }} className="w-full text-left px-4 py-2.5 hover:bg-cyan-50 flex items-center justify-between">
                      <span className="font-medium text-slate-700 truncate">{p.name}</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{p.location} · สต็อก {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shrink-0 active:scale-95"
            >
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>สแกนสินค้า</span>
            </button>
          </div>

          <div className="space-y-2">
            {lines.length === 0 ? (
              <div className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-xl">ยังไม่มีสินค้าในออเดอร์</div>
            ) : lines.map(l => (
              <div key={l.sku} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">{l.name}</div>
                  <div className="text-xs text-slate-400">{l.location || '-'} · ฿{(l.price || 0).toLocaleString()}</div>
                </div>
                <input type="number" min={1} value={l.qty} onChange={e => setQty(l.sku, parseInt(e.target.value) || 1)} className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-center font-bold outline-none focus:border-cyan-500" />
                <button onClick={() => removeLine(l.sku)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white">
          <div className="text-sm text-slate-500">รวม <b className="text-slate-900 text-lg">฿{total.toLocaleString()}</b> · {lines.reduce((s, l) => s + l.qty, 0)} ชิ้น</div>
          <button onClick={submit} disabled={saving || lines.length === 0} className="px-6 py-3 rounded-xl bg-cyan-600 text-white font-bold shadow-lg hover:bg-cyan-500 active:scale-95 transition-all disabled:opacity-50">
            {saving ? 'กำลังสร้าง...' : 'สร้างออเดอร์'}
          </button>
        </div>

        {/* Embedded Camera Scanner for SKU Add */}
        <CameraScannerModal
          isOpen={showCameraScanner}
          onClose={() => setShowCameraScanner(false)}
          onScan={handleScanProduct}
          title="สแกนบาร์โค้ดเพิ่มสินค้าในออเดอร์"
          description="ส่องกล้องไปที่บาร์โค้ดสินค้าเพื่อเพิ่มลงในรายการออเดอร์"
        />
      </motion.div>
    </motion.div>
  );
}

function PodProofModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const photoList = order.podPhoto ? order.podPhoto.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(photoList[0] || null);
  const tmsId = order.tmsJobId || (order.trackingNo?.startsWith('JOB-') ? order.trackingNo : null);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center">
          <div className="font-black text-lg flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-200" />
            <span>หลักฐานการจัดส่ง (Proof of Delivery)</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Summary Info */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="font-mono font-black text-slate-900 text-base">{order.orderNo}</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300">
                จัดส่งถึงแล้ว (DELIVERED)
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div><b>ลูกค้า:</b> {order.customerName} {order.phone ? `(${order.phone})` : ''}</div>
              {order.shipAddress && <div><b>ที่อยู่ส่งมอบ:</b> {order.shipAddress}</div>}
              {order.deliveredAt && <div><b>วันเวลาส่งมอบ:</b> {new Date(order.deliveredAt).toLocaleString('th-TH')}</div>}
              {order.podNote && <div className="text-slate-700 bg-white p-2 rounded-xl border border-slate-200 font-medium"><b>บันทึก:</b> {order.podNote}</div>}
            </div>
          </div>

          {/* Digital Signature */}
          <div>
            <div className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
              <span>ลายเซ็นดิจิทัลผู้รับ (e-Signature)</span>
            </div>
            {order.podSignature ? (
              <div className="border border-slate-200 rounded-2xl bg-white p-3 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.podSignature}
                  alt="ลายเซ็นผู้รับสินค้า"
                  className="max-h-40 object-contain rounded"
                />
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                ไม่มีข้อมูลลายเซ็น
              </div>
            )}
          </div>

          {/* Photo Proofs */}
          <div>
            <div className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
              <span>ภาพถ่ายหลักฐานส่งมอบ ({photoList.length} รูป)</span>
            </div>
            {photoList.length > 0 ? (
              <div className="space-y-3">
                {selectedPhoto && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center aspect-video relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedPhoto}
                      alt="รูปหลักฐานการส่งมอบสินค้า"
                      className="max-h-80 w-full object-contain"
                    />
                    <a
                      href={selectedPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-xl hover:bg-black/90 transition-colors"
                      title="ดูภาพต้นฉบับขนาดเต็ม"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {photoList.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photoList.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedPhoto(url)}
                        className={`w-16 h-16 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                          selectedPhoto === url ? 'border-emerald-500 scale-95 shadow-md' : 'border-slate-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`รูปที่ ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                ไม่มีรูปถ่ายหลักฐาน
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          {tmsId ? (
            <a
              href={`https://tms-e-pod.vercel.app/track/${encodeURIComponent(tmsId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดใบงานในระบบ TMS ({tmsId})</span>
            </a>
          ) : <div />}
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </motion.div>
    </div>
  );
}

