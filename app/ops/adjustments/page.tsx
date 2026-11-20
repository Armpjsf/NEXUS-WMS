'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  RefreshCw,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/errors';

interface AdjustmentItem {
  id: string;
  requestId: string;
  requestNo?: string;
  sku: string;
  productName?: string;
  itemName?: string;
  location: string;
  systemQty: number;
  countedQty: number;
  variance?: number;
  diffQty: number;
  unit?: string;
  reason: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string;
  requestedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export default function StockAdjustmentsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [adjustments, setAdjustments] = useState<AdjustmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedForReview, setSelectedForReview] = useState<AdjustmentItem | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Request Form State
  const [formData, setFormData] = useState({
    sku: '',
    itemName: '',
    location: '',
    systemQty: 0,
    countedQty: 0,
    unit: 'ชิ้น',
    reason: 'CYCLE_COUNT_DISCREPANCY',
    notes: ''
  });

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/adjustments');
      const data = await res.json();
      const rows = data.data || data.adjustments || [];
      if (Array.isArray(rows)) {
        const normalized: AdjustmentItem[] = rows.map((r: any) => {
          const requestNo = r.requestNo || r.request_no || r.requestId || r.id || '';
          const systemQty = Number(r.systemQty ?? r.system_qty ?? 0);
          const countedQty = Number(r.countedQty ?? r.counted_qty ?? 0);
          const variance = Number(
            r.variance ?? r.variance_qty ?? r.diffQty ?? r.diff_qty ?? countedQty - systemQty
          );
          const productName = r.productName || r.product_name || r.itemName || r.sku || '';
          return {
            id: requestNo || r.id,
            requestId: requestNo,
            requestNo,
            sku: r.sku || '',
            productName,
            itemName: productName,
            location: r.location || r.locationCode || r.location_code || 'Unassigned',
            systemQty,
            countedQty,
            variance,
            diffQty: variance,
            unit: r.unit || 'ชิ้น',
            reason: r.reason || r.reasonCode || r.reason_code || 'CYCLE_COUNT_DISCREPANCY',
            notes: r.notes || '',
            status: r.status === 'PENDING_APPROVAL' ? 'PENDING' : r.status || 'PENDING',
            requestedBy: r.requestedBy || r.requested_by || 'Operator',
            requestedByName: r.requestedByName || r.requested_by || r.requestedBy,
            approvedBy: r.approvedBy || r.approved_by,
            approvedByName: r.approvedByName || r.approved_by || r.approvedBy,
            rejectionReason: r.rejectionReason || r.rejection_reason,
            createdAt: r.createdAt || r.created_at || new Date().toISOString(),
            updatedAt: r.updatedAt || r.updated_at,
          };
        });
        setAdjustments(normalized);
      }
    } catch (e) {
      console.error('Failed to load adjustments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const newReq = formData;
    if (!newReq.sku || !newReq.location) {
      toast.error('กรุณากรอก SKU และ พิกัดตำแหน่ง');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: newReq.sku,
          productName: newReq.itemName || newReq.sku,
          locationCode: newReq.location,
          location: newReq.location,
          systemQty: Number(newReq.systemQty),
          countedQty: Number(newReq.countedQty),
          reasonCode: newReq.reason,
          reason: newReq.reason,
          notes: newReq.notes,
          requestedBy: session?.user?.name || session?.user?.email || 'Operator',
        })
      });
      const data = await res.json();
      if (data.success) {
        const created = data.data || data.adjustment || data.request || {};
        const reqNo = created.requestNo || created.request_no || created.requestId || created.id || '';
        toast.success(`ยื่นคำขอปรับยอดเรียบร้อย${reqNo ? ` เลขที่: ${reqNo}` : ''}`);
        setIsRequestModalOpen(false);
        setFormData({
          sku: '',
          itemName: '',
          location: '',
          systemQty: 0,
          countedQty: 0,
          unit: 'ชิ้น',
          reason: 'CYCLE_COUNT_DISCREPANCY',
          notes: ''
        });
        fetchAdjustments();
      } else {
        toast.error(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (err) {
      toast.error(`ล้มเหลว: ${errorMessage(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveReject = async (id: string, decision: 'APPROVED' | 'REJECTED' | 'APPROVE' | 'REJECT') => {
    setIsSubmitting(true);
    try {
      const action = decision === 'APPROVED' || decision === 'APPROVE' ? 'APPROVE' : 'REJECT';
      const res = await fetch('/api/adjustments/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: id,
          action,
          status: decision,
          approvedBy: session?.user?.name || session?.user?.email || 'Manager Admin',
          rejectionReason: action === 'REJECT' ? rejectReasonInput : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'APPROVE' ? 'อนุมัติการปรับปรุงสต็อกสำเร็จ ยอดสต็อกถูกอัปเดตแล้ว' : 'ปฏิเสธคำขอปรับปรุงสต็อกเรียบร้อย');
        setSelectedForReview(null);
        setRejectReasonInput('');
        fetchAdjustments();
      } else {
        toast.error(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (err) {
      toast.error(`ล้มเหลว: ${errorMessage(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = adjustments.filter(a => a.status === 'PENDING').length;
  const approvedCount = adjustments.filter(a => a.status === 'APPROVED').length;
  const rejectedCount = adjustments.filter(a => a.status === 'REJECTED').length;

  const filteredAdjustments = adjustments.filter(item => {
    if (activeTab !== 'ALL' && item.status !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.sku.toLowerCase().includes(q) ||
        item.requestId.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        (item.requestedByName || item.requestedBy).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'DAMAGED_EXPIRED': return 'สินค้าชำรุด / หมดอายุ';
      case 'LOST_STOLEN': return 'สูญหาย / หาไม่พบ';
      case 'CYCLE_COUNT_DISCREPANCY': return 'ตรวจนับรอบสต็อกคลาดเคลื่อน';
      case 'INSPECTION_ADJUSTMENT': return 'ปรับปรุงหลังตรวจสอบคุณภาพ (QA)';
      default: return reason;
    }
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 text-slate-900">
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">

        {/* Open Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Four-Eyes Principle &amp; ISO 9001 / 21 CFR Part 11 Governance
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <ShieldAlert className="w-7 h-7 text-amber-600 shrink-0" />
              <span>ศูนย์ขออนุมัติปรับยอดสต็อก (Maker-Checker Console)</span>
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm font-medium mt-0.5">
              ระบบตรวจสอบสิทธิ์ 2 ชั้น ป้องกันการทุจริตหรือแอบปรับลดยอดสต็อกโดยพลการ พร้อมเก็บบันทึกประวัติการตัดสินใจถาวร
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchAdjustments}
              className="p-2.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full border border-white/90 shadow-xs transition flex items-center gap-1.5 text-xs font-semibold"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-sm font-semibold transition flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>ยื่นคำขอปรับสต็อก (Maker)</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards (with 1 Hero Dark Accent Alert Card for Pending) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => setActiveTab('PENDING')}
            className={`nx-dark-accent-card p-5 transition cursor-pointer ${
              activeTab === 'PENDING' ? 'ring-2 ring-amber-400' : 'hover:ring-1 hover:ring-amber-400/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">รอหัวหน้าอนุมัติ (Pending)</span>
              <span className="p-2 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="text-3xl font-bold text-white mt-2 tabular-nums">{pendingCount.toLocaleString()}</div>
            <p className="text-[11px] text-slate-400 mt-1">ต้องการ Checker Review พิจารณา</p>
          </div>

          <div
            onClick={() => setActiveTab('APPROVED')}
            className={`nx-glass-card p-5 transition cursor-pointer ${
              activeTab === 'APPROVED' ? 'ring-2 ring-emerald-500' : 'hover:ring-1 hover:ring-emerald-400/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">อนุมัติเรียบร้อย (Approved)</span>
              <span className="p-2 bg-emerald-500/12 text-emerald-700 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{approvedCount.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-1">อัปเดตสต็อกจริงและลง Log แล้ว</p>
          </div>

          <div
            onClick={() => setActiveTab('REJECTED')}
            className={`nx-glass-card p-5 transition cursor-pointer ${
              activeTab === 'REJECTED' ? 'ring-2 ring-rose-500' : 'hover:ring-1 hover:ring-rose-400/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">ปฏิเสธคำขอ (Rejected)</span>
              <span className="p-2 bg-rose-500/12 text-rose-700 rounded-xl border border-rose-500/20">
                <XCircle className="w-4 h-4" />
              </span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{rejectedCount.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 mt-1">ไม่ผ่านเกณฑ์ / ข้อมูลไม่สอดคล้อง</p>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="nx-glass-card overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap tabular-nums ${
                  activeTab === 'PENDING' ? 'bg-amber-500 text-white shadow-xs' : 'bg-white/80 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                รออนุมัติ ({pendingCount})
              </button>
              <button
                onClick={() => setActiveTab('APPROVED')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap tabular-nums ${
                  activeTab === 'APPROVED' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white/80 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                อนุมัติแล้ว ({approvedCount})
              </button>
              <button
                onClick={() => setActiveTab('REJECTED')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap tabular-nums ${
                  activeTab === 'REJECTED' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white/80 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                ปฏิเสธ ({rejectedCount})
              </button>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap tabular-nums ${
                  activeTab === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white/80 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                ทั้งหมด ({adjustments.length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหา SKU, ใบคำขอ, ผู้ยื่น..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white/85 border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">กำลังโหลดรายการคำขอ...</div>
            ) : filteredAdjustments.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileCheck className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold">ไม่พบรายการคำขอปรับสต็อกในหมวดหมู่นี้</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/90 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-4">เลขที่คำขอ</th>
                    <th className="py-3.5 px-4">สินค้า &amp; พิกัด</th>
                    <th className="py-3.5 px-4 text-center">ยอดระบบ</th>
                    <th className="py-3.5 px-4 text-center">ยอดนับจริง</th>
                    <th className="py-3.5 px-4 text-center">ผลต่าง (Diff)</th>
                    <th className="py-3.5 px-4">เหตุผลในการปรับ</th>
                    <th className="py-3.5 px-4">ผู้ยื่น (Maker)</th>
                    <th className="py-3.5 px-4">สถานะ</th>
                    <th className="py-3.5 px-4 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdjustments.map((item) => (
                    <tr key={item.id} className="hover:bg-emerald-50/35 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-900">{item.requestId}</span>
                        <div className="text-[10px] text-slate-500 tabular-nums">{new Date(item.createdAt).toLocaleString('th-TH')}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{item.sku}</div>
                        <div className="text-[11px] text-sky-700 font-semibold font-mono">📍 {item.location}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-600 tabular-nums">
                        {item.systemQty.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900 tabular-nums">
                        {item.countedQty.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold tabular-nums">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border ${
                          item.diffQty < 0
                            ? 'bg-rose-500/12 text-rose-700 border-rose-500/20'
                            : item.diffQty > 0
                            ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {item.diffQty > 0 ? `+${item.diffQty}` : item.diffQty}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{getReasonLabel(item.reason)}</div>
                        {item.notes && <div className="text-[10px] text-slate-500 truncate max-w-xs">{item.notes}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-900 font-semibold">{item.requestedByName || item.requestedBy}</div>
                        <div className="text-[10px] text-slate-500">พนักงานคลัง</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/25">
                            <Clock className="w-3 h-3" /> รออนุมัติ
                          </span>
                        )}
                        {item.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/12 text-emerald-700 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> อนุมัติแล้ว
                          </span>
                        )}
                        {item.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/12 text-rose-700 border border-rose-500/20">
                            <XCircle className="w-3 h-3" /> ปฏิเสธ
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {item.status === 'PENDING' ? (
                          <button
                            onClick={() => {
                              setSelectedForReview(item);
                              setRejectReasonInput('');
                            }}
                            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-full text-xs font-semibold shadow-xs transition"
                          >
                            ตรวจสอบ (Checker)
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedForReview(item)}
                            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-full text-xs font-semibold transition border border-slate-200 shadow-xs"
                          >
                            ดูประวัติ
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* MODAL: Submit Request (Maker) */}
        {isRequestModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white bg-white/95 backdrop-blur-xl shadow-2xl p-6 text-xs text-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3.5 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">ยื่นคำขอปรับปรุงยอดสต็อก (Maker Request)</h3>
                  <p className="text-[11px] text-slate-500">ข้อมูลจะถูกส่งเข้าคิวรอหัวหน้างาน (Checker) พิจารณาอนุมัติ</p>
                </div>
                <button
                  onClick={() => setIsRequestModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateRequest} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1.5">รหัส SKU *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น SKU-PROD-001"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50/90 text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1.5">พิกัดตำแหน่ง (Location) *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น A-01-02-01"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50/90 text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">ยอดคงเหลือในระบบ</label>
                    <input
                      type="number"
                      value={formData.systemQty}
                      onChange={(e) => setFormData({ ...formData, systemQty: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold tabular-nums outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">ยอดนับจริง (Actual Count)</label>
                    <input
                      type="number"
                      value={formData.countedQty}
                      onChange={(e) => setFormData({ ...formData, countedQty: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sky-700 font-bold tabular-nums outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200 text-right">
                    <span className="text-slate-600 mr-2">ผลต่างที่จะปรับปรุง:</span>
                    <span className={`font-mono font-bold text-sm tabular-nums ${
                      formData.countedQty - formData.systemQty < 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {formData.countedQty - formData.systemQty > 0 ? `+${formData.countedQty - formData.systemQty}` : formData.countedQty - formData.systemQty}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1.5">สาเหตุในการขอปรับปรุง *</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50/90 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="CYCLE_COUNT_DISCREPANCY">ตรวจนับรอบสต็อกพบผลต่าง (Cycle Count Discrepancy)</option>
                    <option value="DAMAGED_EXPIRED">สินค้าชำรุดเสียหาย / เสื่อมสภาพ / หมดอายุ</option>
                    <option value="LOST_STOLEN">สินค้าสูญหาย / หาไม่พบในพื้นที่จัดเก็บ</option>
                    <option value="INSPECTION_ADJUSTMENT">ปรับปรุงยอดจากการตรวจสอบคุณภาพพิเศษ (QA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1.5">หมายเหตุ / รายละเอียดเพิ่มเติม</label>
                  <textarea
                    rows={2}
                    placeholder="ระบุสาเหตุที่ชัดเจนเพื่อประกอบการพิจารณา..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50/90 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 hover:text-slate-900 rounded-full font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-semibold shadow-xs"
                  >
                    {isSubmitting ? 'กำลังส่ง...' : 'ยืนยันส่งคำขอ (Submit)'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Review & Approve/Reject (Checker) */}
        {selectedForReview && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white bg-white/95 backdrop-blur-xl shadow-2xl p-6 text-xs text-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedForReview.status === 'PENDING' ? 'พิจารณาอนุมัติคำขอ (Checker Review)' : 'รายละเอียดประวัติคำขอ'}
                  </h3>
                  <p className="text-[11px] text-sky-700 font-mono font-semibold">คำขอเลขที่: {selectedForReview.requestId}</p>
                </div>
                <button
                  onClick={() => setSelectedForReview(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50/90 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">สินค้า SKU:</span>
                  <span className="text-sm font-bold text-slate-900">{selectedForReview.sku}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">พิกัดจัดเก็บ:</span>
                  <span className="text-sm font-bold text-sky-700 font-mono">📍 {selectedForReview.location}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">ยอดในระบบเดิม:</span>
                  <span className="text-base font-bold text-slate-600 tabular-nums">{selectedForReview.systemQty.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">ยอดนับจริงใหม่:</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">{selectedForReview.countedQty.toLocaleString()}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">ยอดส่วนต่างที่จะบันทึกบัญชี:</span>
                  <span className={`text-sm font-bold font-mono px-2.5 py-0.5 rounded-full tabular-nums border ${
                    selectedForReview.diffQty < 0
                      ? 'bg-rose-500/12 text-rose-700 border-rose-500/20'
                      : 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20'
                  }`}>
                    {selectedForReview.diffQty > 0 ? `+${selectedForReview.diffQty}` : selectedForReview.diffQty}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">ผู้ยื่นคำขอ (Maker):</span>
                  <span className="text-slate-900 font-bold">{selectedForReview.requestedByName || selectedForReview.requestedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">เหตุผล:</span>
                  <span className="text-slate-800 font-medium">{getReasonLabel(selectedForReview.reason)}</span>
                </div>
                {selectedForReview.notes && (
                  <div className="p-3 bg-slate-50 rounded-xl text-slate-700 border border-slate-200 text-[11px]">
                    <span className="text-slate-500 block text-[10px] font-semibold mb-0.5">บันทึกเหตุผล:</span>
                    {selectedForReview.notes}
                  </div>
                )}
                {selectedForReview.approvedBy && (
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-500">ผู้อนุมัติ/ตรวจสอบ:</span>
                    <span className="font-bold text-emerald-700">{selectedForReview.approvedByName || selectedForReview.approvedBy}</span>
                  </div>
                )}
                {selectedForReview.rejectionReason && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-700 text-[11px]">
                    <span className="font-bold block mb-0.5">เหตุผลที่ปฏิเสธ:</span>
                    {selectedForReview.rejectionReason}
                  </div>
                )}
              </div>

              {selectedForReview.status === 'PENDING' && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1.5">
                      ระบุเหตุผลกรณีปฏิเสธ (Reject Reason):
                    </label>
                    <input
                      type="text"
                      placeholder="ใส่เหตุผลหากต้องการปฏิเสธคำขอนี้..."
                      value={rejectReasonInput}
                      onChange={(e) => setRejectReasonInput(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50/90 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleApproveReject(selectedForReview.id, 'REJECTED')}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-semibold transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> ปฏิเสธ (Reject)
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleApproveReject(selectedForReview.id, 'APPROVED')}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" /> อนุมัติการปรับยอด (Approve)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
