'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Banknote,
  CheckCircle,
  Clock,
  Search,
  Printer,
  X,
  AlertTriangle,
  ShieldCheck,
  Truck,
  RefreshCw,
  QrCode,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CodOrderRecord, CodKpiSummary } from '@/lib/data/cod';

export default function CodReconcilePage() {
  const [records, setRecords] = useState<CodOrderRecord[]>([]);
  const [kpi, setKpi] = useState<CodKpiSummary>({
    pendingCount: 0,
    pendingAmount: 0,
    remittedTodayCount: 0,
    remittedTodayAmount: 0,
    totalShortageAmount: 0,
    cashRemittedAmount: 0,
    transferRemittedAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'REMITTED' | 'ALL'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal State
  const [settleModalOrders, setSettleModalOrders] = useState<CodOrderRecord[] | null>(null);
  const [viewPodOrder, setViewPodOrder] = useState<CodOrderRecord | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/cod?status=ALL`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'โหลดข้อมูลล้มเหลว');
      setRecords(data.records || []);
      if (data.kpi) setKpi(data.kpi);
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Unique drivers list for filter dropdown
  const driversList = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.driverName) set.add(r.driverName);
    });
    return Array.from(set);
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Status filter
      if (statusFilter === 'PENDING' && r.settlement.settled) return false;
      if (statusFilter === 'REMITTED' && !r.settlement.settled) return false;

      // Driver filter
      if (selectedDriver && r.driverName !== selectedDriver) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          r.orderNo.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.vehiclePlate.toLowerCase().includes(q) ||
          r.driverName.toLowerCase().includes(q) ||
          r.tripId.toLowerCase().includes(q) ||
          (r.settlement.receiptNo && r.settlement.receiptNo.toLowerCase().includes(q)) ||
          r.shipAddress.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [records, statusFilter, selectedDriver, searchQuery]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const pendingInView = filteredRecords.filter((r) => !r.settlement.settled).map((r) => r.id);
    if (selectedIds.length === pendingInView.length && pendingInView.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingInView);
    }
  };

  const selectedOrders = useMemo(() => {
    return records.filter((r) => selectedIds.includes(r.id));
  }, [records, selectedIds]);

  const selectedTotalAmount = useMemo(() => {
    return selectedOrders.reduce((sum, o) => sum + o.expectedCod, 0);
  }, [selectedOrders]);

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Open Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Cash on Delivery Reconciliation
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-700">
                <Banknote className="w-5 h-5" />
              </span>
              <span>กระทบยอดเงินสด COD & ค่าขนส่ง</span>
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm mt-1">
              ตรวจสอบและบันทึกการส่งมอบเงินสด/เงินโอนจากพนักงานขับรถ พร้อมออกใบสำคัญรับเงินอัตโนมัติ
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={fetchRecords}
              disabled={loading}
              className="px-4 py-2 rounded-full border border-slate-200/80 bg-white/85 hover:bg-white text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${loading ? 'animate-spin' : ''}`} />
              <span>รีเฟรช</span>
            </button>
            <Link
              href="/ops/orders"
              className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>จัดการออเดอร์</span>
            </Link>
          </div>
        </div>

        {/* 4 KPI Summary Cards (1 Dark Accent Hero Card + 3 Glass Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Pending Hero Dark Accent Card */}
          <div className="nx-dark-accent-card p-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>รอคนขับนำส่งเงิน (Pending)</span>
                </div>
                <div className="text-3xl font-bold text-white mt-2 font-mono tabular-nums">
                  ฿
                  {kpi.pendingAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-slate-300 mt-1 tabular-nums">ค้างส่ง {kpi.pendingCount} รายการ</div>
              </div>
              <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-400/30 text-amber-300">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Remitted Today Card */}
          <div className="nx-glass-card p-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>นำส่งเงินแล้ววันนี้ (Remitted)</span>
                </div>
                <div className="text-3xl font-bold text-emerald-700 mt-2 font-mono tabular-nums">
                  ฿
                  {kpi.remittedTodayAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  รับเข้าคลัง {kpi.remittedTodayCount} รายการวันนี้
                </div>
              </div>
              <div className="p-3 bg-emerald-500/12 rounded-2xl border border-emerald-500/20 text-emerald-700">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Shortages Card */}
          <div className="nx-glass-card p-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>ส่วนต่าง / ยอดขาดส่ง</span>
                </div>
                <div className="text-3xl font-bold text-rose-600 mt-2 font-mono tabular-nums">
                  ฿
                  {kpi.totalShortageAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-slate-500 mt-1">ยอดติดค้างจากคนขับ / ส่วนลด</div>
              </div>
              <div className="p-3 bg-rose-500/12 rounded-2xl border border-rose-500/20 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Payment Channels Card */}
          <div className="nx-glass-card p-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>สรุปช่องทางชำระเงิน</span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-4 font-bold text-slate-900">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Banknote className="w-3.5 h-3.5" /> เงินสด:
                    </span>
                    <span className="font-mono tabular-nums">฿{kpi.cashRemittedAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-4 font-bold text-slate-900">
                    <span className="flex items-center gap-1 text-sky-700">
                      <QrCode className="w-3.5 h-3.5" /> สแกน/โอน:
                    </span>
                    <span className="font-mono tabular-nums">฿{kpi.transferRemittedAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-sky-500/12 rounded-2xl border border-sky-500/20 text-sky-700">
                <Banknote className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Control Bar & Filter Tabs */}
        <div className="nx-glass-card p-4">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center bg-slate-100/90 p-1 rounded-full border border-slate-200/80 text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-4 py-2 rounded-full transition-all flex items-center gap-1.5 ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-500 text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>รอคนขับนำส่งเงิน</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/60 font-mono tabular-nums">
                  {records.filter((r) => !r.settlement.settled).length}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('REMITTED')}
                className={`px-4 py-2 rounded-full transition-all flex items-center gap-1.5 ${
                  statusFilter === 'REMITTED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>นำส่งเงินแล้ว</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 font-mono tabular-nums">
                  {records.filter((r) => r.settlement.settled).length}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-4 py-2 rounded-full transition-all flex items-center gap-1.5 tabular-nums ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>ทั้งหมด ({records.length})</span>
              </button>
            </div>

            {/* Search & Driver Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหา ออเดอร์ / ลูกค้า / ทริป..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-white/90 border border-slate-200/80 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {driversList.length > 0 && (
                <div className="relative w-full sm:w-48">
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-full bg-white/90 border border-slate-200/80 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">คนขับทั้งหมด</option>
                    {driversList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="nx-glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredRecords.filter((r) => !r.settlement.settled).length > 0 &&
                        selectedIds.length === filteredRecords.filter((r) => !r.settlement.settled).length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-amber-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="p-4">เลขออเดอร์ / ทริป</th>
                  <th className="p-4">ลูกค้า & ที่อยู่จัดส่ง</th>
                  <th className="p-4">คนขับ / ทะเบียนรถ</th>
                  <th className="p-4 text-right">ยอดเก็บเงิน (COD)</th>
                  <th className="p-4 text-center">หลักฐานจัดส่ง (ePOD)</th>
                  <th className="p-4 text-center">สถานะการนำส่งเงิน</th>
                  <th className="p-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500">
                      <Banknote className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                      <p className="font-bold text-sm text-slate-700">ไม่พบรายการกระทบยอดเงินสดตามเงื่อนไข</p>
                      <p className="text-xs text-slate-500 mt-1">
                        ออเดอร์ที่มีมูลค่าเก็บเงินจะแสดงที่นี่โดยอัตโนมัติ
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const isSettled = r.settlement.settled;
                    const isChecked = selectedIds.includes(r.id);

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50/70 transition-colors ${isChecked ? 'bg-amber-50/70' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="p-4 text-center">
                          {!isSettled ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelect(r.id)}
                              className="rounded border-slate-300 text-amber-600 focus:ring-0 cursor-pointer"
                            />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                          )}
                        </td>

                        {/* Order & Trip */}
                        <td className="p-4">
                          <div className="font-mono font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>{r.orderNo}</span>
                            {r.dropSeq && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-500/12 text-sky-700 border border-sky-500/20 text-[10px] font-sans font-semibold">
                                {r.dropSeq}
                              </span>
                            )}
                          </div>
                          {r.tripId ? (
                            <div className="text-[11px] text-sky-700 font-mono flex items-center gap-1 mt-0.5">
                              <Truck className="w-3 h-3" />
                              <span>{r.tripId}</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 mt-0.5">{r.carrier || 'จัดส่งเอง'}</div>
                          )}
                        </td>

                        {/* Customer & Address */}
                        <td className="p-4 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">{r.customerName}</div>
                          <div className="text-[11px] text-slate-600 truncate mt-0.5">
                            📍 {r.shipAddress || 'ไม่ระบุที่อยู่'}
                          </div>
                          {r.phone && <div className="text-[10px] text-slate-500 font-mono mt-0.5">📞 {r.phone}</div>}
                        </td>

                        {/* Driver & Plate */}
                        <td className="p-4">
                          <div className="font-semibold text-slate-800">{r.driverName || 'ยังไม่ระบุคนขับ'}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            🚚 {r.vehiclePlate || '-'} {r.vehicleType ? `(${r.vehicleType})` : ''}
                          </div>
                        </td>

                        {/* COD Amount */}
                        <td className="p-4 text-right">
                          <div className="font-mono font-bold text-amber-700 text-sm tabular-nums">
                            ฿
                            {r.expectedCod.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          {r.freightCost > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                              (รวมค่าส่ง ฿{r.freightCost.toLocaleString()})
                            </div>
                          )}
                          {isSettled && r.settlement.shortageAmount > 0 && (
                            <div className="text-[10px] text-rose-600 font-bold mt-0.5 tabular-nums">
                              ส่วนต่าง: -฿{r.settlement.shortageAmount.toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* ePOD Status */}
                        <td className="p-4 text-center">
                          {r.podPhoto || r.podSignature ? (
                            <button
                              onClick={() => setViewPodOrder(r)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-500/12 border border-sky-500/20 text-sky-700 hover:bg-sky-500/20 text-[11px] font-semibold transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ดูหลักฐาน POD</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">ไม่มีรูป POD</span>
                          )}
                        </td>

                        {/* Settlement Status */}
                        <td className="p-4 text-center">
                          {isSettled ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 font-semibold text-[11px]">
                                <CheckCircle className="w-3 h-3" />
                                <span>นำส่งเงินแล้ว</span>
                              </span>
                              {r.settlement.receiptNo && (
                                <div className="text-[10px] font-mono text-slate-500">{r.settlement.receiptNo}</div>
                              )}
                              <div className="text-[10px] text-slate-500">
                                {r.settlement.paymentChannel === 'TRANSFER' ? 'สแกน QR / เงินโอน' : 'เงินสด'}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-800 font-semibold text-[11px]">
                              <Clock className="w-3 h-3" />
                              <span>รอคนขับนำส่งเงิน</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          {!isSettled ? (
                            <button
                              onClick={() => setSettleModalOrders([r])}
                              className="px-3.5 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs shadow-xs active:scale-95 transition-all inline-flex items-center gap-1.5"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>รับเงินนำส่ง</span>
                            </button>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/print/cod-receipt?receiptNo=${r.settlement.receiptNo || ''}&orderIds=${r.id}`}
                                target="_blank"
                                className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-xs inline-flex items-center gap-1 shadow-xs transition-all"
                              >
                                <Printer className="w-3.5 h-3.5 text-amber-600" />
                                <span>ใบเสร็จ</span>
                              </Link>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Batch Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/95 border-2 border-amber-500/50 rounded-3xl shadow-2xl p-4 flex items-center gap-6 max-w-xl w-full mx-4 backdrop-blur-xl text-slate-900"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-amber-500 text-slate-900 font-bold grid place-items-center text-xs shrink-0 tabular-nums">
                {selectedIds.length}
              </span>
              <div>
                <div className="text-xs text-slate-500">เลือกออเดอร์สำหรับปิดกะนำส่งเงิน</div>
                <div className="font-bold text-slate-900 text-base tabular-nums">
                  ยอดรวม ฿
                  {selectedTotalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <button
                onClick={() => setSelectedIds([])}
                className="px-3.5 py-2 rounded-full text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => setSettleModalOrders(selectedOrders)}
                className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs shadow-sm active:scale-95 transition-all flex items-center gap-2"
              >
                <Banknote className="w-4 h-4" />
                <span>รับเงินนำส่งรวม ({selectedIds.length} รายการ)</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settle Remittance Modal */}
      {settleModalOrders && (
        <SettleRemittanceModal
          orders={settleModalOrders}
          onClose={() => setSettleModalOrders(null)}
          onSuccess={(receiptNo) => {
            setSettleModalOrders(null);
            setSelectedIds([]);
            fetchRecords();
            toast.success(`บันทึกรับเงินสำเร็จ ออกใบเสร็จเลขที่ ${receiptNo}`);
            window.open(`/print/cod-receipt?receiptNo=${receiptNo}`, '_blank');
          }}
        />
      )}

      {/* ePOD Viewer Modal */}
      {viewPodOrder && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={() => setViewPodOrder(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 space-y-4 overflow-hidden shadow-2xl text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-200/80">
              <div>
                <h3 className="font-bold text-lg text-slate-900">หลักฐานการส่งมอบ (ePOD)</h3>
                <p className="text-xs text-sky-700 font-mono mt-0.5">{viewPodOrder.orderNo}</p>
              </div>
              <button onClick={() => setViewPodOrder(null)} className="p-1.5 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {viewPodOrder.podPhoto && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1">📸 รูปถ่ายขณะส่งมอบสินค้า:</div>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-60 flex items-center justify-center">
                    <img src={viewPodOrder.podPhoto} alt="POD Photo" className="max-h-60 w-auto object-contain" />
                  </div>
                </div>
              )}

              {viewPodOrder.podSignature && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1">✍️ ลายเซ็นผู้รับสินค้า:</div>
                  <div className="p-3 bg-white rounded-2xl flex items-center justify-center border border-slate-200">
                    <img
                      src={viewPodOrder.podSignature}
                      alt="POD Signature"
                      className="max-h-24 w-auto object-contain"
                    />
                  </div>
                </div>
              )}

              {viewPodOrder.podNote && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
                  <span className="font-bold text-slate-800">บันทึกเพิ่มเติมจากคนขับ: </span>
                  <span className="text-slate-600">{viewPodOrder.podNote}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewPodOrder(null)}
                className="px-5 py-2 rounded-full bg-slate-900 text-white font-semibold text-xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Modal Component for Settling COD
function SettleRemittanceModal({
  orders,
  onClose,
  onSuccess,
}: {
  orders: CodOrderRecord[];
  onClose: () => void;
  onSuccess: (receiptNo: string) => void;
}) {
  const totalExpected = orders.reduce((sum, o) => sum + o.expectedCod, 0);
  const [actualAmount, setActualAmount] = useState<number>(totalExpected);
  const [paymentChannel, setPaymentChannel] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [transferRef, setTransferRef] = useState('');
  const [shortageReason, setShortageReason] = useState('');
  const [settledBy, setSettledBy] = useState('แคชเชียร์คลังสินค้า');
  const [markDelivered, setMarkDelivered] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const shortage = Math.max(0, totalExpected - actualAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualAmount < 0) {
      toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง');
      return;
    }
    if (shortage > 0 && !shortageReason.trim()) {
      toast.error('มียอดเงินขาดส่ง กรุณาระบุเหตุผลส่วนต่าง');
      return;
    }
    if (paymentChannel === 'TRANSFER' && !transferRef.trim()) {
      toast.error('กรุณาระบุเลขอ้างอิงสลิปโอนเงิน / QR Ref');
      return;
    }

    setSubmitting(true);
    const t = toast.loading('กำลังบันทึกการรับเงินนำส่ง...');
    try {
      const res = await fetch('/api/finance/cod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: orders.map((o) => o.id),
          settledAmount: actualAmount,
          paymentChannel,
          transferRef: transferRef.trim(),
          shortageReason: shortageReason.trim(),
          settledBy: settledBy.trim(),
          markDelivered,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');

      toast.dismiss(t);
      onSuccess(json.receiptNo);
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึก', { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-amber-500 text-slate-900 flex justify-between items-center">
          <div className="font-bold text-lg flex items-center gap-2">
            <Banknote className="w-6 h-6" />
            <span>บันทึกรับเงินนำส่ง (Reconciliation)</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-black/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Orders Selected Breakdown */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="font-semibold text-slate-700 flex justify-between items-center text-[11px] uppercase tracking-wider">
              <span>รายการออเดอร์ที่รับเงิน ({orders.length} รายการ):</span>
              <span className="font-mono text-amber-700 font-bold tabular-nums">
                รวม ฿
                {totalExpected.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200/80"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-900 truncate flex items-center gap-2">
                      <span className="font-mono text-sky-700">{o.orderNo}</span>
                      <span className="text-slate-500 font-normal">· {o.customerName}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      คนขับ: {o.driverName || 'ไม่ระบุ'} ({o.vehiclePlate || '-'})
                    </div>
                  </div>
                  <div className="font-mono font-bold text-amber-700 shrink-0 tabular-nums">
                    ฿
                    {o.expectedCod.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-slate-700 font-bold mb-2">ช่องทางรับชำระเงิน *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentChannel('CASH')}
                className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  paymentChannel === 'CASH'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-900 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <Banknote className="w-5 h-5" />
                <span>เงินสด (Cash)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentChannel('TRANSFER')}
                className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  paymentChannel === 'TRANSFER'
                    ? 'bg-sky-500/12 border-sky-500 text-sky-800 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span>สแกน QR / เงินโอน</span>
              </button>
            </div>
          </div>

          {/* Transfer Reference if TRANSFER */}
          {paymentChannel === 'TRANSFER' && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                เลขอ้างอิงสลิปโอนเงิน / รหัส QR Ref *
              </label>
              <input
                type="text"
                placeholder="เช่น 2026102812345678 หรือ KTB-XXXXX"
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {/* Actual Amount Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">ยอดเงินที่รับมอบจริง (฿) *</label>
              <input
                type="number"
                step="0.01"
                value={actualAmount}
                onChange={(e) => setActualAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-base font-bold tabular-nums focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">ผู้รับเงินเข้าคลัง (Cashier) *</label>
              <input
                type="text"
                value={settledBy}
                onChange={(e) => setSettledBy(e.target.value)}
                placeholder="ชื่อเจ้าหน้าที่"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Shortage Warning */}
          {shortage > 0 && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl space-y-2">
              <div className="text-rose-700 font-bold flex items-center gap-1.5 tabular-nums">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  มียอดเงินขาดส่ง: -฿
                  {shortage.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <label className="block text-slate-700 text-[11px] font-bold">
                ระบุเหตุผลส่วนต่าง / ยอดค้างชำระ *
              </label>
              <input
                type="text"
                value={shortageReason}
                onChange={(e) => setShortageReason(e.target.value)}
                placeholder="เช่น ลูกค้าขอต่อรองราคา / สินค้าเสียหายคืนบางส่วน / คนขับขอเคลียร์พรุ่งนี้"
                className="w-full px-3 py-2 rounded-xl bg-white border border-rose-500/30 text-slate-900 focus:outline-none focus:border-rose-500"
              />
            </div>
          )}

          {/* Mark delivered toggle */}
          <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 cursor-pointer">
            <input
              type="checkbox"
              checked={markDelivered}
              onChange={(e) => setMarkDelivered(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
            />
            <div>
              <div className="font-bold text-slate-900 text-xs">ปรับสถานะออเดอร์เป็น DELIVERED ทันที</div>
              <div className="text-[11px] text-slate-500">
                ยืนยันการจัดส่งสมบูรณ์เมื่อเงินสดนำส่งเข้าคลังเรียบร้อย
              </div>
            </div>
          </label>

          {/* Modal Actions */}
          <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{submitting ? 'กำลังบันทึก...' : 'ยืนยันรับเงินและออกใบสำคัญ'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
