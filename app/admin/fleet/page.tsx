'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Truck, Plus, Trash2, Save, X } from 'lucide-react';

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
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const save = async (v: Vehicle) => {
    try {
      const res = await fetch('/api/fleet-vehicles', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: v.id, plate: v.plate, driverName: v.driverName, vehicleType: v.vehicleType, active: v.active }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'บันทึกไม่สำเร็จ');
      toast.success('บันทึกแล้ว');
    } catch (e: any) { toast.error(e.message); }
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
    } catch (e: any) { toast.error(e.message); }
  };

  const patch = (id: string, key: keyof Vehicle, value: any) =>
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, [key]: value } : v));

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Truck className="w-6 h-6 text-blue-600" /> รถบริษัท (Fleet)</h1>
          <p className="text-sm text-slate-500 mt-0.5">ทะเบียนรถ + คนขับประจำ สำหรับให้เช็คเกอร์เลือกตอนส่งของขึ้นรถ</p>
        </div>

        {/* Add form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2.5">
            <input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} placeholder="ทะเบียน เช่น 1กก-1234"
              className="bg-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
            <input value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} placeholder="ชื่อคนขับ"
              className="bg-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
            <select value={form.vehicleType} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}
              className="bg-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none">
              {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <button onClick={add} disabled={saving} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl flex items-center gap-1.5 active:scale-95 disabled:opacity-50">
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? <div className="text-center text-slate-400 py-12">กำลังโหลด...</div>
          : vehicles.length === 0 ? <div className="text-center text-slate-400 py-12">ยังไม่มีรถ — เพิ่มด้านบน</div>
          : (
            <div className="space-y-2.5">
              {vehicles.map(v => (
                <div key={v.id} className={`bg-white border rounded-2xl p-3.5 shadow-sm ${v.active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5 items-center">
                    <input value={v.plate} onChange={e => patch(v.id, 'plate', e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold outline-none" />
                    <input value={v.driverName} onChange={e => patch(v.id, 'driverName', e.target.value)} placeholder="ชื่อคนขับ" className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                    <div className="flex items-center gap-2 justify-end">
                      <select value={v.vehicleType} onChange={e => patch(v.id, 'vehicleType', e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none">
                        {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <button onClick={() => patch(v.id, 'active', !v.active)} className={`px-2.5 py-2 rounded-lg text-xs font-bold ${v.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {v.active ? 'ใช้งาน' : 'ปิด'}
                      </button>
                      <button onClick={() => save(v)} className="p-2 rounded-lg bg-blue-50 text-blue-600 active:scale-90"><Save className="w-4 h-4" /></button>
                      <button onClick={() => remove(v.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 active:scale-90"><Trash2 className="w-4 h-4" /></button>
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
