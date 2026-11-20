'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Package,
  Plus,
  X,
  Truck,
  ClipboardCheck,
  CheckCircle2,
  ArrowRight,
  Search,
  Trash2,
  MapPin,
  ArrowLeft,
  FileText,
  Printer,
  ExternalLink,
  UserCheck,
  Camera,
  Zap,
  RefreshCw,
  ShieldCheck,
  Download,
  PackagePlus,
  Pencil,
} from 'lucide-react';
import AddItemsModal, { AddItemsOrder } from '@/components/orders/AddItemsModal';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';
import { exportToExcel } from '@/lib/export/excel';
import DualSignatureModal, { DeliveryDestination, QCSignatures } from '@/components/orders/DualSignatureModal';
import { errorMessage } from '@/lib/errors';

type Status = 'NEW' | 'PICKING' | 'PICKED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

interface Line {
  sku: string;
  name: string;
  qty: number;
  picked?: number;
  packed?: number;
  location?: string;
  price?: number;
  uom?: string;
  drop?: number;
}
interface UomOpt {
  code: string;
  name?: string;
  factor: number;
  isBase?: boolean;
}
interface Order {
  id: string;
  orderNo: string;
  channel: string;
  customerName: string;
  status: Status;
  priority: string;
  items: Line[];
  totalQty: number;
  totalAmount: number;
  freightCost?: number;
  refNo?: string;
  deliveryMode?: 'DELIVERY' | 'SELF_PICKUP';
  carrier: string;
  trackingNo: string;
  createdAt: string;
  shipAddress: string;
  phone: string;
  vehicleType?: string;
  dockBay?: string;
  vehiclePlate?: string;
  driverName?: string;
  notes?: string;
  podSignature?: string;
  podPhoto?: string;
  podNote?: string;
  deliveredAt?: string | null;
  tmsJobId?: string;
  tmsStatus?: string;
  tmsSyncedAt?: string | null;
  branchCode?: string;
  destinations?: DeliveryDestination[];
  qcSignatures?: QCSignatures;
}
interface Carrier {
  id: string;
  code: string;
  name: string;
  trackingUrlTemplate: string;
  isDefault: boolean;
}

