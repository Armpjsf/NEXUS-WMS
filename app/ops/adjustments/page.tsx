'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  Filter,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Building2,
  FileCheck,
  Sparkles
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface AdjustmentItem {
  id: string;
  requestId: string;
  sku: string;
  itemName?: string;
  location: string;
  systemQty: number;
  countedQty: number;
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
      if (data.adjustments) {
        setAdjustments(data.adjustments);
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
    if (!formData.sku || !formData.location) {
      toast.error('กรุณากรอก SKU และ พิกัดตำแหน่ง');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: formData.sku,
          location: formData.location,
          systemQty: Number(formData.systemQty),
          countedQty: Number(formData.countedQty),
          reason: formData.reason,
          notes: formData.notes
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`ยื่นคำขอปรับยอดเรียบร้อย เลขที่: ${data.adjustment.requestId}`);
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
    } catch (err: any) {
      toast.error(`ล้มเหลว: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveReject = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/adjustments/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: id,
          status: decision,
          rejectionReason: decision === 'REJECTED' ? rejectReasonInput : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(decision === 'APPROVED' ? 'อนุมัติการปรับปรุงสต็อกสำเร็จ ยอดสต็อกถูกอัปเดตแล้ว' : 'ปฏิเสธคำขอปรับปรุงสต็อกเรียบร้อย');
        setSelectedForReview(null);
        setRejectReasonInput('');
        fetchAdjustments();
      } else {
        toast.error(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`ล้มเหลว: ${err.message}`);
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
    <div className="relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 font-mono text-[#dee2ec]">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">

        {/* Header Tactical Banner */}
        <div className="relative mx-auto flex flex-col gap-4 overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23]/90 p-5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#facc15] via-[#4cd7f6] to-[#57ec7f]" />
          <div className="relative z-10">
            <p className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#facc15] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#facc15]" />
              FOUR-EYES PRINCIPLE & ISO 9001 / 21 CFR PART 11 GOVERNANCE
            </p>
            <h1 className="font-headline text-2xl md:text-3xl font-black text-[#dee2ec] tracking-tight mb-1 flex items-center gap-3">
              <div className="bg-[#facc15] text-[#1b1600] p-2 rounded-lg shadow-md">
                <ShieldAlert className="w-6 h-6" />
              </div>
              ศูนย์ขออนุมัติปรับยอดสต็อก (Maker-Checker Console)
            </h1>
            <p className="text-[#8a92a6] font-mono text-xs">
              ระบบตรวจสอบสิทธิ์ 2 ชั้น ป้องกันการทุจริตหรือแอบปรับลดยอดสต็อกโดยพลการ พร้อมเก็บบันทึกประวัติการตัดสินใจถาวร
            </p>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={fetchAdjustments}
              className="p-2.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] rounded-xl border border-[#30353d] transition flex items-center gap-1.5 text-xs font-bold"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="px-4 py-2.5 bg-[#facc15] hover:bg-[#eab308] text-[#1b1600] rounded-xl shadow-lg shadow-[#facc15]/20 font-black transition flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              + ยื่นคำขอปรับสต็อก (Maker)
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div 
            onClick={() => setActiveTab('PENDING')}
            className={`p-4 rounded-xl border transition cursor-pointer backdrop-blur-md ${
              activeTab === 'PENDING' 
                ? 'bg-[#facc15]/10 border-[#facc15] ring-1 ring-[#facc15]' 
                : 'bg-[#171c23]/90 border-[#30353d] hover:border-[#facc15]/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#facc15]">รอหัวหน้าอนุมัติ (Pending)</span>
              <span className="p-1.5 bg-[#facc15]/20 text-[#facc15] rounded-lg">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="text-3xl font-black text-[#dee2ec] mt-2 font-mono">{pendingCount}</div>
            <p className="text-[11px] text-[#8a92a6] mt-1">ต้องการ Checker Review พิจารณา</p>
          </div>

          <div 
            onClick={() => setActiveTab('APPROVED')}
            className={`p-4 rounded-xl border transition cursor-pointer backdrop-blur-md ${
              activeTab === 'APPROVED' 
                ? 'bg-[#57ec7f]/10 border-[#57ec7f] ring-1 ring-[#57ec7f]' 
                : 'bg-[#171c23]/90 border-[#30353d] hover:border-[#57ec7f]/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#57ec7f]">อนุมัติเรียบร้อย (Approved)</span>
              <span className="p-1.5 bg-[#57ec7f]/20 text-[#57ec7f] rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="text-3xl font-black text-[#dee2ec] mt-2 font-mono">{approvedCount}</div>
            <p className="text-[11px] text-[#8a92a6] mt-1">อัปเดตสต็อกจริงและลง Log แล้ว</p>
          </div>

          <div 
            onClick={() => setActiveTab('REJECTED')}
            className={`p-4 rounded-xl border transition cursor-pointer backdrop-blur-md ${
              activeTab === 'REJECTED' 
                ? 'bg-[#ff5449]/10 border-[#ff5449] ring-1 ring-[#ff5449]' 
                : 'bg-[#171c23]/90 border-[#30353d] hover:border-[#ff5449]/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#ff5449]">ปฏิเสธคำขอ (Rejected)</span>
              <span className="p-1.5 bg-[#ff5449]/20 text-[#ff5449] rounded-lg">
                <XCircle className="w-4 h-4" />
              </span>
            </div>
            <div className="text-3xl font-black text-[#dee2ec] mt-2 font-mono">{rejectedCount}</div>
            <p className="text-[11px] text-[#8a92a6] mt-1">ไม่ผ่านเกณฑ์ / ข้อมูลไม่สอดคล้อง</p>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="bg-[#171c23]/90 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-[#30353d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'PENDING' ? 'bg-[#facc15] text-[#1b1600]' : 'bg-[#12161d] text-[#8a92a6] hover:text-white border border-[#30353d]'
                }`}
              >
                รออนุมัติ ({pendingCount})
              </button>
              <button
                onClick={() => setActiveTab('APPROVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'APPROVED' ? 'bg-[#57ec7f] text-[#0a2012]' : 'bg-[#12161d] text-[#8a92a6] hover:text-white border border-[#30353d]'
                }`}
              >
                อนุมัติแล้ว ({approvedCount})
              </button>
              <button
                onClick={() => setActiveTab('REJECTED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'REJECTED' ? 'bg-[#ff5449] text-white' : 'bg-[#12161d] text-[#8a92a6] hover:text-white border border-[#30353d]'
                }`}
              >
                ปฏิเสธ ({rejectedCount})
              </button>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'ALL' ? 'bg-[#4cd7f6] text-[#042027]' : 'bg-[#12161d] text-[#8a92a6] hover:text-white border border-[#30353d]'
                }`}
              >
                ทั้งหมด ({adjustments.length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a92a6]" />
              <input
                type="text"
                placeholder="ค้นหา SKU, ใบคำขอ, ผู้ยื่น..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#12161d] border border-[#30353d] rounded-lg text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-[#8a92a6] text-xs">กำลังโหลดรายการคำขอ...</div>
            ) : filteredAdjustments.length === 0 ? (
              <div className="p-12 text-center text-[#8a92a6]">
                <FileCheck className="w-12 h-12 mx-auto text-[#30353d] mb-2" />
                <p className="text-xs font-bold">ไม่พบรายการคำขอปรับสต็อกในหมวดหมู่นี้</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#12161d] text-[#8a92a6] font-bold uppercase tracking-wider border-b border-[#30353d]">
                  <tr>
                    <th className="py-3 px-4">เลขที่คำขอ</th>
                    <th className="py-3 px-4">สินค้า & พิกัด</th>
                    <th className="py-3 px-4 text-center">ยอดระบบ</th>
                    <th className="py-3 px-4 text-center">ยอดนับจริง</th>
                    <th className="py-3 px-4 text-center">ผลต่าง (Diff)</th>
                    <th className="py-3 px-4">เหตุผลในการปรับ</th>
                    <th className="py-3 px-4">ผู้ยื่น (Maker)</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262c36]">
                  {filteredAdjustments.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-[#dee2ec]">{item.requestId}</span>
                        <div className="text-[10px] text-[#8a92a6]">{new Date(item.createdAt).toLocaleString('th-TH')}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#dee2ec]">{item.sku}</div>
                        <div className="text-[11px] text-[#4cd7f6] font-bold">📍 {item.location}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[#8a92a6]">
                        {item.systemQty}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-[#dee2ec]">
                        {item.countedQty}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          item.diffQty < 0 ? 'bg-[#ff5449]/20 text-[#ffb4ab]' : item.diffQty > 0 ? 'bg-[#57ec7f]/20 text-[#57ec7f]' : 'bg-[#252a32] text-[#8a92a6]'
                        }`}>
                          {item.diffQty > 0 ? `+${item.diffQty}` : item.diffQty}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[#dee2ec]">{getReasonLabel(item.reason)}</div>
                        {item.notes && <div className="text-[10px] text-[#8a92a6] truncate max-w-xs">{item.notes}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[#dee2ec] font-bold">{item.requestedByName || item.requestedBy}</div>
                        <div className="text-[10px] text-[#8a92a6]">พนักงานคลัง</div>
                      </td>
                      <td className="py-3 px-4">
                        {item.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#facc15]/20 text-[#facc15] border border-[#facc15]/30">
                            <Clock className="w-3 h-3" /> รออนุมัติ
                          </span>
                        )}
                        {item.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#57ec7f]/20 text-[#57ec7f] border border-[#57ec7f]/30">
                            <CheckCircle2 className="w-3 h-3" /> อนุมัติแล้ว
                          </span>
                        )}
                        {item.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ff5449]/20 text-[#ffb4ab] border border-[#ff5449]/30">
                            <XCircle className="w-3 h-3" /> ปฏิเสธ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.status === 'PENDING' ? (
                          <button
                            onClick={() => {
                              setSelectedForReview(item);
                              setRejectReasonInput('');
                            }}
                            className="px-3 py-1.5 bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#042027] rounded-lg text-xs font-black shadow transition"
                          >
                            ตรวจสอบ (Checker)
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedForReview(item)}
                            className="px-3 py-1.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] rounded-lg text-xs font-bold transition border border-[#30353d]"
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
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-2xl p-6 text-xs font-mono text-[#dee2ec]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
              <div className="flex items-center justify-between border-b border-[#30353d] pb-3 mb-4">
                <div>
                  <h3 className="text-base font-black text-[#dee2ec]">ยื่นคำขอปรับปรุงยอดสต็อก (Maker Request)</h3>
                  <p className="text-[11px] text-[#8a92a6]">ข้อมูลจะถูกส่งเข้าคิวรอหัวหน้างาน (Checker) พิจารณาอนุมัติ</p>
                </div>
                <button 
                  onClick={() => setIsRequestModalOpen(false)}
                  className="text-[#8a92a6] hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateRequest} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">รหัส SKU *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น SKU-PROD-001"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">พิกัดตำแหน่ง (Location) *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น A-01-02-01"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-[#12161d] p-3 rounded-xl border border-[#30353d]">
                  <div>
                    <label className="block text-[#8a92a6] mb-1">ยอดคงเหลือในระบบ</label>
                    <input
                      type="number"
                      value={formData.systemQty}
                      onChange={(e) => setFormData({ ...formData, systemQty: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#1c222b] text-[#dee2ec] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] mb-1">ยอดนับจริง (Actual Count)</label>
                    <input
                      type="number"
                      value={formData.countedQty}
                      onChange={(e) => setFormData({ ...formData, countedQty: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#1c222b] text-[#4cd7f6] font-bold"
                    />
                  </div>
                  <div className="col-span-2 pt-2 border-t border-[#262c36] text-right">
                    <span className="text-[#8a92a6] mr-2">ผลต่างที่จะปรับปรุง:</span>
                    <span className={`font-mono font-black text-sm ${
                      formData.countedQty - formData.systemQty < 0 ? 'text-[#ff5449]' : 'text-[#57ec7f]'
                    }`}>
                      {formData.countedQty - formData.systemQty > 0 ? `+${formData.countedQty - formData.systemQty}` : formData.countedQty - formData.systemQty}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[#8a92a6] font-bold mb-1">สาเหตุในการขอปรับปรุง *</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6]"
                  >
                    <option value="CYCLE_COUNT_DISCREPANCY">ตรวจนับรอบสต็อกพบผลต่าง (Cycle Count Discrepancy)</option>
                    <option value="DAMAGED_EXPIRED">สินค้าชำรุดเสียหาย / เสื่อมสภาพ / หมดอายุ</option>
                    <option value="LOST_STOLEN">สินค้าสูญหาย / หาไม่พบในพื้นที่จัดเก็บ</option>
                    <option value="INSPECTION_ADJUSTMENT">ปรับปรุงยอดจากการตรวจสอบคุณภาพพิเศษ (QA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#8a92a6] font-bold mb-1">หมายเหตุ / รายละเอียดเพิ่มเติม</label>
                  <textarea
                    rows={2}
                    placeholder="ระบุสาเหตุที่ชัดเจนเพื่อประกอบการพิจารณา..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6]"
                  />
                </div>

                <div className="pt-3 border-t border-[#30353d] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(false)}
                    className="px-4 py-2 bg-[#252a32] text-[#8a92a6] hover:text-white rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#facc15] hover:bg-[#eab308] text-[#1b1600] rounded-xl font-black shadow"
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
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-2xl p-6 text-xs font-mono text-[#dee2ec] space-y-4">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
              <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
                <div>
                  <h3 className="text-base font-black text-[#dee2ec]">
                    {selectedForReview.status === 'PENDING' ? 'พิจารณาอนุมัติคำขอ (Checker Review)' : 'รายละเอียดประวัติคำขอ'}
                  </h3>
                  <p className="text-[11px] text-[#4cd7f6]">คำขอเลขที่: {selectedForReview.requestId}</p>
                </div>
                <button 
                  onClick={() => setSelectedForReview(null)}
                  className="text-[#8a92a6] hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#12161d] p-4 rounded-xl border border-[#30353d]">
                <div>
                  <span className="text-[#8a92a6] block text-[10px]">สินค้า SKU:</span>
                  <span className="text-sm font-bold text-[#dee2ec]">{selectedForReview.sku}</span>
                </div>
                <div>
                  <span className="text-[#8a92a6] block text-[10px]">พิกัดจัดเก็บ:</span>
                  <span className="text-sm font-bold text-[#4cd7f6]">📍 {selectedForReview.location}</span>
                </div>
                <div>
                  <span className="text-[#8a92a6] block text-[10px]">ยอดในระบบเดิม:</span>
                  <span className="text-base font-bold text-[#8a92a6]">{selectedForReview.systemQty}</span>
                </div>
                <div>
                  <span className="text-[#8a92a6] block text-[10px]">ยอดนับจริงใหม่:</span>
                  <span className="text-base font-bold text-[#dee2ec]">{selectedForReview.countedQty}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-[#262c36] flex justify-between items-center">
                  <span className="text-[#8a92a6]">ยอดส่วนต่างที่จะบันทึกบัญชี:</span>
                  <span className={`text-base font-black px-2 py-0.5 rounded ${
                    selectedForReview.diffQty < 0 ? 'bg-[#ff5449]/20 text-[#ffb4ab]' : 'bg-[#57ec7f]/20 text-[#57ec7f]'
                  }`}>
                    {selectedForReview.diffQty > 0 ? `+${selectedForReview.diffQty}` : selectedForReview.diffQty}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8a92a6]">ผู้ยื่นคำขอ (Maker):</span>
                  <span className="text-[#dee2ec] font-bold">{selectedForReview.requestedByName || selectedForReview.requestedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8a92a6]">เหตุผล:</span>
                  <span className="text-[#dee2ec]">{getReasonLabel(selectedForReview.reason)}</span>
                </div>
                {selectedForReview.notes && (
                  <div className="p-3 bg-[#12161d] rounded-xl text-[#dee2ec] border border-[#30353d] text-[11px]">
                    <span className="text-[#8a92a6] block text-[10px] mb-0.5">บันทึกเหตุผล:</span>
                    {selectedForReview.notes}
                  </div>
                )}
                {selectedForReview.approvedBy && (
                  <div className="flex justify-between pt-2 border-t border-[#30353d]">
                    <span className="text-[#8a92a6]">ผู้อนุมัติ/ตรวจสอบ:</span>
                    <span className="font-bold text-[#57ec7f]">{selectedForReview.approvedByName || selectedForReview.approvedBy}</span>
                  </div>
                )}
                {selectedForReview.rejectionReason && (
                  <div className="p-3 bg-[#ff5449]/10 border border-[#ff5449]/30 rounded-xl text-[#ffb4ab] text-[11px]">
                    <span className="font-bold block mb-0.5">เหตุผลที่ปฏิเสธ:</span>
                    {selectedForReview.rejectionReason}
                  </div>
                )}
              </div>

              {selectedForReview.status === 'PENDING' && (
                <div className="space-y-3 pt-3 border-t border-[#30353d]">
                  <div>
                    <label className="block text-[#8a92a6] mb-1">
                      ระบุเหตุผลกรณีปฏิเสธ (Reject Reason):
                    </label>
                    <input
                      type="text"
                      placeholder="ใส่เหตุผลหากต้องการปฏิเสธคำขอนี้..."
                      value={rejectReasonInput}
                      onChange={(e) => setRejectReasonInput(e.target.value)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] text-xs"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleApproveReject(selectedForReview.id, 'REJECTED')}
                      className="px-4 py-2 bg-[#ff5449] hover:bg-[#e0382e] text-white rounded-xl font-bold transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> ปฏิเสธ (Reject)
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleApproveReject(selectedForReview.id, 'APPROVED')}
                      className="px-5 py-2 bg-[#57ec7f] hover:bg-[#43d469] text-[#0a2012] rounded-xl font-black transition flex items-center gap-1.5 shadow"
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
