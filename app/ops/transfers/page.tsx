'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Truck,
  CheckCircle2,
  Search,
  Calendar,
  ChevronRight,
  X,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { StockTransfer, TransferStatus, TransferLine } from '@/lib/data/transfers';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errors';

const BRANCH_NAMES: Record<string, string> = {
  hq: 'สำนักงานใหญ่ (HQ คลังกลาง)',
  'branch-urt': 'สาขาสุราษฎร์ธานี (URT)',
  'branch-skn': 'สาขาสมุทรสาคร (SKN)',
  'branch-cmi': 'สาขาเชียงใหม่ (CMI)',
  'branch-kkc': 'สาขาขอนแก่น (KKC)',
};

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | TransferStatus>('ALL');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transfers');
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.transfers || []);
      }
    } catch (err) {
      console.error('Failed to load transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: TransferStatus) => {
    try {
      const res = await fetch('/api/transfers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setTransfers(prev =>
          prev.map(t => (t.id === id ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const filtered = transfers.filter(t => {
    const matchTab = activeTab === 'ALL' || t.status === activeTab;
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      t.transferNo.toLowerCase().includes(q) ||
      (t.notes && t.notes.toLowerCase().includes(q)) ||
      t.items.some(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    return matchTab && matchSearch;
  });

  const stats = {
    total: transfers.length,
    draft: transfers.filter(t => t.status === 'DRAFT').length,
    inTransit: transfers.filter(t => t.status === 'IN_TRANSIT').length,
    completed: transfers.filter(t => t.status === 'COMPLETED').length,
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1500px] mx-auto space-y-6">
        {/* Open Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Inter-Branch Logistics
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <ArrowLeftRight className="w-7 h-7 text-emerald-600 shrink-0" />
              <span>โอนสต็อกข้ามสาขา (Branch Transfer)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
              จัดการใบโอนย้ายสินค้าระหว่างคลัง/สาขา ตัดจ่ายและรับเข้าสต็อกอัตโนมัติ
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchTransfers}
              disabled={loading}
              className="p-2.5 rounded-full border border-white/90 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 shadow-xs transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-emerald-600")} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold text-xs shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างใบโอนสต็อก</span>
            </button>
          </div>
        </div>

        {/* Stats Cards (1 Hero Dark Accent Card for In Transit) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="nx-glass-card p-5">
            <div className="text-xs text-slate-600 font-semibold uppercase tracking-wider">ทั้งหมด</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">
              {stats.total.toLocaleString()} <span className="text-xs font-medium text-slate-500">ใบ</span>
            </div>
          </div>
          <div className="nx-glass-card p-5">
            <div className="text-xs text-amber-700 font-semibold uppercase tracking-wider">รอดำเนินการ (Draft)</div>
            <div className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1 tabular-nums">
              {stats.draft.toLocaleString()} <span className="text-xs font-medium text-slate-500">ใบ</span>
            </div>
          </div>
          <div className="nx-dark-accent-card p-5">
            <div className="text-xs text-sky-300 font-semibold uppercase tracking-wider">ระหว่างขนส่ง (In Transit)</div>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-1 tabular-nums">
              {stats.inTransit.toLocaleString()} <span className="text-xs font-medium text-slate-400">ใบ</span>
            </div>
          </div>
          <div className="nx-glass-card p-5">
            <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">รับเข้าสำเร็จ</div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-700 mt-1 tabular-nums">
              {stats.completed.toLocaleString()} <span className="text-xs font-medium text-slate-500">ใบ</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-white/70 backdrop-blur-md border border-white/80 rounded-full overflow-x-auto w-full sm:w-auto shadow-xs">
            {(['ALL', 'DRAFT', 'IN_TRANSIT', 'COMPLETED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
                  activeTab === tab
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab === 'ALL' && 'ทั้งหมด'}
                {tab === 'DRAFT' && 'ฉบับร่าง (Draft)'}
                {tab === 'IN_TRANSIT' && 'ระหว่างขนส่ง'}
                {tab === 'COMPLETED' && 'สำเร็จแล้ว'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่โอน, สาขา, สินค้า..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-white/85 border border-white/90 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium shadow-xs"
            />
          </div>
        </div>

        {/* Transfers List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="nx-glass-card p-12 text-center">
              <ArrowLeftRight className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-700">ไม่พบรายการใบโอนสต็อก</div>
              <p className="text-xs text-slate-500 mt-0.5">กดปุ่ม &quot;สร้างใบโอนสต็อก&quot; เพื่อเริ่มย้ายสินค้าระหว่างสาขา</p>
            </div>
          ) : (
            filtered.map(t => (
              <div
                key={t.id}
                className="nx-glass-card p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {t.transferNo}
                      </span>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                          t.status === 'DRAFT' && "bg-amber-500/15 text-amber-800 border-amber-500/25",
                          t.status === 'IN_TRANSIT' && "bg-sky-500/12 text-sky-700 border-sky-500/25",
                          t.status === 'COMPLETED' && "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
                          t.status === 'CANCELLED' && "bg-rose-500/12 text-rose-700 border-rose-500/20"
                        )}
                      >
                        {t.status === 'DRAFT' && 'ฉบับร่าง'}
                        {t.status === 'IN_TRANSIT' && '🚚 อยู่ระหว่างขนส่ง'}
                        {t.status === 'COMPLETED' && '✅ รับเข้าสำเร็จ'}
                        {t.status === 'CANCELLED' && 'ยกเลิก'}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(t.createdAt).toLocaleDateString('th-TH')}
                      </span>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200/80">
                        {BRANCH_NAMES[t.fromBranchId] || t.fromBranchId}
                      </span>
                      <ChevronRight className="w-4 h-4 text-emerald-600" />
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-800 border border-emerald-500/20">
                        {BRANCH_NAMES[t.toBranchId] || t.toBranchId}
                      </span>
                    </div>

                    {/* Items summary */}
                    <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 tabular-nums">
                        รวม {t.totalQty.toLocaleString()} ชิ้น ({t.items.length} SKU):
                      </span>
                      {t.items.map((it, idx) => (
                        <span key={idx} className="bg-slate-50 px-2.5 py-0.5 rounded-full text-slate-700 border border-slate-200/80 tabular-nums">
                          {it.name} x{it.qty} {it.unit || 'ชิ้น'}
                        </span>
                      ))}
                    </div>

                    {t.notes && (
                      <div className="text-[11px] text-slate-500 italic">
                        หมายเหตุ: {t.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {t.status === 'DRAFT' && (
                      <button
                        onClick={() => handleUpdateStatus(t.id, 'IN_TRANSIT')}
                        className="px-4 py-2 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>ตัดจ่าย &amp; เริ่มส่ง (Dispatch)</span>
                      </button>
                    )}

                    {t.status === 'IN_TRANSIT' && (
                      <button
                        onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                        className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ตรวจรับเข้าคลังปลายทาง</span>
                      </button>
                    )}

                    <button
                      onClick={() => window.print()}
                      className="p-2 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
                      title="พิมพ์ใบโอนสต็อก"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Transfer Modal */}
      {showCreateModal && (
        <CreateTransferModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchTransfers();
          }}
        />
      )}
    </div>
  );
}

function CreateTransferModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fromBranch, setFromBranch] = useState('hq');
  const [toBranch, setToBranch] = useState('branch-urt');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([
    { sku: '', name: '', qty: 1, unit: 'ชิ้น' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addLine = () => {
    setLines(prev => [...prev, { sku: '', name: '', qty: 1, unit: 'ชิ้น' }]);
  };

  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof TransferLine, val: any) => {
    setLines(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromBranch === toBranch) {
      alert('สาขาต้นทางและปลายทางต้องไม่ซ้ำกัน');
      return;
    }
    const validLines = lines.filter(l => l.name.trim() && l.qty > 0);
    if (validLines.length === 0) {
      alert('กรุณากรอกรายการสินค้าและจำนวน');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromBranchId: fromBranch,
          toBranchId: toBranch,
          items: validLines,
          notes,
        }),
      });
      if (res.ok) {
        onCreated();
      } else {
        const d = await res.json();
        alert(d.error || 'สร้างใบโอนสต็อกไม่สำเร็จ');
      }
    } catch (err) {
      alert(errorMessage(err) || 'Error creating transfer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900">
        <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold flex items-center gap-2 text-slate-900">
            <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
            <span>สร้างใบโอนย้ายสต็อกสินค้า</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">สาขาต้นทาง (จ่ายออก) *</label>
              <select
                value={fromBranch}
                onChange={e => setFromBranch(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50/90 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
              >
                {Object.entries(BRANCH_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">สาขาปลายทาง (รับเข้า) *</label>
              <select
                value={toBranch}
                onChange={e => setToBranch(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50/90 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
              >
                {Object.entries(BRANCH_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-600">รายการสินค้าที่จะโอนย้าย *</label>
              <button
                type="button"
                onClick={addLine}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                + เพิ่มรายการ
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {lines.map((l, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50/90 p-2 rounded-xl border border-slate-200">
                  <input
                    type="text"
                    placeholder="SKU"
                    value={l.sku}
                    onChange={e => updateLine(idx, 'sku', e.target.value)}
                    className="w-24 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-900 outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="ชื่อสินค้า..."
                    value={l.name}
                    onChange={e => updateLine(idx, 'name', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-900 outline-none focus:border-emerald-500"
                    required
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="จำนวน"
                    value={l.qty}
                    onChange={e => updateLine(idx, 'qty', Number(e.target.value))}
                    className="w-20 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-bold text-right text-slate-900 tabular-nums outline-none focus:border-emerald-500"
                    required
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">หมายเหตุ / เหตุผลการโอน</label>
            <input
              type="text"
              placeholder="เช่น เติมสต็อกสาขาหน้าร้านประจำสัปดาห์"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-xs disabled:bg-slate-300 transition-all"
            >
              {submitting ? 'กำลังบันทึก...' : 'บันทึกใบโอนสต็อก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