const FLOW: Status[] = ['NEW', 'PICKING', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED'];
const NEXT_LABEL: Record<string, string> = {
  NEW: 'เริ่มหยิบ',
  PICKING: 'หยิบเสร็จ',
  PICKED: 'แพ็กเสร็จ',
  PACKED: 'จัดส่งพัสดุ',
  SHIPPED: 'ยืนยันส่งถึง',
};
const STATUS_STYLE: Record<Status, string> = {
  NEW: 'bg-slate-200/75 text-slate-700 border-slate-300/80',
  PICKING: 'bg-amber-500/15 text-amber-800 border-amber-500/25',
  PICKED: 'bg-sky-500/15 text-sky-800 border-sky-500/25',
  PACKED: 'bg-violet-500/15 text-violet-800 border-violet-500/25',
  SHIPPED: 'bg-cyan-500/15 text-cyan-800 border-cyan-500/25',
  DELIVERED: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/25',
  CANCELLED: 'bg-rose-500/15 text-rose-700 border-rose-500/25',
};
const STATUS_TH: Record<Status, string> = {
  NEW: 'ใหม่',
  PICKING: 'กำลังหยิบ',
  PICKED: 'หยิบแล้ว',
  PACKED: 'แพ็กแล้ว',
  SHIPPED: 'จัดส่งแล้ว',
  DELIVERED: 'ส่งถึงแล้ว',
  CANCELLED: 'ยกเลิก',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [addItemsOrder, setAddItemsOrder] = useState<AddItemsOrder | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | Status>('ALL');
  const [deliveryFilter, setDeliveryFilter] = useState<'ALL' | 'DELIVERY' | 'SELF_PICKUP'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchCam, setShowSearchCam] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [viewPodOrder, setViewPodOrder] = useState<Order | null>(null);
  const [qcOrder, setQcOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);
  const { data: session } = useSession();
  const isManagement = ['Super Admin', 'Admin', 'Manager'].includes(session?.user?.role || '');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

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
    } catch {
      toast.error('โหลดข้อมูลออเดอร์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาดในการซิงค์', { id: t });
    } finally {
      setSyncingId(null);
    }
  };

  const syncAllTms = async () => {
    const activeTmsOrders = orders.filter(
      (o) => (o.tmsJobId || o.trackingNo?.startsWith('JOB-')) && o.status !== 'CANCELLED'
    );
    if (activeTmsOrders.length === 0) {
      toast('ไม่มีออเดอร์ที่มีรหัสงาน TMS ให้ซิงค์');
      return;
    }
    const t = toast.loading(`กำลังซิงค์สถานะ TMS สำหรับ ${activeTmsOrders.length} ออเดอร์...`);
    try {
      const res = await fetch('/api/orders/sync-tms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: activeTmsOrders.map((o) => o.id) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ซิงค์ไม่สำเร็จ');
      toast.success(json.message || 'ซิงค์ข้อมูล TMS สำเร็จครบถ้วน', { id: t });
      load();
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาดในการซิงค์', { id: t });
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'อัปเดตไม่สำเร็จ');
      toast.success(`→ ${STATUS_TH[next]}`, { id: t });
      load();
    } catch (e) {
      toast.error(errorMessage(e), { id: t });
    }
  };

  const cancelOrder = async (o: Order) => {
    if (!confirm(`ยกเลิกออเดอร์ ${o.orderNo}?`)) return;
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, status: 'CANCELLED' }),
    });
    if (res.ok) {
      toast.success('ยกเลิกแล้ว');
      load();
    } else toast.error('ยกเลิกไม่สำเร็จ');
  };

  // Delivery-mode filter (ส่งขนส่ง vs ลูกค้ารับเอง)
  const modeScoped =
    deliveryFilter === 'ALL' ? orders : orders.filter((o) => (o.deliveryMode || 'DELIVERY') === deliveryFilter);
  const modeCounts = {
    ALL: orders.length,
    DELIVERY: orders.filter((o) => (o.deliveryMode || 'DELIVERY') === 'DELIVERY').length,
    SELF_PICKUP: orders.filter((o) => o.deliveryMode === 'SELF_PICKUP').length,
  };

  const counts = FLOW.reduce((acc, s) => {
    acc[s] = modeScoped.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);
  const tabFiltered =
    tab === 'ALL' ? modeScoped.filter((o) => o.status !== 'CANCELLED') : modeScoped.filter((o) => o.status === tab);
  const filtered = searchQuery.trim()
    ? tabFiltered.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (o.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (o.trackingNo || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabFiltered;

  const tmsAppBaseUrl = (process.env.NEXT_PUBLIC_TMS_APP_URL || process.env.NEXT_PUBLIC_TMS_URL || '')
    .trim()
    .replace(/\/$/, '');

  const getTrackingUrl = (carrierName: string, trackingNo: string, tmsJobId?: string) => {
    if (tmsJobId && tmsAppBaseUrl) {
      return `${tmsAppBaseUrl}/track/${encodeURIComponent(tmsJobId)}`;
    }
    if (!carrierName || !trackingNo) return null;
    if (tmsAppBaseUrl && (trackingNo.startsWith('JOB-') || carrierName.includes('บริษัท') || carrierName.includes('OWN_FLEET'))) {
      return `${tmsAppBaseUrl}/track/${encodeURIComponent(trackingNo.trim())}`;
    }
    const c = carriers.find(
      (item) =>
        item.name.toLowerCase().includes(carrierName.toLowerCase()) ||
        carrierName.toLowerCase().includes(item.name.toLowerCase())
    );
    if (c?.trackingUrlTemplate) {
      return c.trackingUrlTemplate.replace('{trackingNo}', encodeURIComponent(trackingNo.trim()));
    }
    return null;
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <Link
          href="/ops"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>ปฏิบัติการ</span>
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-600 text-white shadow-md shadow-sky-500/20">
                <Package className="w-6 h-6" />
              </span>
              <span>ออเดอร์ขาออก (Outbound Orders)</span>
            </h1>
            <p className="text-slate-600 text-sm font-medium mt-1">
              ครบ loop: เบิก → หยิบ → แพ็ก → จัดส่ง (พร้อมเลขพัสดุ) → ส่งถึง (POD)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={syncAllTms}
              title="ตรวจสอบและซิงค์สถานะงานขนส่งทั้งหมดจากระบบ TMS อัตโนมัติ"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>ซิงค์สถานะ TMS</span>
            </button>
            <button
              onClick={() => {
                if (filtered.length === 0) {
                  toast.error('ไม่มีออเดอร์สำหรับส่งออก');
                  return;
                }
                const rows = filtered.map((o: Order) => ({
                  เลขที่ออเดอร์: o.orderNo,
                  ชื่อลูกค้า: o.customerName,
                  เบอร์โทร: o.phone,
                  ที่อยู่จัดส่ง: o.shipAddress,
                  สถานะ: STATUS_TH[o.status as Status] || o.status,
                  จำนวนชิ้นรวม: o.totalQty,
                  ผู้ให้บริการขนส่ง: o.carrier || '-',
                  'เลขพัสดุ (Tracking)': o.trackingNo || '-',
                  'รหัสงาน TMS (ePOD)': o.tmsJobId || '-',
                  'สถานะ TMS': o.tmsStatus || '-',
                  วันที่สร้าง: new Date(o.createdAt).toLocaleString('th-TH'),
                }));
                exportToExcel(rows, `ออเดอร์ขาออก_${new Date().toISOString().slice(0, 10)}`, 'Orders');
                toast.success('ส่งออกไฟล์ Excel สำเร็จ!');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก Excel</span>
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold shadow-md hover:bg-slate-800 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> สร้างออเดอร์
            </button>
          </div>
        </div>

        {/* Trip Creation Banner */}
        {createdTripId && (
          <div className="p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200 text-indigo-900 flex items-center justify-between flex-wrap gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              <span>
                จัดทริปจัดส่งสำเร็จ: <b className="font-mono text-indigo-950 text-sm">{createdTripId}</b>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/print/manifest?trip=${encodeURIComponent(createdTripId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 shadow-xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์ใบกำกับทริป (Manifest Run Sheet)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => setCreatedTripId(null)}
                className="text-xs text-indigo-700 hover:text-indigo-950 px-2.5 py-1 rounded-full hover:bg-indigo-100"
              >
                ปิด
              </button>
            </div>
          </div>
        )}

        {/* Delivery mode filter: ส่งขนส่ง vs ลูกค้ารับเอง */}
        <div className="bg-white/65 backdrop-blur-md border border-white/85 p-1 rounded-full flex gap-1 flex-wrap w-fit shadow-xs">
          {(
            [
              { key: 'ALL', label: 'ทั้งหมด', icon: '📦' },
              { key: 'DELIVERY', label: 'ส่งขนส่ง', icon: '🚚' },
              { key: 'SELF_PICKUP', label: 'ลูกค้ารับเอง', icon: '🏭' },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setDeliveryFilter(m.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all tabular-nums ${
                deliveryFilter === m.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/75'
              }`}
            >
              {m.icon} {m.label} <span className="ml-1 opacity-75">({modeCounts[m.key]})</span>
            </button>
          ))}
        </div>

        {/* Pipeline counts */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {FLOW.map((s) => (
            <button
              key={s}
              onClick={() => setTab(tab === s ? 'ALL' : s)}
              className={`nx-glass-card text-left p-4 transition-all ${
                tab === s
                  ? 'ring-2 ring-slate-900 bg-white shadow-md'
                  : 'hover:bg-white/90'
              }`}
            >
              <div className="text-2xl font-black tabular-nums text-slate-900">{counts[s] || 0}</div>
              <div className="text-xs font-bold text-slate-600 mt-0.5">{STATUS_TH[s]}</div>
            </button>
          ))}
        </div>

        {/* Search Bar with Camera Scanner & PDA */}
        <div className="nx-glass-card p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหา Order No., ชื่อลูกค้า หรือเลขพัสดุ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white/85 border border-slate-200/80 rounded-full font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 shadow-2xs text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearchCam(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-all shrink-0 active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>สแกนหาออเดอร์</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/12 text-amber-800 text-xs font-bold rounded-full border border-amber-500/25 shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">PDA พร้อมยิง</span>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="nx-glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80">
            <span className="font-bold text-sm text-slate-900 tabular-nums">
              {tab === 'ALL' ? 'ทั้งหมด' : STATUS_TH[tab as Status]} · {filtered.length} ออเดอร์
              {searchQuery && <span className="text-sky-600 ml-1 text-xs font-normal">(`{searchQuery}`)</span>}
            </span>
            {tab !== 'ALL' && (
              <button onClick={() => setTab('ALL')} className="text-xs font-bold text-sky-600 hover:text-sky-800">
                ดูทั้งหมด
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-16 text-center text-slate-500 text-sm">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-sm">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-35 text-slate-400" />
              ยังไม่มีออเดอร์ในสถานะนี้
            </div>
          ) : (
            <div className="divide-y divide-slate-200/75">
              {/* Select All Bar */}
              <div className="px-5 py-2.5 bg-slate-50/85 flex items-center justify-between text-xs text-slate-600 border-b border-slate-200/80">
                <label className="flex items-center gap-2 cursor-pointer font-bold hover:text-slate-900 transition-colors tabular-nums">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedOrderIds.length === filtered.length}
                    onChange={() => {
                      if (selectedOrderIds.length === filtered.length) {
                        setSelectedOrderIds([]);
                      } else {
                        setSelectedOrderIds(filtered.map((o) => o.id));
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span>เลือกทั้งหมด ({filtered.length} ออเดอร์)</span>
                </label>
                {selectedOrderIds.length > 0 && (
                  <span className="text-indigo-700 font-bold tabular-nums">
                    เลือกอยู่ {selectedOrderIds.length} รายการ (พร้อมจัดทริป)
                  </span>
                )}
              </div>

              {filtered.map((o) => {
                const trackUrl = getTrackingUrl(o.carrier, o.trackingNo, o.tmsJobId);
                const hasTmsJob = Boolean(o.tmsJobId || (o.trackingNo && o.trackingNo.startsWith('JOB-')));
                const tmsId = o.tmsJobId || o.trackingNo;
                const hasPodProof = Boolean(o.podSignature || o.podPhoto);

                return (
                  <div
                    key={o.id}
                    className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-white/60 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(o.id)}
                        onChange={() => toggleSelectOrder(o.id)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-0 cursor-pointer shrink-0"
                        title="เลือกสำหรับจัดทริปรวมส่ง"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 tabular-nums">{o.orderNo}</span>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${STATUS_STYLE[o.status]}`}
                          >
                            {STATUS_TH[o.status]}
                          </span>
                          {o.channel !== 'MANUAL' && (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                              {o.channel}
                            </span>
                          )}
                          {o.priority === 'URGENT' && (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 border border-rose-500/25">
                              ด่วน
                            </span>
                          )}
                          {o.branchCode && (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 border border-indigo-500/25">
                              สาขา: {o.branchCode}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              o.deliveryMode === 'SELF_PICKUP'
                                ? 'bg-amber-500/12 text-amber-800 border-amber-500/25'
                                : 'bg-sky-500/12 text-sky-800 border-sky-500/25'
                            }`}
                          >
                            {o.deliveryMode === 'SELF_PICKUP' ? '🏭 รับเอง' : '🚚 ส่งขนส่ง'}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 mt-1.5 flex flex-wrap items-center gap-y-1 tabular-nums">
                          <span className="font-semibold text-slate-900">{o.customerName || 'ไม่ระบุลูกค้า'}</span>
                          <span className="mx-1.5">·</span>
                          <span>{o.totalQty} ชิ้น</span>
                          {o.freightCost ? (
                            <span className="text-amber-700 font-semibold ml-1.5">
                              · ค่าขนส่ง ฿{o.freightCost.toLocaleString()}
                            </span>
                          ) : null}
                          {o.shipAddress ? <span className="text-slate-500 ml-1.5">· 📍{o.shipAddress}</span> : null}
                          {o.trackingNo && (
                            <span className="text-sky-800 font-semibold ml-2 inline-flex items-center gap-1 bg-sky-500/10 px-2.5 py-0.5 rounded-full text-xs border border-sky-500/25">
                              <Truck className="w-3 h-3 text-sky-600" />
                              {o.carrier}: {o.trackingNo}
                              {trackUrl && (
                                <a
                                  href={trackUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="เช็กสถานะพัสดุ"
                                  className="text-blue-600 hover:text-blue-800 ml-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </span>
                          )}
                          {o.dockBay && (
                            <span className="text-amber-800 font-bold ml-2 inline-flex items-center gap-1 bg-amber-500/15 px-2.5 py-0.5 rounded-full text-xs border border-amber-500/25">
                              ⚓ ท่า: {o.dockBay}
                            </span>
                          )}
                          {o.vehiclePlate && (
                            <span className="text-emerald-800 font-bold ml-2 inline-flex items-center gap-1 bg-emerald-500/15 px-2.5 py-0.5 rounded-full text-xs border border-emerald-500/25">
                              🚛 {o.vehiclePlate} {o.driverName ? `(${o.driverName})` : ''}
                            </span>
                          )}
                          {o.vehicleType && (
                            <span className="text-amber-800 font-semibold ml-2 inline-flex items-center gap-1 bg-amber-500/10 px-2.5 py-0.5 rounded-full text-xs border border-amber-500/25">
                              🚗 {o.vehicleType}
                            </span>
                          )}
                          {hasTmsJob && (
                            <span className="text-indigo-800 font-semibold ml-2 inline-flex items-center gap-1.5 bg-indigo-500/10 px-2.5 py-0.5 rounded-full text-xs border border-indigo-500/25">
                              <Truck className="w-3.5 h-3.5 text-indigo-600" />
                              <span>TMS: {tmsId}</span>
                              {o.tmsStatus && (
                                <span className="bg-indigo-500/15 text-indigo-900 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                                  {o.tmsStatus}
                                </span>
                              )}
                            </span>
                          )}
                          {o.podNote && o.podNote.includes('⚠️') && (
                            <Link
                              href="/ops/returns"
                              className="text-amber-800 font-bold ml-2 inline-flex items-center gap-1 bg-amber-500/15 px-2.5 py-0.5 rounded-full text-xs border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                              title="คลิกเพื่อไปที่หน้าใบคืนสินค้า (RMA) / พื้นที่กักกัน"
                            >
                              <span>⚠️ แจ้งชำรุด/ปัญหาขนส่ง (เปิด RMA)</span>
                            </Link>
                          )}
                        </div>
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
                            className="p-2 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${syncingId === o.id ? 'animate-spin text-indigo-600' : ''}`} />
                          </button>
                          {tmsAppBaseUrl && (
                            <a
                              href={`${tmsAppBaseUrl}/track/${encodeURIComponent(tmsId)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="เปิดดูแผนที่สดติดตามรถขนส่ง (TMS Live Tracking)"
                              className="p-2 rounded-full text-slate-500 hover:text-sky-600 hover:bg-sky-500/10 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </>
                      )}

                      {/* แก้ไขออเดอร์ (แอดมินขึ้นไป) — แก้ ค่าขนส่ง/โหมด/ลูกค้า/ที่อยู่/PO กรณีกรอกผิด */}
                      {isManagement && (
                        <button
                          onClick={() => setEditOrder(o)}
                          title="แก้ไขข้อมูลออเดอร์ (ค่าขนส่ง / โหมดจัดส่ง / ลูกค้า / ที่อยู่ / PO) — เฉพาะแอดมิน"
                          className="p-2 rounded-full text-slate-500 hover:text-sky-600 hover:bg-sky-500/10 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}

                      {/* เพิ่มสินค้าเข้าออเดอร์ (ลูกค้าเพิ่มของหลังแพ็ก/ส่งงาน) */}
                      {(o.status === 'PACKED' || o.status === 'SHIPPED') && (
                        <button
                          onClick={() =>
                            setAddItemsOrder({
                              id: o.id,
                              orderNo: o.orderNo,
                              status: o.status,
                              tmsJobId: o.tmsJobId || (o.trackingNo?.startsWith('JOB-') ? o.trackingNo : undefined),
                              destinations: (o as any).destinations,
                            })
                          }
                          title="เพิ่มสินค้าเข้าออเดอร์นี้ (สแกนของเพิ่ม)"
                          className="p-2 rounded-full text-slate-500 hover:text-amber-700 hover:bg-amber-500/12 transition-colors"
                        >
                          <PackagePlus className="w-4 h-4" />
                        </button>
                      )}

                      {/* POD View button if delivered and has proof */}
                      {o.status === 'DELIVERED' && hasPodProof && (
                        <button
                          onClick={() => setViewPodOrder(o)}
                          title="ดูหลักฐานการจัดส่ง (ภาพถ่ายและลายเซ็น POD)"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/12 text-emerald-800 hover:bg-emerald-500/20 border border-emerald-500/25 text-xs font-bold transition-all active:scale-95"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ดู POD</span>
                        </button>
                      )}

                      {/* Documents Print Suite */}
                      <a
                        href={`/print/picking-slip?id=${o.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="พิมพ์ใบหยิบสินค้า (Picking Slip)"
                        className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        <ClipboardCheck className="w-4 h-4" />
                      </a>
                      <a
                        href={`/print/shipping-label?id=${o.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="พิมพ์ใบปะหน้ากล่อง 4x6 (Shipping Label)"
                        className="p-2 rounded-full text-slate-500 hover:text-amber-700 hover:bg-amber-500/10 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                      </a>
                      <a
                        href={`/print/delivery-note?id=${o.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="พิมพ์ใบส่งสินค้า (Delivery Note / POD)"
                        className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                      <a
                        href={`/print/qc-handover?id=${o.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="พิมพ์ใบตรวจปล่อยสินค้าและส่งมอบ (Dispatch Handover)"
                        className="p-2 rounded-full text-slate-500 hover:text-teal-700 hover:bg-teal-500/10 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4 text-teal-600" />
                      </a>

                      {/* Advance & QC Action buttons */}
                      {(o.status === 'PICKED' ||
                        o.status === 'PACKED' ||
                        o.qcSignatures?.clientSignature ||
                        o.qcSignatures?.staffSignature) && (
                        <button
                          onClick={() => setQcOrder(o)}
                          title="ตรวจปล่อยสินค้าพร้อมลงนาม 2 ฝ่าย (QC คลัง + คนขับรถ)"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-2xs active:scale-95 ${
                            o.qcSignatures?.clientSignature
                              ? 'bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-800 border-emerald-500/30'
                              : 'bg-teal-500/12 hover:bg-teal-500/20 text-teal-800 border-teal-500/30'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>
                            {o.qcSignatures?.clientSignature || o.qcSignatures?.staffSignature
                              ? 'ตรวจปล่อยแล้ว'
                              : 'ตรวจปล่อย QC (ลงนาม)'}
                          </span>
                        </button>
                      )}

                      {o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (
                        <>
                          {o.status === 'NEW' && (
                            <button
                              onClick={async () => {
                                const t = toast.loading('กำลังส่งต่อไป QC...');
                                try {
                                  const res = await fetch('/api/orders', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: o.id, status: 'PICKED' }),
                                  });
                                  if (!res.ok) throw new Error('เกิดข้อผิดพลาด');
                                  toast.success('ลูกค้าเตรียมของแล้ว → ส่งต่อไป QC/แพ็ก', { id: t });
                                  load();
                                } catch (e) {
                                  toast.error(errorMessage(e), { id: t });
                                }
                              }}
                              title="ลูกค้าเตรียมของไว้แล้ว ข้ามไปสถานี QC & แพ็กทันที"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-500/12 hover:bg-sky-500/20 text-sky-800 text-xs font-bold transition-all border border-sky-500/25 shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> ลูกค้าหยิบแล้ว (ไป QC)
                            </button>
                          )}
                          <button
                            onClick={() => advance(o)}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
                          >
                            {NEXT_LABEL[o.status]} <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => cancelOrder(o)}
                            title="ยกเลิก"
                            className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {o.status === 'DELIVERED' && !hasPodProof && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-500/12 border border-emerald-500/25 rounded-full font-bold text-xs px-3 py-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> เสร็จสิ้น
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

      {/* Floating Batch Trip Action Bar (1 Hero Dark Accent Card) */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 nx-dark-accent-card px-5 py-3.5 flex items-center gap-4">
          <div className="text-xs">
            <span className="font-bold text-white tabular-nums">เลือกอยู่ {selectedOrderIds.length} ออเดอร์</span>
            <p className="text-slate-300 text-[11px]">พร้อมจัดรวมเป็น 1 ทริปส่ง (Multi-Drop)</p>
          </div>
          <button
            onClick={() => setShowCreateTrip(true)}
            className="px-5 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <Truck className="w-4 h-4" />
            <span>จัดทริปรวมส่ง (Multi-Drop Manifest)</span>
          </button>
          <button
            onClick={() => setSelectedOrderIds([])}
            className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
          >
            ยกเลิกเลือก
          </button>
        </div>
      )}

      {/* Create Delivery Trip Modal */}
      <AnimatePresence>
        {showCreateTrip && (
          <CreateTripModal
            selectedOrders={orders.filter((o) => selectedOrderIds.includes(o.id))}
            carriers={carriers}
            onClose={() => setShowCreateTrip(false)}
            onDone={(tripId) => {
              setShowCreateTrip(false);
              setSelectedOrderIds([]);
              setCreatedTripId(tripId);
              load();
            }}
          />
        )}
      </AnimatePresence>

      {/* Dispatch / Shipping Modal */}
      <AnimatePresence>
        {dispatchOrder && (
          <DispatchModal
            order={dispatchOrder}
            carriers={carriers}
            onClose={() => setDispatchOrder(null)}
            onDone={() => {
              setDispatchOrder(null);
              load();
            }}
          />
        )}
      </AnimatePresence>

      {/* Proof of Delivery (POD) Preview Modal */}
      <AnimatePresence>
        {viewPodOrder && <PodProofModal order={viewPodOrder} onClose={() => setViewPodOrder(null)} />}
      </AnimatePresence>

      {/* QC Handover Dual Signature Modal */}
      <AnimatePresence>
        {qcOrder && (
          <DualSignatureModal
            isOpen={Boolean(qcOrder)}
            order={qcOrder}
            onClose={() => setQcOrder(null)}
            onSaveSuccess={() => {
              setQcOrder(null);
              load();
            }}
          />
        )}
      </AnimatePresence>

      {/* Create Order Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateOrderModal
            carriers={carriers}
            onClose={() => setShowCreate(false)}
            onDone={() => {
              setShowCreate(false);
              load();
            }}
          />
        )}
        {editOrder && (
          <EditOrderModal
            order={editOrder}
            carriers={carriers}
            onClose={() => setEditOrder(null)}
            onDone={() => {
              setEditOrder(null);
              load();
            }}
          />
        )}
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

      {/* เพิ่มสินค้าเข้าออเดอร์ (ลูกค้าเพิ่มของ) */}
      <AddItemsModal order={addItemsOrder} onClose={() => setAddItemsOrder(null)} onDone={() => load()} />
    </div>
  );
}

function DispatchModal({
  order,
  carriers,
  onClose,
  onDone,
}: {
  order: Order;
  carriers: Carrier[];
  onClose: () => void;
  onDone: () => void;
}) {
  const defaultCarrier = carriers.find((c) => c.isDefault)?.name || carriers[0]?.name || 'Flash Express';
  const [carrier, setCarrier] = useState(order.carrier || defaultCarrier);
  const [vehicleType, setVehicleType] = useState(order.vehicleType || '4-Wheel');
  const [dockBay, setDockBay] = useState(order.dockBay || '');
  const [vehiclePlate, setVehiclePlate] = useState(order.vehiclePlate || '');
  const [driverName, setDriverName] = useState(order.driverName || '');
  const [sendToTms] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trackingNo, setTrackingNo] = useState(order.trackingNo || '');
  const [submitting, setSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    fetch('/api/fleet-vehicles?active=1')
      .then((r) => r.json())
      .then((d) => {
        if (d.vehicles && Array.isArray(d.vehicles)) {
          setVehicles(d.vehicles);
          if (!order.vehiclePlate && d.vehicles[0]) {
            setVehiclePlate(d.vehicles[0].plate || d.vehicles[0].plateNumber || '');
            setDriverName(d.vehicles[0].driverName || d.vehicles[0].assignedDriverName || '');
            if (d.vehicles[0].vehicleType) setVehicleType(d.vehicles[0].vehicleType);
          }
        }
      })
      .catch(() => {});
  }, [order.vehiclePlate]);

  const isCompanyFleet =
    carrier.includes('บริษัท') ||
    carrier.includes('จัดส่งเอง') ||
    carrier.toLowerCase().includes('fleet') ||
    carrier === 'OWN_FLEET';

  const selectedCarrierObj = carriers.find((c) => c.name === carrier);
  const previewUrl =
    selectedCarrierObj?.trackingUrlTemplate && trackingNo
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
          vehicleType: isCompanyFleet ? vehicleType : undefined,
          vehiclePlate: isCompanyFleet ? vehiclePlate.trim() : undefined,
          driverName: isCompanyFleet ? driverName.trim() : undefined,
          dockBay: dockBay || undefined,
          sendToTms: isCompanyFleet ? sendToTms : false,
          trackingNo: trackingNo.trim() || (isCompanyFleet ? order.orderNo : ''),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกการจัดส่งไม่สำเร็จ');
      toast.success('ออเดอร์ถูกเปลี่ยนสถานะเป็น "จัดส่งแล้ว" และตัดสต็อกเรียบร้อย', { id: t });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err), { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900"
      >
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex justify-between items-center">
          <div className="font-black text-lg flex items-center gap-2">
            <Truck className="w-5 h-5" /> บันทึกการจัดส่งพัสดุ
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80 text-sm">
            <div className="font-mono font-bold text-slate-900 tabular-nums">{order.orderNo}</div>
            <div className="text-slate-700 mt-0.5 tabular-nums">
              {order.customerName} · {order.totalQty} ชิ้น
            </div>
            {order.shipAddress && <div className="text-xs text-slate-500 mt-1 line-clamp-1">{order.shipAddress}</div>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ผู้ให้บริการขนส่ง *</label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 font-medium text-sm bg-white text-slate-900"
            >
              {carriers.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} {c.isDefault ? '(ค่าเริ่มต้น)' : ''}
                </option>
              ))}
              <option value="รถขนส่งบริษัท">รถขนส่งบริษัท (จัดส่งเอง)</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
          </div>

          {/* Dock Bay Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              ⚓ ท่าเทียบ / จุดวางพักรอขึ้นรถ (Dock Bay / Staging)
            </label>
            <select
              value={dockBay}
              onChange={(e) => setDockBay(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 font-bold text-sm bg-white text-amber-700"
            >
              <option value="">-- ไม่ระบุ Dock (จัดส่งทั่วไป) --</option>
              <option value="BAY-01">BAY-01 (Inbound / จุดรับเข้า)</option>
              <option value="BAY-02">BAY-02 (Outbound / ท่าโหลดสายใต้)</option>
              <option value="BAY-03">BAY-03 (Outbound / ท่าโหลดทั่วไป)</option>
              <option value="DOCK-01">DOCK-01 (ท่าโหลด 1)</option>
              <option value="DOCK-02">DOCK-02 (ท่าโหลด 2)</option>
              <option value="STAGING-A">STAGING-A (ลานพักรอโหลด A)</option>
              <option value="STAGING-B">STAGING-B (ลานพักรอโหลด B)</option>
            </select>
          </div>

          {isCompanyFleet && (
            <div className="space-y-3 p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl">
              {vehicles.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">
                    🚛 เลือกรถขนส่งในบริษัท (Fleet)
                  </label>
                  <select
                    onChange={(e) => {
                      const v = vehicles.find((x) => x.id === e.target.value);
                      if (v) {
                        setVehiclePlate(v.plate || v.plateNumber || '');
                        setDriverName(v.driverName || v.assignedDriverName || '');
                        if (v.vehicleType) setVehicleType(v.vehicleType);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-indigo-200 font-bold text-sm bg-white text-indigo-900"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate || v.plateNumber}{' '}
                        {v.driverName || v.assignedDriverName ? `- ${v.driverName || v.assignedDriverName}` : ''} (
                        {v.vehicleType || '4-Wheel'}) {v.statusLabel ? `[${v.statusLabel}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">ทะเบียนรถ *</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="เช่น กก-4321"
                    className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs font-mono font-bold bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">คนขับรถ *</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="เช่น นายเอ"
                    className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs font-bold bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">
                  🚗 ประเภทรถขนส่ง (TMS Vehicle Type) *
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-500 font-bold text-sm bg-white text-indigo-950"
                >
                  <option value="4-Wheel">รถกระบะ 4 ล้อ (4-Wheel)</option>
                  <option value="6-Wheel">รถบรรทุก 6 ล้อ (6-Wheel)</option>
                  <option value="10-Wheel">รถบรรทุก 10 ล้อ (10-Wheel)</option>
                  <option value="Trailer">รถหัวลาก / เทรลเลอร์ (Trailer)</option>
                  <option value="Motorcycle">รถมอเตอร์ไซค์ (Motorcycle)</option>
                </select>
              </div>

              <div className="text-xs text-indigo-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  <span>เชื่อมโยงระบบ TMS ePOD อัตโนมัติ</span>
                </div>
                <p className="text-[11px] leading-relaxed text-indigo-700">
                  ระบบจะนำเลข Order ({order.orderNo}) ไปสร้างเป็นเลข Job ใน TMS ทันที พร้อมระบุประเภทรถ {vehicleType}{' '}
                  สำหรับมอบหมายคนขับ
                </p>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-600 uppercase">เลขพัสดุ (Tracking Number)</label>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 active:scale-95 transition-transform"
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
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="px-3 py-2 bg-amber-500/12 hover:bg-amber-500/20 text-amber-700 rounded-xl border border-amber-500/30 transition-colors"
                title="เปิดกล้องสแกนเลข Tracking"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>

          {previewUrl && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-800">
              <span className="font-bold">ลิงก์ติดตามพัสดุ:</span>
              <div className="truncate font-mono text-[11px] text-blue-600 mt-0.5">{previewUrl}</div>
            </div>
          )}

          <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-95 transition-all"
            >
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

function CreateOrderModal({
  carriers,
  onClose,
  onDone,
}: {
  carriers: Carrier[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [availMap, setAvailMap] = useState<Record<string, number>>({});
  const [uomMap, setUomMap] = useState<Record<string, UomOpt[]>>({});
  const [selectedCustId, setSelectedCustId] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'DELIVERY' | 'SELF_PICKUP'>('DELIVERY');
  const [carrier, setCarrier] = useState(carriers.find((c) => c.isDefault)?.name || 'Flash Express');
  const [vehicleType, setVehicleType] = useState('4-Wheel');
  const [prePicked, setPrePicked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Multi-Drop delivery destinations
  const [multiDrop, setMultiDrop] = useState(false);
  const [destinations, setDestinations] = useState<DeliveryDestination[]>([
    { drop: 1, name: '', phone: '', address: '', notes: '' },
  ]);

  // Custom item modal / input for customer-provided stock (cross-docking)
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [customSku, setCustomSku] = useState('');
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState(1);

  useEffect(() => {
    Promise.all([
      fetch('/api/products', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/customers', { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([dProd, dCust]) => {
        setProducts(Array.isArray(dProd) ? dProd : []);
        setCustomers(dCust.customers || []);
      })
      .catch(() => {});
  }, []);

  const onSelectCustomer = (custId: string) => {
    setSelectedCustId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setCustomer(found.name);
      setPhone(found.phone || '');
      setAddress(found.address || '');
      if (found.defaultCarrier) setCarrier(found.defaultCarrier);
      setDestinations([{ drop: 1, name: found.name, phone: found.phone || '', address: found.address || '', notes: '' }]);
    }
  };

  const addLine = (p: any) => {
    if (lines.some((l) => l.sku === p.id)) {
      toast('มีในรายการแล้ว');
      return;
    }
    setLines([...lines, { sku: p.id, name: p.name, qty: 1, location: p.location, price: p.price }]);
    // A-UI #3: fetch ATP so the form can flag backorders before submit
    fetch(`/api/stock/available?sku=${encodeURIComponent(p.id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAvailMap((m) => ({ ...m, [p.id]: Number(d.available ?? d.onHand ?? 0) })))
      .catch(() => {});
    // A-UI: fetch pack units so the order can be placed in ลัง/พาเลท
    fetch(`/api/products/uoms?sku=${encodeURIComponent(p.id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setUomMap((m) => ({ ...m, [p.id]: Array.isArray(d.uoms) ? d.uoms : [] })))
      .catch(() => {});
  };
  const setQty = (sku: string, qty: number) =>
    setLines(lines.map((l) => (l.sku === sku ? { ...l, qty: Math.max(1, qty) } : l)));
  const setUom = (sku: string, uom: string) => setLines(lines.map((l) => (l.sku === sku ? { ...l, uom } : l)));
  const removeLine = (sku: string) => setLines(lines.filter((l) => l.sku !== sku));

  const addCustomItem = () => {
    if (!customName.trim()) {
      toast.error('กรุณาระบุชื่อสินค้า');
      return;
    }
    const sku = customSku.trim() || `CUS-${Date.now().toString().slice(-6)}`;
    if (lines.some((l) => l.sku === sku)) {
      toast.error('รหัส SKU นี้มีอยู่ในรายการแล้ว');
      return;
    }
    // Reuse catalog price/location when the SKU is a real product.
    const match = products.find((p) => String(p.id).trim().toLowerCase() === sku.toLowerCase());
    setLines([
      ...lines,
      { sku, name: customName.trim(), qty: Math.max(1, customQty), price: match?.price || 0, location: match?.location },
    ]);
    setCustomSku('');
    setCustomName('');
    setCustomQty(1);
    setShowCustomItem(false);
    toast.success(`เพิ่ม ${customName.trim()} ลงออเดอร์แล้ว`);
  };

  const handleScanProduct = (scanned: string) => {
    const q = scanned.trim().toLowerCase();
    const matched = products.find(
      (p) =>
        (p.id || '').toLowerCase() === q ||
        (p.name || '').toLowerCase() === q ||
        (p.barcode || '').toLowerCase() === q
    );
    if (matched) {
      addLine(matched);
      toast.success(`เพิ่ม ${matched.name} ลงออเดอร์แล้ว`);
      setShowCameraScanner(false);
    } else {
      toast.error(`ไม่พบรหัสสินค้า "${scanned}"`);
    }
  };

  const total = lines.reduce((s, l) => s + l.qty * (l.price || 0), 0);
  const shown = search
    ? products
        .filter(
          (p) =>
            (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.id || '').toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 8)
    : [];

  const submit = async () => {
    if (lines.length === 0) {
      toast.error('เพิ่มสินค้าอย่างน้อย 1 รายการ');
      return;
    }
    setSaving(true);
    try {
      // Tag the order with the branch currently selected in the URL so shipped
      // orders route to the right branch (in TMS too). Empty = no branch.
      const defaultBranch = (process.env.NEXT_PUBLIC_DEFAULT_BRANCH_CODE || '').trim();
      const branchCode =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('branchId') || defaultBranch
          : defaultBranch;
      const isCompanyFleet =
        carrier.includes('บริษัท') ||
        carrier.includes('จัดส่งเอง') ||
        carrier.toLowerCase().includes('fleet') ||
        carrier === 'OWN_FLEET';

      const finalDestinations = multiDrop
        ? destinations.filter((d) => d.address.trim() || d.name.trim())
        : [{ drop: 1, name: customer, phone, address, notes: '' }];

      const finalAddress = multiDrop && destinations[0]?.address ? destinations[0].address : address;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer,
          phone,
          shipAddress: finalAddress,
          deliveryMode,
          carrier: deliveryMode === 'SELF_PICKUP' ? 'ลูกค้ารับเอง' : carrier,
          vehicleType: deliveryMode === 'DELIVERY' && isCompanyFleet ? vehicleType : undefined,
          items: lines,
          branchCode,
          status: prePicked ? 'PICKED' : 'NEW',
          destinations: finalDestinations.length > 0 ? finalDestinations : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างไม่สำเร็จ');
      toast.success(`สร้าง ${json.order.orderNo} แล้ว`);
      // A-UI #3: warn if any line couldn't be fully reserved (backorder)
      const bo = json.order?.backorders as { sku: string; backorder: number }[] | undefined;
      if (bo && bo.length > 0) {
        toast(`⚠️ ของไม่พอ ${bo.length} รายการ (backorder): ${bo.map((b) => `${b.sku}×${b.backorder}`).join(', ')}`, {
          duration: 7000,
          icon: '📦',
          style: { background: '#7c2d12', color: '#fff' },
        });
      }
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const isCompanyFleet =
    carrier.includes('บริษัท') ||
    carrier.includes('จัดส่งเอง') ||
    carrier.toLowerCase().includes('fleet') ||
    carrier === 'OWN_FLEET';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200/80 flex justify-between items-center sticky top-0 bg-white/95 z-10">
          <h2 className="text-xl font-black text-slate-900">สร้างออเดอร์ขาออก</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              เลือกลูกค้าจากฐานข้อมูล (หรือกรอกเอง)
            </label>
            <select
              value={selectedCustId}
              onChange={(e) => onSelectCustomer(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 outline-none focus:border-sky-500 text-sm"
            >
              <option value="">-- พิมพ์กรอกข้อมูลเอง --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name} ({c.phone || 'ไม่มีเบอร์'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="ชื่อลูกค้า *"
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="เบอร์โทรศัพท์"
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 text-sm"
            />
          </div>

          {/* Delivery mode: ส่งขนส่ง vs ลูกค้ารับเอง */}
          <div className="flex gap-2">
            {(
              [
                { key: 'DELIVERY', label: '🚚 ส่งขนส่ง' },
                { key: 'SELF_PICKUP', label: '🏭 ลูกค้ารับเอง' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setDeliveryMode(m.key)}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold border transition-all ${
                  deliveryMode === m.key
                    ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={deliveryMode === 'SELF_PICKUP' ? 'หมายเหตุการรับ (ไม่บังคับ)...' : 'ที่อยู่จัดส่งสินค้า...'}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 text-sm"
              />
            </div>
            <div>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                disabled={deliveryMode === 'SELF_PICKUP'}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 font-medium text-slate-900 outline-none focus:border-sky-500 text-sm disabled:opacity-40"
              >
                {deliveryMode === 'SELF_PICKUP' ? (
                  <option>— ลูกค้ารับเอง —</option>
                ) : (
                  <>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="รถขนส่งบริษัท">รถขนส่งบริษัท (จัดส่งเอง)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Multi-Drop Destinations Toggle */}
          <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label
                className="flex items-center gap-2 cursor-pointer text-xs font-black text-sky-900 select-none"
                onClick={() => setMultiDrop(!multiDrop)}
              >
                <input
                  type="checkbox"
                  checked={multiDrop}
                  onChange={(e) => setMultiDrop(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span>📍 จัดส่งปลายทางหลายดรอป (Multi-Drop)</span>
              </label>
              {multiDrop && (
                <button
                  type="button"
                  onClick={() =>
                    setDestinations([
                      ...destinations,
                      { drop: destinations.length + 1, name: '', phone: '', address: '', notes: '' },
                    ])
                  }
                  className="inline-flex items-center gap-1 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-full text-xs font-bold transition-all shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มดรอป
                </button>
              )}
            </div>

            {multiDrop && (
              <div className="space-y-2.5 pt-1">
                {destinations.map((d, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-sky-200/80 rounded-xl p-3 text-xs shadow-2xs relative"
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-sky-800 bg-sky-500/15 px-2.5 py-0.5 rounded-full text-[11px]">
                        ดรอปที่ {d.drop}
                      </span>
                      {destinations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = destinations.filter((_, i) => i !== idx);
                            setDestinations(filtered.map((item, i) => ({ ...item, drop: i + 1 })));
                          }}
                          className="text-slate-400 hover:text-rose-600 text-[11px] flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" /> ลบ
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-1.5">
                      <input
                        placeholder="ชื่อผู้รับดรอปนี้"
                        value={d.name}
                        onChange={(e) => {
                          const copy = [...destinations];
                          copy[idx] = { ...copy[idx], name: e.target.value };
                          setDestinations(copy);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 outline-none focus:border-sky-500"
                      />
                      <input
                        placeholder="เบอร์โทรผู้รับ"
                        value={d.phone}
                        onChange={(e) => {
                          const copy = [...destinations];
                          copy[idx] = { ...copy[idx], phone: e.target.value };
                          setDestinations(copy);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 outline-none focus:border-sky-500"
                      />
                    </div>
                    <textarea
                      rows={2}
                      placeholder="ที่อยู่จัดส่งสำหรับดรอปนี้..."
                      value={d.address}
                      onChange={(e) => {
                        const copy = [...destinations];
                        copy[idx] = { ...copy[idx], address: e.target.value };
                        setDestinations(copy);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 outline-none focus:border-sky-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {isCompanyFleet && (
            <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
              <label className="text-xs font-bold text-indigo-900 whitespace-nowrap">
                🚗 ประเภทรถขนส่ง (TMS):
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 font-bold outline-none text-xs text-indigo-950 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="4-Wheel">รถกระบะ 4 ล้อ (4-Wheel)</option>
                <option value="6-Wheel">รถบรรทุก 6 ล้อ (6-Wheel)</option>
                <option value="10-Wheel">รถบรรทุก 10 ล้อ (10-Wheel)</option>
                <option value="Trailer">รถหัวลาก / เทรลเลอร์ (Trailer)</option>
                <option value="Motorcycle">รถมอเตอร์ไซค์ (Motorcycle)</option>
              </select>
            </div>
          )}

          {/* Pre-picked by customer toggle */}
          <div
            className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
            onClick={() => setPrePicked(!prePicked)}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={prePicked}
                onChange={(e) => setPrePicked(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  ลูกค้าจัดเตรียมสินค้าเรียบร้อยแล้ว (Pre-picked)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  ข้ามขั้นตอนเบิกหยิบในคลัง ➔ ส่งต่อไปยังสถานีตรวจสอบ QC &amp; แพ็กทันที
                </span>
              </div>
            </div>
            {prePicked && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-700 border border-sky-500/25 shrink-0">
                พร้อม QC
              </span>
            )}
          </div>

          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาสินค้าเพื่อเพิ่มลงออเดอร์..."
                className="w-full pl-10 bg-white border border-slate-200 rounded-full px-4 py-2.5 font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 text-sm"
              />
              {shown.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                  {shown.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addLine(p);
                        setSearch('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-sky-500/10 flex items-center justify-between transition-colors"
                    >
                      <span className="font-medium text-slate-900 truncate">{p.name}</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 tabular-nums">
                        <MapPin className="w-3 h-3" />
                        {p.location} · สต็อก {p.stock}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCustomItem(!showCustomItem)}
              className="inline-flex items-center gap-1 px-3.5 py-2.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shrink-0 active:scale-95"
              title="เพิ่มสินค้านอกแคตตาล็อกที่ลูกค้าจัดเตรียมมา"
            >
              <Plus className="w-4 h-4" />
              <span>สินค้ากำหนดเอง</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shrink-0 active:scale-95"
            >
              <Camera className="w-4 h-4 text-sky-400" />
              <span>สแกน</span>
            </button>
          </div>

          {/* Custom Item Form */}
          {showCustomItem && (
            <div className="p-3.5 bg-teal-50/80 border border-teal-200 rounded-2xl space-y-2.5">
              <div className="text-xs font-bold text-teal-900 flex justify-between items-center">
                <span>➕ เพิ่มสินค้านอกแคตตาล็อก (Cross-Docking / ลูกค้าส่งมา)</span>
                <button
                  type="button"
                  onClick={() => setShowCustomItem(false)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="รหัส SKU (เว้นว่างเพื่อสร้างอัตโนมัติ)"
                  value={customSku}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomSku(v);
                    // Auto-fill name from the catalog when the SKU matches a product.
                    const match = products.find((p) => String(p.id).trim().toLowerCase() === v.trim().toLowerCase());
                    if (match) setCustomName(match.name || '');
                  }}
                  className="bg-white border border-teal-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="text"
                  placeholder="ชื่อสินค้า *"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="bg-white border border-teal-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 sm:col-span-2"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-teal-800">จำนวน:</span>
                  <input
                    type="number"
                    min={1}
                    value={customQty}
                    onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-white border border-teal-200 rounded-lg px-2.5 py-1 text-center text-xs font-bold text-slate-900 tabular-nums"
                  />
                  <span className="text-xs text-slate-600">ชิ้น</span>
                </div>
                <button
                  type="button"
                  onClick={addCustomItem}
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded-full text-xs font-bold shadow-2xs active:scale-95 transition-all"
                >
                  เพิ่มลงออเดอร์
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {lines.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/70">
                ยังไม่มีสินค้าในออเดอร์
              </div>
            ) : (
              lines.map((l) => {
                const opts = uomMap[l.sku] || [];
                const sel = opts.find((u) => u.code === (l.uom || opts.find((x) => x.isBase)?.code));
                const factor = sel && !sel.isBase ? sel.factor : 1;
                const base = opts.find((u) => u.isBase);
                const baseQty = l.qty * factor;
                const avail = availMap[l.sku];
                const short = avail !== undefined && baseQty > avail;
                return (
                  <div
                    key={l.sku}
                    className="flex items-center gap-3 bg-slate-50/90 border border-slate-200/80 rounded-2xl px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{l.name}</div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        {l.location || '-'} · ฿{(l.price || 0).toLocaleString()}
                        {factor > 1 && (
                          <span className="ml-2 text-indigo-700 font-semibold">
                            = {baseQty} {base?.name || 'ชิ้น'}
                          </span>
                        )}
                        {avail !== undefined &&
                          (short ? (
                            <span className="ml-2 text-rose-600 font-bold">
                              ใช้ได้ {avail} · ขาด {baseQty - avail} (backorder)
                            </span>
                          ) : (
                            <span className="ml-2 text-emerald-700 font-semibold">ใช้ได้ {avail}</span>
                          ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => setQty(l.sku, parseInt(e.target.value) || 1)}
                      className={`w-16 bg-white border rounded-lg px-2 py-1.5 text-center font-bold tabular-nums outline-none focus:border-sky-500 ${
                        short ? 'border-rose-400 text-rose-700' : 'border-slate-200 text-slate-900'
                      }`}
                    />
                    {opts.length > 1 && (
                      <select
                        value={l.uom || base?.code || ''}
                        onChange={(e) => setUom(l.sku, e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-sky-500"
                      >
                        {opts.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.name || u.code}
                            {!u.isBase ? ` (×${u.factor})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => removeLine(l.sku)}
                      className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="p-5 border-t border-slate-200/80 flex items-center justify-between sticky bottom-0 bg-slate-50/95 backdrop-blur-md">
          <div className="text-sm text-slate-600 tabular-nums">
            รวม <b className="text-slate-900 text-lg">฿{total.toLocaleString()}</b> ·{' '}
            {lines.reduce((s, l) => s + l.qty, 0)} ชิ้น
          </div>
          <button
            onClick={submit}
            disabled={saving || lines.length === 0}
            className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold shadow-md hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
          >
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
  const photoList = order.podPhoto ? order.podPhoto.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(photoList[0] || null);
  const tmsId = order.tmsJobId || (order.trackingNo?.startsWith('JOB-') ? order.trackingNo : null);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-slate-900"
        onClick={(e) => e.stopPropagation()}
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
          <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="font-mono font-black text-slate-900 text-base tabular-nums">{order.orderNo}</span>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-800 border border-emerald-500/25">
                จัดส่งถึงแล้ว (DELIVERED)
              </span>
            </div>
            <div className="text-xs text-slate-700 space-y-1">
              <div>
                <b>ลูกค้า:</b> {order.customerName} {order.phone ? `(${order.phone})` : ''}
              </div>
              {order.shipAddress && (
                <div>
                  <b>ที่อยู่ส่งมอบ:</b> {order.shipAddress}
                </div>
              )}
              {order.deliveredAt && (
                <div className="tabular-nums">
                  <b>วันเวลาส่งมอบ:</b> {new Date(order.deliveredAt).toLocaleString('th-TH')}
                </div>
              )}
              {(order.driverName || order.vehiclePlate) && (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {order.driverName && (
                    <span className="bg-white text-slate-800 px-2.5 py-1 rounded-full text-xs font-bold border border-slate-200">
                      👤 คนขับ: {order.driverName}
                    </span>
                  )}
                  {order.vehiclePlate && (
                    <span className="bg-white text-slate-800 px-2.5 py-1 rounded-full text-xs font-bold border border-slate-200">
                      🚚 ทะเบียน: {order.vehiclePlate}
                    </span>
                  )}
                </div>
              )}
              {order.podNote && (
                <div
                  className={`p-3 rounded-xl border font-medium mt-2 text-xs leading-relaxed ${
                    order.podNote.includes('⚠️')
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <div>
                    <b>บันทึกหลักฐาน POD:</b> {order.podNote}
                  </div>
                  {order.podNote.includes('⚠️') && (
                    <div className="mt-2 pt-2 border-t border-amber-200 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] text-amber-800">
                        ระบบเชื่อมโยงใบคืนสินค้า (RMA/Quarantine) อัตโนมัติแล้ว
                      </span>
                      <a
                        href="/ops/returns"
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-600 text-white font-bold text-[11px] hover:bg-amber-500 transition-colors shadow-2xs"
                      >
                        <span>ไปที่จัดการของคืน (RMA)</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
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
                <img src={order.podSignature} alt="ลายเซ็นผู้รับสินค้า" className="max-h-40 object-contain rounded" />
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/70">
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
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center aspect-video relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedPhoto} alt="รูปหลักฐานการส่งมอบสินค้า" className="max-h-80 w-full object-contain" />
                    <a
                      href={selectedPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 bg-slate-900/75 text-white p-2 rounded-full hover:bg-slate-900 transition-colors"
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
                          selectedPhoto === url
                            ? 'border-emerald-500 scale-95 shadow-md'
                            : 'border-slate-200 opacity-70 hover:opacity-100'
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
              <div className="p-6 text-center text-xs text-slate-500 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/70">
                ไม่มีรูปถ่ายหลักฐาน
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 flex items-center justify-between bg-slate-50/90">
          {tmsId && (process.env.NEXT_PUBLIC_TMS_APP_URL || process.env.NEXT_PUBLIC_TMS_URL) ? (
            <a
              href={`${(process.env.NEXT_PUBLIC_TMS_APP_URL || process.env.NEXT_PUBLIC_TMS_URL || '').replace(
                /\/$/,
                ''
              )}/track/${encodeURIComponent(tmsId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดใบงานในระบบ TMS ({tmsId})</span>
            </a>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Management-only order editor — fix a mis-entered order's shipping details and items (SKU/Qty/Price)
// Guarded server-side. Resyncs stock reservations automatically when items are updated.
function EditOrderModal({
  order,
  carriers,
  onClose,
  onDone,
}: {
  order: Order;
  carriers: Carrier[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'items' | 'info'>('items');
  const [deliveryMode, setDeliveryMode] = useState<'DELIVERY' | 'SELF_PICKUP'>(order.deliveryMode || 'DELIVERY');
  const [freightCost, setFreightCost] = useState(String(order.freightCost || ''));
  const [carrier, setCarrier] = useState(order.carrier || '');
  const [customerName, setCustomerName] = useState(order.customerName || '');
  const [phone, setPhone] = useState(order.phone || '');
  const [shipAddress, setShipAddress] = useState(order.shipAddress || '');
  const [refNo, setRefNo] = useState(order.refNo || '');
  const [saving, setSaving] = useState(false);

  // Line items state
  const [items, setItems] = useState<Line[]>(() =>
    (order.items || []).map((l) => ({
      sku: l.sku || '',
      name: l.name || '',
      qty: Number(l.qty) || 1,
      price: Number(l.price) || 0,
      location: l.location || '',
      drop: l.drop || 1,
      picked: l.picked || 0,
      packed: l.packed || 0,
    }))
  );

  const canEditItems = !['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status);

  // Autocomplete catalog from master products
  const [catalog, setCatalog] = useState<{ id: string; name: string; price?: number; location?: string }[]>([]);
  useEffect(() => {
    fetch('/api/products')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setCatalog(data);
      })
      .catch(() => {});
  }, []);

  const handleSkuChange = (index: number, newSku: string) => {
    setItems((prev) => {
      const next = [...prev];
      const match = catalog.find((p) => p.id?.toLowerCase() === newSku.trim().toLowerCase());
      next[index] = {
        ...next[index],
        sku: newSku,
        name: match?.name || next[index].name,
        price: match?.price ?? next[index].price,
        location: match?.location || next[index].location,
      };
      return next;
    });
  };

  const handleQtyChange = (index: number, val: string) => {
    const q = Math.max(1, parseInt(val, 10) || 1);
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], qty: q };
      return next;
    });
  };

  const handleNameChange = (index: number, name: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name };
      return next;
    });
  };

  const handleRemoveLine = (index: number) => {
    if (items.length <= 1) {
      toast.error('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddLine = () => {
    setItems((prev) => [...prev, { sku: '', name: '', qty: 1, price: 0, location: '', drop: 1, picked: 0, packed: 0 }]);
  };

  const totalItemQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const totalItemAmount = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);

  const save = async () => {
    if (canEditItems) {
      if (items.length === 0) {
        toast.error('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
        setActiveTab('items');
        return;
      }
      for (let i = 0; i < items.length; i++) {
        if (!items[i].sku || !items[i].sku.trim()) {
          toast.error(`กรุณาระบุรหัสสินค้า (SKU) ในบรรทัดที่ ${i + 1}`);
          setActiveTab('items');
          return;
        }
        if (!items[i].qty || Number(items[i].qty) <= 0) {
          toast.error(`จำนวนสินค้าในบรรทัดที่ ${i + 1} ต้องมากกว่า 0`);
          setActiveTab('items');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        id: order.id,
        deliveryMode,
        freightCost: Number(freightCost) || 0,
        carrier: deliveryMode === 'SELF_PICKUP' ? 'ลูกค้ารับเอง' : carrier,
        customerName,
        phone,
        shipAddress,
        refNo,
      };

      if (canEditItems) {
        payload.items = items.map((l) => ({
          sku: l.sku.trim().toUpperCase(),
          name: l.name.trim() || l.sku.trim().toUpperCase(),
          qty: Number(l.qty) || 1,
          price: Number(l.price) || 0,
          location: l.location || '',
          drop: l.drop || 1,
          picked: l.picked || 0,
          packed: l.packed || 0,
        }));
      }

      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error === 'Forbidden' ? 'เฉพาะแอดมินขึ้นไปเท่านั้น' : json.error || 'บันทึกไม่สำเร็จ');
      toast.success('แก้ไขออเดอร์และรายการสินค้าเรียบร้อยแล้ว');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-white/90 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Pencil className="w-4 h-4 text-sky-600" />
              แก้ไขออเดอร์ {order.orderNo}
            </h3>
            <p className="text-[11px] text-slate-500">
              แก้ไขรหัสสินค้าที่พิมพ์ผิด หรือแก้ข้อมูลจัดส่ง/ลูกค้า (เฉพาะแอดมิน)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 border-b border-slate-200/80 bg-slate-50/90 px-6 py-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'items'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>รายการสินค้า ({items.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'info'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>ข้อมูลจัดส่ง / ลูกค้า</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <datalist id="catalog-skus">
            {catalog.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.location ? `(${p.location})` : ''}
              </option>
            ))}
          </datalist>

          {activeTab === 'items' && (
            <div className="space-y-3">
              {canEditItems ? (
                <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs">
                  💡 <b>แก้ไขรหัสสินค้า (SKU):</b> พิมพ์แก้รหัสเดิมที่ผิดได้ทันที ระบบจะปลดการจองสต็อกเดิม
                  และจองสต็อกของ SKU ตัวใหม่ให้อัตโนมัติ โดยใบส่งสินค้าจะอัปเดตเป็นรหัสที่ถูกต้องทันที
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  🔒 ออเดอร์นี้อยู่ในสถานะ <b>{STATUS_TH[order.status] || order.status}</b> (ตัดสต็อกแล้ว)
                  ไม่สามารถแก้ไขรายการสินค้าได้โดยตรง หากต้องการสลับของกรุณาทำรับคืนเข้าคลัง (Return)
                </div>
              )}

              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">รายการที่ {idx + 1}</span>
                      {canEditItems && items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2.5 py-0.5 rounded-full hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ลบ</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-5">
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">รหัสสินค้า (SKU) *</label>
                        <input
                          type="text"
                          list="catalog-skus"
                          value={it.sku}
                          disabled={!canEditItems}
                          onChange={(e) => handleSkuChange(idx, e.target.value)}
                          placeholder="เช่น A08842NT..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs font-bold outline-none focus:border-sky-500 disabled:opacity-50"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">ชื่อสินค้า</label>
                        <input
                          type="text"
                          value={it.name}
                          disabled={!canEditItems}
                          onChange={(e) => handleNameChange(idx, e.target.value)}
                          placeholder="ชื่อสินค้า"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:border-sky-500 disabled:opacity-50"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">จำนวน *</label>
                        <input
                          type="number"
                          min="1"
                          value={it.qty}
                          disabled={!canEditItems}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold text-xs text-right tabular-nums outline-none focus:border-sky-500 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {canEditItems && (
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="w-full py-2.5 rounded-full border border-dashed border-slate-300 hover:border-sky-500 text-sky-700 hover:bg-sky-500/5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรายการสินค้า (+ Add Item)</span>
                </button>
              )}

              <div className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs tabular-nums">
                <span className="text-slate-600 font-medium">สรุปรวมสินค้า:</span>
                <span className="font-bold text-slate-900 font-mono">
                  รวม <span className="text-sky-600">{totalItemQty.toLocaleString()}</span> ชิ้น{' '}
                  {totalItemAmount > 0 ? ` (฿${totalItemAmount.toLocaleString()})` : ''}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(
                  [
                    { key: 'DELIVERY', label: '🚚 ส่งขนส่ง' },
                    { key: 'SELF_PICKUP', label: '🏭 ลูกค้ารับเอง' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setDeliveryMode(m.key)}
                    className={`flex-1 py-2.5 rounded-full text-sm font-bold border transition-all ${
                      deliveryMode === m.key
                        ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600 space-y-1">
                  <span>ค่าขนส่ง (บาท)</span>
                  <input
                    type="number"
                    value={freightCost}
                    onChange={(e) => setFreightCost(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold tabular-nums outline-none focus:border-sky-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600 space-y-1">
                  <span>ขนส่ง</span>
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    disabled={deliveryMode === 'SELF_PICKUP'}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm outline-none focus:border-sky-500 disabled:opacity-40"
                  >
                    {deliveryMode === 'SELF_PICKUP' ? (
                      <option>— ลูกค้ารับเอง —</option>
                    ) : (
                      <>
                        <option value="">— เลือก —</option>
                        {carriers.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                        <option value="รถขนส่งบริษัท">รถขนส่งบริษัท (จัดส่งเอง)</option>
                      </>
                    )}
                  </select>
                </label>
              </div>

              <label className="text-xs font-semibold text-slate-600 space-y-1 block">
                <span>ชื่อลูกค้า</span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium outline-none focus:border-sky-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600 space-y-1">
                  <span>เบอร์โทร</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600 space-y-1">
                  <span>อ้างอิง/PO</span>
                  <input
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-mono outline-none focus:border-sky-500"
                  />
                </label>
              </div>
              <label className="text-xs font-semibold text-slate-600 space-y-1 block">
                <span>ที่อยู่ / ปลายทาง</span>
                <input
                  value={shipAddress}
                  onChange={(e) => setShipAddress(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 outline-none focus:border-sky-500"
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/90 shrink-0">
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors shadow-md"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{' '}
            บันทึกการแก้ไขออเดอร์
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTripModal({
  selectedOrders,
  carriers: _carriers,
  onClose,
  onDone,
}: {
  selectedOrders: Order[];
  carriers: Carrier[];
  onClose: () => void;
  onDone: (tripId: string) => void;
}) {
  void _carriers;
  const [orders, setOrders] = useState<Order[]>(selectedOrders);
  const [driverName, setDriverName] = useState(orders[0]?.driverName || '');
  const [vehiclePlate, setVehiclePlate] = useState(orders[0]?.vehiclePlate || '');
  const [vehicleType, setVehicleType] = useState(orders[0]?.vehicleType || '4-Wheel');
  const [dockBay, setDockBay] = useState(orders[0]?.dockBay || 'BAY-01');
  const [sendToTms, setSendToTms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  useEffect(() => {
    fetch('/api/fleet-vehicles')
      .then((r) => r.json())
      .then((d) => {
        if (d.vehicles && Array.isArray(d.vehicles)) {
          setVehicles(d.vehicles);
          if (!driverName && !vehiclePlate && d.vehicles[0]) {
            const first = d.vehicles.find((v: any) => v.isAvailable) || d.vehicles[0];
            setSelectedVehicleId(first.id);
            setVehiclePlate(first.plate || first.plateNumber || '');
            setDriverName(first.driverName || first.assignedDriverName || '');
            if (first.vehicleType) setVehicleType(first.vehicleType);
          }
        }
      })
      .catch(() => {});
  }, []);

  const moveOrder = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= orders.length) return;
    const newArr = [...orders];
    const temp = newArr[index];
    newArr[index] = newArr[targetIdx];
    newArr[targetIdx] = temp;
    setOrders(newArr);
  };

  const handleSubmit = async () => {
    if (!driverName.trim() || !vehiclePlate.trim()) {
      toast.error('กรุณาระบุชื่อคนขับและทะเบียนรถ');
      return;
    }
    setSubmitting(true);
    const t = toast.loading('กำลังสร้างทริปจัดส่งรวม...');
    try {
      const res = await fetch('/api/orders/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: orders.map((o) => o.id),
          driverName: driverName.trim(),
          vehiclePlate: vehiclePlate.trim(),
          vehicleType,
          dockBay,
          sendToTms,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างทริปไม่สำเร็จ');
      toast.success(json.message || `สร้างทริป ${json.tripId} สำเร็จ`, { id: t });
      onDone(json.tripId);
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาดในการสร้างทริป', { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
          <div className="font-black text-lg flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-400" />
            <span>จัดทริปส่งสินค้ารวม (Multi-Drop Trip Manifest)</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Dispatcher Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80">
            {vehicles.length > 0 && (
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">
                  🚛 เลือกรถจากกองยาน (TMS / Fleet Sync)
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => {
                    setSelectedVehicleId(e.target.value);
                    const v = vehicles.find((x: any) => x.id === e.target.value);
                    if (v) {
                      setVehiclePlate(v.plate || v.plateNumber || '');
                      setDriverName(v.driverName || v.assignedDriverName || '');
                      if (v.vehicleType) setVehicleType(v.vehicleType);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-900 font-bold focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- ระบุข้อมูลเอง หรือเลือกจากรายการด้านล่าง --</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.plate || v.plateNumber}{' '}
                      {v.driverName || v.assignedDriverName ? `- ${v.driverName || v.assignedDriverName}` : ''} (
                      {v.vehicleType || '4-Wheel'}) {v.statusLabel ? `[${v.statusLabel}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-slate-700 font-bold mb-1">👤 ชื่อพนักงานขับรถ *</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="เช่น สมชาย หรือ คนขับบริษัท"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">🚚 ทะเบียนรถ *</label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="เช่น กก-4321 หรือ 70-1234"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">🚗 ประเภทรถ</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:border-indigo-500 focus:outline-none"
              >
                <option value="4-Wheel">กระบะ 4 ล้อ (4-Wheel)</option>
                <option value="6-Wheel">รถบรรทุก 6 ล้อ (6-Wheel)</option>
                <option value="10-Wheel">รถบรรทุก 10 ล้อ (10-Wheel)</option>
                <option value="Motorcycle">มอเตอร์ไซค์ (Motorcycle)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">⚓ ท่าโหลดสินค้า (Dock Bay)</label>
              <input
                type="text"
                value={dockBay}
                onChange={(e) => setDockBay(e.target.value)}
                placeholder="เช่น BAY-01 หรือ BAY-02"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* TMS Integration Toggle */}
          <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-4">
            <div>
              <b className="text-slate-900 text-sm">🌐 ส่งงานเข้าแอปคนขับ NEXUS-TMS</b>
              <p className="text-slate-600 text-[11px] mt-0.5">
                สร้างงาน Multi-Drop ใน TMS ให้คนขับเห็นจุดส่งตามลำดับ (ปิดสวิตช์นี้ได้หากใช้งาน WMS แบบ Standalone)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={sendToTms}
                onChange={(e) => setSendToTms(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Stops List (Re-orderable) */}
          <div className="space-y-2">
            <div className="text-slate-700 font-bold uppercase tracking-wider flex justify-between items-center tabular-nums">
              <span>ลำดับจุดส่งสินค้าในทริปนี้ ({orders.length} จุดแวะ):</span>
              <span className="text-[11px] text-slate-500 font-medium normal-case">
                กดลูกศรขึ้น/ลง เพื่อสลับลำดับจุดส่ง
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {orders.map((o, idx) => (
                <div
                  key={o.id}
                  className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-black grid place-items-center text-xs shrink-0 tabular-nums">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">
                        <span className="font-mono text-indigo-700">{o.orderNo}</span> · {o.customerName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate tabular-nums">
                        📍 {o.shipAddress || 'ไม่ระบุที่อยู่'} ({o.totalQty} ชิ้น)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveOrder(idx, 'UP')}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700"
                      title="เลื่อนขึ้น"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === orders.length - 1}
                      onClick={() => moveOrder(idx, 'DOWN')}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700"
                      title="เลื่อนลง"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 flex items-center justify-between bg-slate-50/90">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-slate-200 text-slate-700 text-xs font-bold hover:bg-white transition-colors"
          >
            ยกเลิก
          </button>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 tabular-nums"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            <span>ยืนยันจัดทริปส่ง ({orders.length} ออเดอร์)</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
