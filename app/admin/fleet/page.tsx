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
          <h1 className="text-2xl font-black text-[#dee2ec] flex items-center gap-2"><Truck className="w-6 h-6 text-[#4cd7f6]" /> รถบริษัท (Fleet)</h1>
          <p className="text-sm text-[#d1c6ab] mt-0.5">ทะเบียนรถ + คนขับประจำ สำหรับให้เช็คเกอร์เลือกตอนส่งของขึ้นรถ</p>
        </div>

        {/* Add form */}
        <div className="bg-[#171c23] border border-[#30353d] rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2.5">
            <input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} placeholder="ทะเบียน เช่น 1กก-1234"
              className="bg-[#252a32] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
            <input value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} placeholder="ชื่อคนขับ"
              className="bg-[#252a32] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
            <select value={form.vehicleType} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}
              className="bg-[#252a32] rounded-xl px-3 py-2.5 text-sm outline-none">
              {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <button onClick={add} disabled={saving} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl flex items-center gap-1.5 active:scale-95 disabled:opacity-50">
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? <div className="text-center text-[#8a92a6] py-12">กำลังโหลด...</div>
          : vehicles.length === 0 ? <div className="text-center text-[#8a92a6] py-12">ยังไม่มีรถ — เพิ่มด้านบน</div>
          : (
            <div className="space-y-2.5">
              {vehicles.map(v => (
                <div key={v.id} className={`bg-[#171c23] border rounded-2xl p-3.5 shadow-sm ${v.active ? 'border-[#30353d]' : 'border-[#30353d] opacity-60'}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5 items-center">
                    <input value={v.plate} onChange={e => patch(v.id, 'plate', e.target.value)} className="bg-[#1b2027] border border-[#30353d] rounded-lg px-3 py-2 text-sm font-mono font-bold outline-none" />
                    <input value={v.driverName} onChange={e => patch(v.id, 'driverName', e.target.value)} placeholder="ชื่อคนขับ" className="bg-[#1b2027] border border-[#30353d] rounded-lg px-3 py-2 text-sm outline-none" />
                    <div className="flex items-center gap-2 justify-end">
                      <select value={v.vehicleType} onChange={e => patch(v.id, 'vehicleType', e.target.value)} className="bg-[#1b2027] border border-[#30353d] rounded-lg px-2 py-2 text-xs outline-none">
                        {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <button onClick={() => patch(v.id, 'active', !v.active)} className={`px-2.5 py-2 rounded-lg text-xs font-bold ${v.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[#252a32] text-[#8a92a6]'}`}>
                        {v.active ? 'ใช้งาน' : 'ปิด'}
                      </button>
                      <button onClick={() => save(v)} className="p-2 rounded-lg bg-blue-500/10 text-blue-600 active:scale-90"><Save className="w-4 h-4" /></button>
                      <button onClick={() => remove(v.id)} className="p-2 rounded-lg text-[#8a92a6] hover:text-rose-600 active:scale-90"><Trash2 className="w-4 h-4" /></button>
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
