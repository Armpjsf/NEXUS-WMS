'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import toast from 'react-hot-toast';
import { DockAppointment } from '@/lib/dockEngine';

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
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [palletsCount, setPalletsCount] = useState(1);
  const [notes, setNotes] = useState('');

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
    } catch (e) { console.error(e); }
  };

  const addBay = async () => {
    if (!newBayName.trim()) { toast.error('ระบุชื่อช่องเทียบท่า'); return; }
    try {
      const res = await fetch('/api/dock/bays', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBayName.trim(), bayType: newBayType }),
      });
      const data = await res.json();
      if (data.success === false) throw new Error(data.error);
      toast.success(`เพิ่มช่อง ${newBayName.trim()} แล้ว`);
      setNewBayName(''); setShowBayModal(false); fetchBays();
    } catch (e: any) { toast.error(e.message); }
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
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`จองช่องเทียบท่าสำเร็จ เลขที่: ${data.appointment.appointmentNumber}`);
        setShowModal(false);
        fetchAppointments();
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/dock/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_STATUS', id, status })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('อัปเดตสถานะรถเทียบท่าเรียบร้อย');
        fetchAppointments();
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AT_BAY':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#facc15]/20 text-[#facc15] border border-[#facc15]/30">กำลังเทียบท่า (At Bay)</span>;
      case 'CHECKED_IN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/30">มาถึงแล้ว (Checked In)</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#57ec7f]/20 text-[#57ec7f] border border-[#57ec7f]/30">เสร็จสิ้น (Completed)</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#252a32] text-[#dee2ec] border border-[#30353d]">จองคิวไว้ (Booked)</span>;
    }
  };

  return (
    <div className="relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 font-mono text-[#dee2ec]">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">

        {/* Header Tactical Banner */}
        <div className="relative mx-auto flex flex-col gap-4 overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23]/90 p-5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
          <div className="relative z-10">
            <p className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4cd7f6] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#4cd7f6]" />
              LOADING BAY MATRIX & YARD APPOINTMENT SCHEDULING
            </p>
            <h1 className="font-headline text-2xl md:text-3xl font-black text-[#dee2ec] tracking-tight mb-1 flex items-center gap-3">
              <div className="bg-[#4cd7f6] text-[#042027] p-2 rounded-lg shadow-md">
                <Truck className="w-6 h-6" />
              </div>
              Dock Appointment & Yard Management
            </h1>
            <p className="text-[#8a92a6] font-mono text-xs">
              ระบบจัดคิวรถขนส่งเทียบท่า ป้องกันรถออแออัดหน้าคลัง และจัดตารางรับสินค้าขาเข้า-ออก
            </p>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={fetchAppointments}
              className="p-2.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] rounded-xl border border-[#30353d] transition"
              title="รีเฟรช"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#042027] rounded-xl shadow-lg shadow-[#4cd7f6]/20 font-black transition flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" /> + จองคิวเทียบท่า (Book Slot)
            </button>
          </div>
        </div>

        {/* Bay Status Quick Matrix (DB-driven — เพิ่มได้ไม่จำกัด) */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-xs text-[#8a92a6] uppercase tracking-wider">ช่องเทียบท่า ({bays.length})</h2>
          <button onClick={() => setShowBayModal(true)} className="px-3 py-1.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] rounded-lg border border-[#30353d] text-[11px] font-bold flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> เพิ่มช่องเทียบท่า
          </button>
        </div>
        {bays.length === 0 ? (
          <div className="p-6 bg-[#171c23]/90 rounded-xl border border-dashed border-[#30353d] text-center text-[#8a92a6] text-xs">
            ยังไม่มีช่องเทียบท่า — กด "เพิ่มช่องเทียบท่า" เพื่อกำหนดช่องตามหน้างานจริง (เพิ่มกี่ช่องก็ได้)
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bays.map((bay) => {
              const badge = bay.status === 'ACTIVE'
                ? { t: 'มีรถเทียบอยู่', c: 'bg-[#facc15]/20 text-[#facc15] border-[#facc15]/30' }
                : bay.status === 'WAITING'
                ? { t: 'มีคิวจอง', c: 'bg-[#4cd7f6]/20 text-[#4cd7f6] border-[#4cd7f6]/30' }
                : { t: 'ว่างพร้อมใช้งาน', c: 'bg-[#57ec7f]/20 text-[#57ec7f] border-[#57ec7f]/30' };
              return (
                <div key={bay.id} className="group p-4 bg-[#171c23]/90 rounded-xl border border-[#30353d] shadow-xl backdrop-blur-md space-y-2 relative">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#dee2ec]">{bay.name} <span className="text-[10px] text-[#8a92a6]">({bay.bayType})</span></span>
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badge.c}`}>{badge.t}</span>
                  </div>
                  <p className="text-xs text-[#8a92a6]">
                    {bay.status === 'ACTIVE' && bay.vehicle
                      ? `${bay.vehicle} · ${bay.palletsDone}/${bay.palletsTotal} พาเลท${bay.eta ? ` · ${bay.eta}` : ''}`
                      : 'พร้อมรับรถเข้าเทียบ'}
                  </p>
                  <button onClick={() => deleteBay(bay.id, bay.name)} title="ลบช่อง"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-[#8a92a6] hover:text-rose-400 text-[10px]">✕</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Table Schedule */}
        <div className="bg-[#171c23]/90 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="p-4 border-b border-[#30353d] flex justify-between items-center">
            <h2 className="font-bold text-xs text-[#dee2ec]">ตารางคิวรถเทียบท่าทั้งหมด ({appointments.length})</h2>
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a92a6]" />
              <input
                type="text"
                placeholder="ค้นหาทะเบียน/บริษัท..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2 py-1 text-xs bg-[#12161d] border border-[#30353d] rounded-lg text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12161d] text-[#8a92a6] font-bold border-b border-[#30353d] uppercase tracking-wider">
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
              <tbody className="divide-y divide-[#262c36]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#8a92a6]">กำลังโหลดข้อมูลคิวเทียบท่า...</td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#8a92a6]">
                      ยังไม่มีคิวจองเทียบท่าในระบบ กด "+ จองคิวเทียบท่า (Book Slot)" เพื่อสร้างรายการ
                    </td>
                  </tr>
                ) : appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#dee2ec]">{apt.appointmentNumber}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#4cd7f6]">{apt.bayName}</span>
                      <div className="text-[10px] text-[#8a92a6]">{apt.appointmentType}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#dee2ec]">{apt.supplierOrCarrier}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#dee2ec]">{apt.vehiclePlate}</div>
                      <div className="text-[10px] text-[#8a92a6]">{apt.driverName} {apt.driverPhone && `(${apt.driverPhone})`}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-[#dee2ec]">{new Date(apt.scheduledStart).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(apt.scheduledEnd).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="text-[10px] text-[#8a92a6]">{new Date(apt.scheduledStart).toLocaleDateString('th-TH')}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-[#dee2ec]">
                      {apt.palletsCount} พาเลท
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(apt.status)}</td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {apt.status === 'BOOKED' && (
                        <button
                          onClick={() => handleUpdateStatus(apt.id, 'AT_BAY')}
                          className="px-2.5 py-1 bg-[#facc15] text-[#1b1600] rounded-lg text-[11px] font-black shadow"
                        >
                          เทียบท่า (At Bay)
                        </button>
                      )}
                      {apt.status === 'AT_BAY' && (
                        <button
                          onClick={() => handleUpdateStatus(apt.id, 'COMPLETED')}
                          className="px-2.5 py-1 bg-[#57ec7f] text-[#0a2012] rounded-lg text-[11px] font-black shadow"
                        >
                          เสร็จสิ้น (Done)
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Booking */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-2xl p-6 text-xs font-mono text-[#dee2ec] space-y-3">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
              <h3 className="text-base font-black text-[#dee2ec]">จองคิวช่องเทียบรถ (Book Dock Slot)</h3>
              <form onSubmit={handleCreateAppointment} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">ช่องเทียบ (Bay) *</label>
                    <select
                      value={bayName}
                      onChange={(e) => setBayName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]"
                    >
                      {bays.length === 0 ? (
                        <option value="">— ยังไม่มีช่อง เพิ่มก่อน —</option>
                      ) : bays.map((b) => (
                        <option key={b.id} value={b.name}>{b.name} ({b.bayType})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">ประเภท *</label>
                    <select
                      value={appointmentType}
                      onChange={(e) => setAppointmentType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]"
                    >
                      <option value="INBOUND">ขาเข้าส่งของ (Inbound)</option>
                      <option value="OUTBOUND">ขาออกรับของ (Outbound)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[#8a92a6] font-bold mb-1">ชื่อซัพพลายเออร์ หรือ บริษัทขนส่ง *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น บจก. ซีพี ออลล์ หรือ Kerry Express"
                    value={supplierOrCarrier}
                    onChange={(e) => setSupplierOrCarrier(e.target.value)}
                    className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">ทะเบียนรถ *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น 70-5678 กทม."
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">จำนวนพาเลท (Pallets)</label>
                    <input
                      type="number"
                      min="1"
                      value={palletsCount}
                      onChange={(e) => setPalletsCount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">ชื่อพนักงานขับ</label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">เบอร์โทรติดต่อ</label>
                    <input
                      type="text"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#30353d]">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-[#252a32] text-[#8a92a6] hover:text-white rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#042027] rounded-xl font-black shadow"
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
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowBayModal(false)}>
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-2xl p-6 text-xs font-mono text-[#dee2ec] space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
              <h3 className="text-base font-black">เพิ่มช่องเทียบท่า (Dock Bay)</h3>
              <div>
                <label className="block text-[#8a92a6] font-bold mb-1">ชื่อช่อง *</label>
                <input value={newBayName} onChange={(e) => setNewBayName(e.target.value)} placeholder="เช่น BAY-04 (Cold Chain)"
                  className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[#8a92a6] font-bold mb-1">ประเภท</label>
                <select value={newBayType} onChange={(e) => setNewBayType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]">
                  <option value="INBOUND">ขาเข้า (Inbound)</option>
                  <option value="OUTBOUND">ขาออก (Outbound)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#30353d]">
                <button onClick={() => setShowBayModal(false)} className="px-4 py-2 bg-[#252a32] text-[#8a92a6] hover:text-white rounded-xl">ยกเลิก</button>
                <button onClick={addBay} className="px-5 py-2 bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#042027] rounded-xl font-black shadow flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> เพิ่มช่อง</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
