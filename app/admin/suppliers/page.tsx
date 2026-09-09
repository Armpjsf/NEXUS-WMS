'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Building2, Plus, Search, Trash2, Edit2, ArrowLeft, RefreshCw,
  Phone, Mail, MapPin, CheckCircle2, X, FileText
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

interface Supplier {
  id: string;
  code: string;
  name: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  contactPerson: string;
  notes: string;
  status: string;
}

const emptyForm: Partial<Supplier> = {
  code: '',
  name: '',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  contactPerson: '',
  notes: '',
  status: 'ACTIVE',
};

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Partial<Supplier>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/suppliers${q}`, { cache: 'no-store' });
      const json = await res.json();
      setSuppliers(json.suppliers || []);
    } catch {
      toast.error('โหลดข้อมูลผู้จำหน่ายไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingSupplier(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData(s);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error('กรุณากรอกชื่อผู้จำหน่าย');
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingSupplier?.id);
      const url = '/api/suppliers';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { id: editingSupplier!.id, ...formData } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');

      toast.success(isEdit ? 'อัปเดตผู้จำหน่ายเรียบร้อย' : 'เพิ่มผู้จำหน่ายเรียบร้อย');
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`ยืนยันการลบผู้จำหน่าย "${s.name}"?`)) return;
    try {
      const res = await fetch(`/api/suppliers?id=${s.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      toast.success('ลบผู้จำหน่ายเรียบร้อย');
      load();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="relative z-10 max-w-[1200px] mx-auto space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> ตั้งค่าระบบ
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-500/25">
                <Building2 className="w-6 h-6" />
              </span>
              ผู้จำหน่ายสินค้า (Supplier Master)
            </h1>
            <p className="text-slate-500 font-medium mt-1">ทะเบียนซัพพลายเออร์, ผู้ผลิต, และผู้จัดจำหน่ายสำหรับเชื่อมต่อการเปิด PO และรับของ (GRN)</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="p-2.5 rounded-xl border border-slate-200 bg-white/80 hover:bg-white text-slate-600 shadow-sm transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold shadow-lg shadow-teal-500/25 hover:from-teal-700 hover:to-emerald-700 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" /> เพิ่มผู้จำหน่าย
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้จำหน่าย, รหัส, เบอร์โทร, หรือผู้ติดต่อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
          />
        </div>

        {/* Table */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-3.5 px-4">รหัส / ผู้จำหน่าย</th>
                  <th className="py-3.5 px-4">ผู้ติดต่อ / เบอร์โทร</th>
                  <th className="py-3.5 px-4">ที่อยู่บริษัท</th>
                  <th className="py-3.5 px-4">หมายเหตุ</th>
                  <th className="py-3.5 px-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      {loading ? 'กำลังโหลด...' : 'ยังไม่มีข้อมูลผู้จำหน่าย — กดปุ่ม "เพิ่มผู้จำหน่าย" เพื่อเริ่มต้น'}
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-bold text-teal-600">{s.code}</div>
                        <div className="font-bold text-slate-800 text-sm">{s.name}</div>
                        {s.taxId && <div className="text-[11px] text-slate-400">Tax: {s.taxId}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-700">{s.contactPerson || '-'}</div>
                        {s.phone && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone className="w-3 h-3 text-slate-400" /> {s.phone}
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 truncate max-w-[180px]">
                            <Mail className="w-3 h-3 text-slate-400" /> {s.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="text-xs text-slate-600 line-clamp-2">{s.address || '-'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-slate-500">{s.notes || '-'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                            title="แก้ไข"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8"
              >
                <div className="px-6 py-5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex items-center justify-between">
                  <div className="font-black text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {editingSupplier ? 'แก้ไขข้อมูลผู้จำหน่าย' : 'เพิ่มผู้จำหน่ายใหม่'}
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">รหัสผู้จำหน่าย</label>
                      <input
                        type="text"
                        placeholder="เช่น SUPP-001 (เว้นว่างเพื่อ auto)"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-mono text-sm uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ชื่อผู้จำหน่าย / บริษัท *</label>
                      <input
                        type="text"
                        required
                        placeholder="ชื่อบริษัทผู้จำหน่าย"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-medium text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">เลขผู้เสียภาษี</label>
                      <input
                        type="text"
                        placeholder="13 หลัก"
                        value={formData.taxId || ''}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ชื่อผู้ติดต่อ</label>
                      <input
                        type="text"
                        placeholder="เซลล์ / ผู้ประสานงาน"
                        value={formData.contactPerson || ''}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-medium text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">เบอร์โทรศัพท์</label>
                      <input
                        type="text"
                        placeholder="02-xxx-xxxx / 08x-xxx-xxxx"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-medium text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">อีเมล</label>
                      <input
                        type="email"
                        placeholder="supplier@email.com"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-medium text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ที่อยู่บริษัท</label>
                    <textarea
                      rows={2}
                      placeholder="ที่อยู่ติดต่อ / โรงงานผู้ผลิต..."
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-medium text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">หมายเหตุ</label>
                    <input
                      type="text"
                      placeholder="เช่น เงื่อนไขการสั่งซื้อขั้นต่ำ, ระยะเวลาส่งมอบ"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-medium text-sm"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold shadow-lg shadow-teal-500/25 hover:from-teal-700 hover:to-emerald-700 active:scale-95 transition-all disabled:opacity-50"
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
