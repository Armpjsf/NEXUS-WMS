'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, Trash2, Edit2, ArrowLeft, RefreshCw,
  Phone, Mail, MapPin, Truck, Building, FileText, CheckCircle2, X, Power
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

interface Customer {
  id: string;
  code: string;
  name: string;
  taxId: string;
  branchNumber: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  defaultCarrier: string;
  contactPerson: string;
  paymentTerm: string;
  notes: string;
  status: string;
}

const emptyForm: Partial<Customer> = {
  code: '',
  name: '',
  taxId: '',
  branchNumber: '00000',
  phone: '',
  email: '',
  address: '',
  postalCode: '',
  defaultCarrier: '',
  contactPerson: '',
  paymentTerm: 'CASH',
  notes: '',
  status: 'ACTIVE',
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/customers${q}`, { cache: 'no-store' });
      const json = await res.json();
      setCustomers(json.customers || []);
    } catch {
      toast.error('โหลดข้อมูลลูกค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData(c);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error('กรุณากรอกชื่อลูกค้า');
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingCustomer?.id);
      const url = '/api/customers';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { id: editingCustomer!.id, ...formData } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');

      toast.success(isEdit ? 'อัปเดตข้อมูลลูกค้าเรียบร้อย' : 'เพิ่มลูกค้าใหม่เรียบร้อย');
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`ยืนยันการลบลูกค้า "${c.name}"?`)) return;
    try {
      const res = await fetch(`/api/customers?id=${c.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      toast.success('ลบข้อมูลลูกค้าเรียบร้อย');
      load();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  // Soft-delete: flip ACTIVE <-> INACTIVE. Use this for customers that already
  // have orders (hard delete is blocked by the FK).
  const toggleStatus = async (c: Customer) => {
    const next = c.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'อัปเดตสถานะไม่สำเร็จ');
      toast.success(next === 'INACTIVE' ? 'ปิดใช้งานลูกค้าแล้ว' : 'เปิดใช้งานลูกค้าแล้ว');
      load();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="relative z-10 max-w-[1200px] mx-auto space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[#d1c6ab] hover:text-[#facc15]">
          <ArrowLeft className="w-4 h-4" /> ตั้งค่าระบบ
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#dee2ec] flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25">
                <Users className="w-6 h-6" />
              </span>
              จัดการลูกค้า (Customer Master)
            </h1>
            <p className="text-[#d1c6ab] font-medium mt-1">ทะเบียนลูกค้า, ที่อยู่ส่งของ, ขนส่งประจำ และเงื่อนไขการชำระเงิน</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="p-2.5 rounded-xl border border-[#30353d] bg-[#171c23] hover:bg-[#171c23] text-[#d1c6ab] shadow-sm transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-cyan-700 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" /> เพิ่มลูกค้า
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#8a92a6]" />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, รหัส, เบอร์โทร, หรือผู้ติดต่อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#171c23] backdrop-blur-md rounded-2xl border border-[#30353d] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-[#dee2ec]"
          />
        </div>

        {/* Customers Table */}
        <div className="bg-[#171c23] backdrop-blur-md rounded-2xl border border-[#30353d] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#30353d] bg-[#1b2027]/50 text-[11px] uppercase font-bold text-[#8a92a6] tracking-wider">
                  <th className="py-3.5 px-4">รหัส / ลูกค้า</th>
                  <th className="py-3.5 px-4">ติดต่อ / เบอร์โทร</th>
                  <th className="py-3.5 px-4">ที่อยู่จัดส่ง</th>
                  <th className="py-3.5 px-4">ขนส่งประจำ</th>
                  <th className="py-3.5 px-4">เครดิต</th>
                  <th className="py-3.5 px-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30353d]">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#8a92a6] font-medium">
                      {loading ? 'กำลังโหลด...' : 'ยังไม่มีข้อมูลลูกค้า — กดปุ่ม "เพิ่มลูกค้า" เพื่อเริ่มต้น'}
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className={`hover:bg-[#1b2027]/80 transition-colors ${c.status === 'INACTIVE' ? 'opacity-50' : ''}`}>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-bold text-blue-600">{c.code}</div>
                        <div className="font-bold text-[#dee2ec] text-sm flex items-center gap-2">
                          {c.name}
                          {c.status === 'INACTIVE' && <span className="text-[10px] font-bold bg-[#30353d] text-[#8a92a6] px-1.5 py-0.5 rounded">ปิดใช้งาน</span>}
                        </div>
                        {c.taxId && <div className="text-[11px] text-[#8a92a6]">Tax: {c.taxId}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#d1c6ab]">{c.contactPerson || '-'}</div>
                        {c.phone && (
                          <div className="flex items-center gap-1 text-xs text-[#8a92a6]">
                            <Phone className="w-3 h-3 text-[#8a92a6]" /> {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1 text-xs text-[#8a92a6] truncate max-w-[180px]">
                            <Mail className="w-3 h-3 text-[#8a92a6]" /> {c.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-[240px]">
                        <div className="text-xs text-[#d1c6ab] line-clamp-2">{c.address || '-'}</div>
                        {c.postalCode && <span className="inline-block mt-0.5 text-[10px] font-mono bg-[#252a32] text-[#d1c6ab] px-1.5 py-0.5 rounded">{c.postalCode}</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {c.defaultCarrier ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/30">
                            <Truck className="w-3 h-3" /> {c.defaultCarrier}
                          </span>
                        ) : (
                          <span className="text-xs text-[#8a92a6]">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-[#252a32] text-[#d1c6ab]">
                          {c.paymentTerm}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg text-[#8a92a6] hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                            title="แก้ไข"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStatus(c)}
                            className={`p-1.5 rounded-lg transition-colors ${c.status === 'INACTIVE' ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10' : 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10'}`}
                            title={c.status === 'INACTIVE' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 rounded-lg text-[#8a92a6] hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
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

        {/* Create / Edit Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xl bg-[#171c23] rounded-3xl shadow-2xl overflow-hidden my-8"
              >
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white flex items-center justify-between">
                  <div className="font-black text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">รหัสลูกค้า</label>
                      <input
                        type="text"
                        placeholder="เช่น CUST-001 (เว้นว่างเพื่อ auto)"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">ชื่อลูกค้า / บริษัท *</label>
                      <input
                        type="text"
                        required
                        placeholder="ชื่อลูกค้า"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">เลขประจำตัวผู้เสียภาษี</label>
                      <input
                        type="text"
                        placeholder="13 หลัก"
                        value={formData.taxId || ''}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">รหัสสาขา</label>
                      <input
                        type="text"
                        placeholder="00000 (สำนักงานใหญ่)"
                        value={formData.branchNumber || '00000'}
                        onChange={(e) => setFormData({ ...formData, branchNumber: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">ชื่อผู้ติดต่อ</label>
                      <input
                        type="text"
                        placeholder="ชื่อผู้ประสานงาน"
                        value={formData.contactPerson || ''}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">เบอร์โทรศัพท์</label>
                      <input
                        type="text"
                        placeholder="081-xxx-xxxx"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">อีเมล</label>
                    <input
                      type="email"
                      placeholder="customer@email.com"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">ที่อยู่สำหรับจัดส่ง</label>
                    <textarea
                      rows={2}
                      placeholder="ที่อยู่จัดส่งสินค้า..."
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">รหัสไปรษณีย์</label>
                      <input
                        type="text"
                        placeholder="10xxx"
                        value={formData.postalCode || ''}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">ขนส่งประจำ</label>
                      <input
                        type="text"
                        placeholder="เช่น Flash, Kerry"
                        value={formData.defaultCarrier || ''}
                        onChange={(e) => setFormData({ ...formData, defaultCarrier: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">เงื่อนไขชำระเงิน</label>
                      <select
                        value={formData.paymentTerm || 'CASH'}
                        onChange={(e) => setFormData({ ...formData, paymentTerm: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-medium text-sm bg-[#171c23]"
                      >
                        <option value="CASH">เงินสด / โอนทันที</option>
                        <option value="COD">เก็บเงินปลายทาง (COD)</option>
                        <option value="CREDIT_15">เครดิต 15 วัน</option>
                        <option value="CREDIT_30">เครดิต 30 วัน</option>
                        <option value="CREDIT_60">เครดิต 60 วัน</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">หมายเหตุเพิ่มเติม</label>
                    <input
                      type="text"
                      placeholder="เช่น ระวังแตก, ให้โทรแจ้งก่อนส่ง"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-[#30353d]">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-5 py-2.5 rounded-xl border border-[#30353d] text-[#d1c6ab] font-bold hover:bg-[#1b2027] transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-cyan-700 active:scale-95 transition-all disabled:opacity-50"
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
