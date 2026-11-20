'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Truck,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  RefreshCw,
  Phone,
  Star,
  X,
} from 'lucide-react';
import { errorMessage } from '@/lib/errors';

interface Carrier {
  id: string;
  code: string;
  name: string;
  trackingUrlTemplate: string;
  phone: string;
  contactName: string;
  isDefault: boolean;
  status: string;
}

const emptyForm: Partial<Carrier> = {
  code: '',
  name: '',
  trackingUrlTemplate: '',
  phone: '',
  contactName: '',
  isDefault: false,
  status: 'ACTIVE',
};

export default function AdminCarriersPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [formData, setFormData] = useState<Partial<Carrier>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/carriers', { cache: 'no-store' });
      const json = await res.json();
      setCarriers(json.carriers || []);
    } catch {
      toast.error('โหลดข้อมูลขนส่งไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingCarrier(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (c: Carrier) => {
    setEditingCarrier(c);
    setFormData(c);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error('กรุณากรอกชื่อผู้ให้บริการขนส่ง');
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingCarrier?.id);
      const url = '/api/carriers';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { id: editingCarrier!.id, ...formData } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');

      toast.success(isEdit ? 'อัปเดตผู้ให้บริการขนส่งเรียบร้อย' : 'เพิ่มผู้ให้บริการขนส่งเรียบร้อย');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Carrier) => {
    if (!confirm(`ยืนยันการลบขนส่ง "${c.name}"?`)) return;
    try {
      const res = await fetch(`/api/carriers?id=${c.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      toast.success('ลบขนส่งเรียบร้อย');
      load();
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative text-slate-900">
      <div className="max-w-[1100px] mx-auto space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> ตั้งค่าระบบ
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <Truck className="w-3 h-3 text-amber-600" />
                Logistics Network
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              ผู้ให้บริการขนส่ง (Carriers &amp; Logistics)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">จัดการรายชื่อขนส่ง, เทมเพลตลิงก์ติดตามพัสดุ และเบอร์ติดต่อศูนย์กระจายสินค้า</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={load}
              className="p-2.5 rounded-full border border-white/90 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 shadow-xs transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> เพิ่มขนส่ง
            </button>
          </div>
        </div>

        {/* Carriers List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {carriers.map((c) => (
            <div
              key={c.id}
              className="nx-glass-card p-5 hover:-translate-y-0.5 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                      {c.code}
                    </span>
                    {c.isDefault && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 border border-amber-500/25">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> ขนส่งหลัก
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded-full text-slate-500 hover:text-sky-700 hover:bg-sky-500/12 transition-colors"
                      title="แก้ไข"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="p-1.5 rounded-full text-slate-500 hover:text-rose-700 hover:bg-rose-500/12 transition-colors"
                      title="ลบ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-lg font-bold text-slate-900 mb-1">{c.name}</div>

                {c.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium mb-1.5 tabular-nums">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Call Center: {c.phone}
                  </div>
                )}

                {c.trackingUrlTemplate ? (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-0.5">Tracking Template</div>
                    <div className="font-mono text-[11px] text-sky-700 truncate">{c.trackingUrlTemplate}</div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-500 italic">ไม่มีลิงก์ Tracking อัตโนมัติ (จัดส่งเอง/ทั่วไป)</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-2xl overflow-hidden text-slate-900"
              >
                <div className="px-6 py-5 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="font-bold text-lg flex items-center gap-2.5 text-slate-900">
                    <span className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-700">
                      <Truck className="w-5 h-5" />
                    </span>
                    {editingCarrier ? 'แก้ไขผู้ให้บริการขนส่ง' : 'เพิ่มผู้ให้บริการขนส่ง'}
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">รหัสย่อขนส่ง</label>
                      <input
                        type="text"
                        placeholder="เช่น FLASH, KERRY"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-mono text-sm uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ชื่อผู้ให้บริการ *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น Flash Express"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-medium text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Tracking URL Template (ใช้ &#123;trackingNo&#125; แทนเลขพัสดุ)
                    </label>
                    <input
                      type="text"
                      placeholder="https://example.com/track?no={trackingNo}"
                      value={formData.trackingUrlTemplate || ''}
                      onChange={(e) => setFormData({ ...formData, trackingUrlTemplate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-mono text-xs"
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      ระบบจะแทนค่า &#123;trackingNo&#125; ด้วยเลขพัสดุจริงเพื่อเปิดหน้าเช็กสถานะได้ทันที
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">เบอร์ติดต่อ / Call Center</label>
                      <input
                        type="text"
                        placeholder="เช่น 1436"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-medium text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ผู้ติดต่อ / คนขับรถ</label>
                      <input
                        type="text"
                        placeholder="ชื่อผู้รับผิดชอบ"
                        value={formData.contactName || ''}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-medium text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={Boolean(formData.isDefault)}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <label htmlFor="isDefault" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      ตั้งเป็นขนส่งหลักเริ่มต้น (Default Carrier)
                    </label>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-5 py-2 rounded-full border border-slate-200/80 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all disabled:opacity-50"
                    >
                      {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
