'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Truck, Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { errorMessage } from '@/lib/errors';

interface Vehicle { id: string; plate: string; driverName: string; vehicleType: string; active: boolean }

const VEHICLE_TYPES = ['4-Wheel', '6-Wheel', '10-Wheel', 'มอเตอร์ไซค์', 'รถตู้', 'อื่นๆ'];

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ plate: '', driverName: '', vehicleType: '4-Wheel' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fleet-vehicles', { cache: 'no-store' });
      const data = await res.json();
      setVehicles(data.vehicles || []);
    } catch { toast.error('โหลดข้อมูลรถไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.plate.trim()) { toast.error('ใส่ทะเบียนรถ'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/fleet-vehicles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'เพิ่มไม่สำเร็จ');
      toast.success('เพิ่มรถแล้ว');
      setForm({ plate: '', driverName: '', vehicleType: '4-Wheel' });
      load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const save = async (v: Vehicle) => {
    try {
      const res = await fetch('/api/fleet-vehicles', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: v.id, plate: v.plate, driverName: v.driverName, vehicleType: v.vehicleType, active: v.active }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'บันทึกไม่สำเร็จ');
      toast.success('บันทึกแล้ว');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const remove = async (id: string) => {
    if (!confirm('ลบรถคันนี้?')) return;
    try {
      const res = await fetch('/api/fleet-vehicles', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('ลบไม่สำเร็จ');
      toast.success('ลบแล้ว');
      setVehicles(prev => prev.filter(x => x.id !== id));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const patch = (id: string, key: keyof Vehicle, value: any) =>
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, [key]: value } : v));

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> ตั้งค่าระบบ
        </Link>

        <div className="pt-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
              <Truck className="w-3 h-3 text-sky-600" />
              Company Fleet
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">รถบริษัท (Fleet)</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">ทะเบียนรถ + คนขับประจำ สำหรับให้เช็คเกอร์เลือกตอนส่งของขึ้นรถ</p>
        </div>

        {/* Add form */}
        <div className="nx-glass-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2.5">
            <input
              value={form.plate}
              onChange={e => setForm(f => ({ ...f, plate: e.target.value }))}
              placeholder="ทะเบียน เช่น 1กก-1234"
              className="bg-white/90 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <input
              value={form.driverName}
              onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))}
              placeholder="ชื่อคนขับ"
              className="bg-white/90 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <select
              value={form.vehicleType}
              onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}
              className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500"
            >
              {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <button
              onClick={add}
              disabled={saving}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? <div className="text-center text-slate-500 py-12 text-sm">กำลังโหลด...</div>
          : vehicles.length === 0 ? <div className="nx-glass-card text-center text-slate-500 py-12 text-sm">ยังไม่มีรถ — เพิ่มด้านบน</div>
          : (
            <div className="space-y-3">
              {vehicles.map(v => (
                <div key={v.id} className={`nx-glass-card p-3.5 transition-opacity ${v.active ? '' : 'opacity-60'}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5 items-center">
                    <input
                      value={v.plate}
                      onChange={e => patch(v.id, 'plate', e.target.value)}
                      className="bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-emerald-500"
                    />
                    <input
                      value={v.driverName}
                      onChange={e => patch(v.id, 'driverName', e.target.value)}
                      placeholder="ชื่อคนขับ"
                      className="bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <select
                        value={v.vehicleType}
                        onChange={e => patch(v.id, 'vehicleType', e.target.value)}
                        className="bg-white/80 border border-slate-200/80 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 outline-none"
                      >
                        {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <button
                        onClick={() => patch(v.id, 'active', !v.active)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${v.active ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                      >
                        {v.active ? 'ใช้งาน' : 'ปิด'}
                      </button>
                      <button
                        onClick={() => save(v)}
                        className="p-2 rounded-full bg-sky-500/12 text-sky-700 border border-sky-500/20 hover:bg-sky-500/20 active:scale-90 transition-all"
                        title="บันทึก"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(v.id)}
                        className="p-2 rounded-full text-slate-500 hover:text-rose-700 hover:bg-rose-500/12 active:scale-90 transition-all"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
