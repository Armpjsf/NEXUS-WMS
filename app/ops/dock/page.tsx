'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DockAppointment } from '@/lib/dockEngine';
import { errorMessage } from '@/lib/errors';

export default function DockAppointmentsPage() {
  const [appointments, setAppointments] = useState<DockAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Dock bays (DB-driven — add as many as needed)
  const [bays, setBays] = useState<any[]>([]);
  const [showBayModal, setShowBayModal] = useState(false);
  const [newBayName, setNewBayName] = useState('');
  const [newBayType, setNewBayType] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');

  // Form State
  const [bayName, setBayName] = useState('BAY-01 (Inbound)');
  const [appointmentType, setAppointmentType] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [supplierOrCarrier, setSupplierOrCarrier] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [startTime] = useState(new Date().toISOString().slice(0, 16));
  const [durationMinutes] = useState(60);
  const [palletsCount, setPalletsCount] = useState(1);
  const [notes] = useState('');

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dock/appointments');
      const data = await res.json();
      if (data.appointments) {
        setAppointments(data.appointments);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBays = async () => {
    try {
      const res = await fetch('/api/dock/bays');
      const data = await res.json();
      const list = data.bays || [];
      setBays(list);
      if (list.length > 0 && !list.some((b: any) => b.name === bayName)) setBayName(list[0].name);
    } catch (e) {
      console.error(e);
    }
  };

  const addBay = async () => {
    if (!newBayName.trim()) {
      toast.error('ระบุชื่อช่องเทียบท่า');
      return;
    }
    try {
      const res = await fetch('/api/dock/bays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBayName.trim(), bayType: newBayType }),
      });
      const data = await res.json();
      if (data.success === false) throw new Error(data.error);
      toast.success(`เพิ่มช่อง ${newBayName.trim()} แล้ว`);
      setNewBayName('');
      setShowBayModal(false);
      fetchBays();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const deleteBay = async (id: string, name: string) => {
    if (!confirm(`ลบช่องเทียบท่า ${name}?`)) return;
    await fetch(`/api/dock/bays?id=${id}`, { method: 'DELETE' });
    fetchBays();
  };

  useEffect(() => {
    fetchAppointments();
    fetchBays();
  }, []);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/dock/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bayName,
          appointmentType,
          supplierOrCarrier,
          vehiclePlate,
          driverName,
          driverPhone,
          scheduledStart: new Date(startTime).toISOString(),
          durationMinutes: Number(durationMinutes),
          palletsCount: Number(palletsCount),
          notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`จองช่องเทียบท่าสำเร็จ เลขที่: ${data.appointment.appointmentNumber}`);
        setShowModal(false);
        fetchAppointments();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/dock/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_STATUS', id, status }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('อัปเดตสถานะรถเทียบท่าเรียบร้อย');
        fetchAppointments();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AT_BAY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 border border-amber-500/25">
            กำลังเทียบท่า (At Bay)
          </span>
        );
      case 'CHECKED_IN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/12 text-sky-700 border border-sky-500/20">
            มาถึงแล้ว (Checked In)
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/12 text-emerald-700 border border-emerald-500/20">
            เสร็จสิ้น (Completed)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            จองคิวไว้ (Booked)
          </span>
        );
    }
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Open Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <Sparkles className="w-3 h-3 text-sky-600" />
                Loading Bay Matrix & Yard Scheduling
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12 border border-sky-500/20 text-sky-700">
                <Truck className="w-5 h-5" />
              </span>
              <span>Dock Appointment & Yard Management</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              ระบบจัดคิวรถขนส่งเทียบท่า ป้องกันรถออแออัดหน้าคลัง และจัดตารางรับสินค้าขาเข้า-ออก
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchAppointments}
              disabled={loading}
              className="p-2.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full border border-slate-200/80 shadow-xs transition disabled:opacity-50"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-sm font-semibold transition flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" /> จองคิวเทียบท่า (Book Slot)
            </button>
          </div>
        </div>

        {/* Bay Status Quick Matrix */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-xs text-slate-600 uppercase tracking-wider tabular-nums">
            ช่องเทียบท่า ({bays.length})
          </h2>
          <button
            onClick={() => setShowBayModal(true)}
            className="px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full border border-slate-200/80 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่มช่องเทียบท่า
          </button>
        </div>

        {bays.length === 0 ? (
          <div className="nx-glass-card p-8 border-dashed border-slate-300 text-center text-slate-500 text-xs">
            ยังไม่มีช่องเทียบท่า — กด &quot;เพิ่มช่องเทียบท่า&quot; เพื่อกำหนดช่องตามหน้างานจริง (เพิ่มกี่ช่องก็ได้)
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bays.map((bay) => {
              const badge =
                bay.status === 'ACTIVE'
                  ? { t: 'มีรถเทียบอยู่', c: 'bg-amber-500/15 text-amber-800 border-amber-500/25' }
                  : bay.status === 'WAITING'
                  ? { t: 'มีคิวจอง', c: 'bg-sky-500/12 text-sky-700 border-sky-500/20' }
                  : { t: 'ว่างพร้อมใช้งาน', c: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' };
              return (
                <div key={bay.id} className="nx-glass-card group p-5 space-y-2 relative">
                  <div className="flex items-center justify-between gap-2 pr-4">
                    <span className="font-bold text-sm text-slate-900">
                      {bay.name} <span className="text-[11px] font-normal text-slate-500">({bay.bayType})</span>
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${badge.c}`}>
                      {badge.t}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 tabular-nums">
                    {bay.status === 'ACTIVE' && bay.vehicle
                      ? `${bay.vehicle} · ${bay.palletsDone}/${bay.palletsTotal} พาเลท${bay.eta ? ` · ${bay.eta}` : ''}`
                      : 'พร้อมรับรถเข้าเทียบ'}
                  </p>
                  <button
                    onClick={() => deleteBay(bay.id, bay.name)}
                    title="ลบช่อง"
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-rose-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Table Schedule */}
        <div className="nx-glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-200/70 flex flex-wrap justify-between items-center gap-3">
            <h2 className="font-bold text-sm text-slate-900 tabular-nums">
              ตารางคิวรถเทียบท่าทั้งหมด ({appointments.length})
            </h2>
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาทะเบียน/บริษัท..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/90 border border-slate-200/80 rounded-full text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold border-b border-slate-200/80 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">เลขที่จอง</th>
                  <th className="py-3 px-4">ช่องเทียบท่า (Bay)</th>
                  <th className="py-3 px-4">บริษัท / ผู้ขนส่ง</th>
                  <th className="py-3 px-4">ทะเบียนรถ & พนักงานขับ</th>
                  <th className="py-3 px-4">เวลาที่กำหนด</th>
                  <th className="py-3 px-4 text-center">จำนวนพาเลท</th>
                  <th className="py-3 px-4">สถานะ</th>
                  <th className="py-3 px-4 text-right">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      กำลังโหลดข้อมูลคิวเทียบท่า...
                    </td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      ยังไม่มีคิวจองเทียบท่าในระบบ กด &quot;จองคิวเทียบท่า (Book Slot)&quot; เพื่อสร้างรายการ
                    </td>
                  </tr>
                ) : (
                  appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{apt.appointmentNumber}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-sky-700">{apt.bayName}</span>
                        <div className="text-[10px] text-slate-500">{apt.appointmentType}</div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">{apt.supplierOrCarrier}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{apt.vehiclePlate}</div>
                        <div className="text-[10px] text-slate-500">
                          {apt.driverName} {apt.driverPhone && `(${apt.driverPhone})`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 tabular-nums">
                        <div className="font-mono text-slate-900">
                          {new Date(apt.scheduledStart).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          -{' '}
                          {new Date(apt.scheduledEnd).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(apt.scheduledStart).toLocaleDateString('th-TH')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900 tabular-nums">
                        {apt.palletsCount} พาเลท
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(apt.status)}</td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {apt.status === 'BOOKED' && (
                          <button
                            onClick={() => handleUpdateStatus(apt.id, 'AT_BAY')}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-full text-[11px] font-bold shadow-xs transition"
                          >
                            เทียบท่า (At Bay)
                          </button>
                        )}
                        {apt.status === 'AT_BAY' && (
                          <button
                            onClick={() => handleUpdateStatus(apt.id, 'COMPLETED')}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[11px] font-bold shadow-xs transition"
                          >
                            เสร็จสิ้น (Done)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Booking */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl p-6 text-xs text-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <h3 className="text-base font-bold text-slate-900">จองคิวช่องเทียบรถ (Book Dock Slot)</h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateAppointment} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">ช่องเทียบ (Bay) *</label>
                    <select
                      value={bayName}
                      onChange={(e) => setBayName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    >
                      {bays.length === 0 ? (
                        <option value="">— ยังไม่มีช่อง เพิ่มก่อน —</option>
                      ) : (
                        bays.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name} ({b.bayType})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">ประเภท *</label>
                    <select
                      value={appointmentType}
                      onChange={(e) => setAppointmentType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="INBOUND">ขาเข้าส่งของ (Inbound)</option>
                      <option value="OUTBOUND">ขาออกรับของ (Outbound)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    ชื่อซัพพลายเออร์ หรือ บริษัทขนส่ง *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น บจก. ซีพี ออลล์ หรือ Kerry Express"
                    value={supplierOrCarrier}
                    onChange={(e) => setSupplierOrCarrier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">ทะเบียนรถ *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น 70-5678 กทม."
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">จำนวนพาเลท (Pallets)</label>
                    <input
                      type="number"
                      min="1"
                      value={palletsCount}
                      onChange={(e) => setPalletsCount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 tabular-nums focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">ชื่อพนักงานขับ</label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">เบอร์โทรติดต่อ</label>
                    <input
                      type="text"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-semibold shadow-xs"
                  >
                    ยืนยันจองคิว
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Bay Modal */}
        {showBayModal && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowBayModal(false)}
          >
            <div
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl p-6 text-xs text-slate-900 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <h3 className="text-base font-bold text-slate-900">เพิ่มช่องเทียบท่า (Dock Bay)</h3>
                <button
                  type="button"
                  onClick={() => setShowBayModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">ชื่อช่อง *</label>
                <input
                  value={newBayName}
                  onChange={(e) => setNewBayName(e.target.value)}
                  placeholder="เช่น BAY-04 (Cold Chain)"
                  className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">ประเภท</label>
                <select
                  value={newBayType}
                  onChange={(e) => setNewBayType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="INBOUND">ขาเข้า (Inbound)</option>
                  <option value="OUTBOUND">ขาออก (Outbound)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/80">
                <button
                  onClick={() => setShowBayModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={addBay}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มช่อง
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
