'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Warehouse, Plus, Trash2, Edit2, ArrowLeft, RefreshCw, MapPin, LocateFixed, Power, X } from 'lucide-react';
import { errorMessage } from '@/lib/errors';

type LocationKind = 'PICKUP' | 'DROP' | 'BOTH';
interface PickupLocation {
  id: string;
  customerId: string | null;
  name: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  kind: LocationKind;
  isDefault: boolean;
  status: string;
}
interface CustomerOpt { id: string; name: string }

const KIND_LABEL: Record<LocationKind, string> = { PICKUP: 'จุดรับ', DROP: 'จุดส่ง', BOTH: 'รับ+ส่ง' };
const emptyForm: Partial<PickupLocation> = { name: '', address: '', phone: '', lat: null, lng: null, customerId: null, kind: 'PICKUP', isDefault: false, status: 'ACTIVE' };

export default function AdminPickupLocationsPage() {
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PickupLocation | null>(null);
  const [form, setForm] = useState<Partial<PickupLocation>>(emptyForm);
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rl, rc] = await Promise.all([
        fetch('/api/pickup-locations', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/customers', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      ]);
      setLocations(rl.locations || []);
      setCustomers((rc.customers || []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setLatStr(''); setLngStr(''); setShowModal(true); };
  const openEdit = (l: PickupLocation) => {
    setEditing(l); setForm(l);
    setLatStr(l.lat != null ? String(l.lat) : ''); setLngStr(l.lng != null ? String(l.lng) : '');
    setShowModal(true);
  };

  const useGps = () => {
    if (!navigator.geolocation) { toast.error('อุปกรณ์ไม่รองรับ GPS'); return; }
    const t = toast.loading('กำลังอ่านตำแหน่ง GPS...');
    navigator.geolocation.getCurrentPosition(
      pos => { setLatStr(pos.coords.latitude.toFixed(6)); setLngStr(pos.coords.longitude.toFixed(6)); toast.success('ได้พิกัดแล้ว', { id: t }); },
      () => toast.error('อ่าน GPS ไม่สำเร็จ', { id: t }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error('กรุณากรอกชื่อจุดรับ'); return; }
    const lat = latStr.trim() ? Number(latStr) : null;
    const lng = lngStr.trim() ? Number(lngStr) : null;
    if ((lat != null && Number.isNaN(lat)) || (lng != null && Number.isNaN(lng))) { toast.error('พิกัดไม่ถูกต้อง'); return; }
    setSaving(true);
    try {
      const isEdit = Boolean(editing?.id);
      const body = { ...form, lat, lng, ...(isEdit ? { id: editing!.id } : {}) };
      const res = await fetch('/api/pickup-locations', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'บันทึกไม่สำเร็จ');
      toast.success(isEdit ? 'อัปเดตแล้ว' : 'เพิ่มจุดรับแล้ว');
      setShowModal(false); load();
    } catch (err) { toast.error(errorMessage(err) || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (l: PickupLocation) => {
    const next = l.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    try {
      const res = await fetch('/api/pickup-locations', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: l.id, status: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'ไม่สำเร็จ');
      toast.success(next === 'INACTIVE' ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว'); load();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const remove = async (l: PickupLocation) => {
    if (!confirm(`ลบจุดรับ "${l.name}"?`)) return;
    try {
      const res = await fetch(`/api/pickup-locations?id=${l.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'ลบไม่สำเร็จ');
      toast.success('ลบแล้ว'); load();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const custName = (id: string | null) => id ? (customers.find(c => c.id === id)?.name || '(ลูกค้าถูกลบ)') : 'จุดกลาง (ทุกลูกค้า)';

  return (
    <div className="min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 bg-[#1b2027]">
      <div className="max-w-[1000px] mx-auto space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[#d1c6ab] hover:text-[#facc15]">
          <ArrowLeft className="w-4 h-4" /> ตั้งค่าระบบ
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#dee2ec] flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 text-white shadow-lg">
                <Warehouse className="w-6 h-6" />
              </span>
              จุดรับ / จุดส่ง (Locations)
            </h1>
            <p className="text-[#d1c6ab] font-medium mt-1">คลังจุดพร้อมพิกัด — เช็คเกอร์เลือกตอนสร้างงาน แล้วส่งพิกัดไป TMS</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="p-2.5 rounded-xl border border-[#30353d] bg-[#171c23] text-[#d1c6ab] shadow-sm">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold shadow-lg active:scale-95">
              <Plus className="w-5 h-5" /> เพิ่มจุด
            </button>
          </div>
        </div>

        <div className="bg-[#171c23] rounded-2xl border border-[#30353d] shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#30353d] bg-[#1b2027]/50 text-[11px] uppercase font-bold text-[#8a92a6] tracking-wider">
                <th className="py-3.5 px-4">ชื่อจุด / ที่อยู่</th>
                <th className="py-3.5 px-4">ประเภท</th>
                <th className="py-3.5 px-4">ลูกค้า</th>
                <th className="py-3.5 px-4">พิกัด</th>
                <th className="py-3.5 px-4 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30353d]">
              {locations.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-[#8a92a6] font-medium">{loading ? 'กำลังโหลด...' : 'ยังไม่มีจุด — กด "เพิ่มจุด"'}</td></tr>
              ) : locations.map(l => (
                <tr key={l.id} className={`hover:bg-[#1b2027]/80 ${l.status === 'INACTIVE' ? 'opacity-50' : ''}`}>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#dee2ec] flex items-center gap-2">{l.name}{l.status === 'INACTIVE' && <span className="text-[10px] bg-[#30353d] text-[#8a92a6] px-1.5 py-0.5 rounded">ปิด</span>}</div>
                    <div className="text-xs text-[#8a92a6]">{l.address || '-'}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 border border-cyan-500/20">{KIND_LABEL[l.kind] || l.kind}</span>
                  </td>
                  <td className="py-3.5 px-4 text-[#d1c6ab]">{custName(l.customerId)}</td>
                  <td className="py-3.5 px-4">
                    {l.lat != null && l.lng != null
                      ? <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600"><MapPin className="w-3 h-3" />{l.lat.toFixed(4)}, {l.lng.toFixed(4)}</span>
                      : <span className="text-xs text-amber-500">ยังไม่มีพิกัด</span>}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg text-[#8a92a6] hover:text-blue-600 hover:bg-blue-500/10" title="แก้ไข"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => toggleStatus(l)} className={`p-1.5 rounded-lg ${l.status === 'INACTIVE' ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-amber-500 hover:bg-amber-500/10'}`} title={l.status === 'INACTIVE' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}><Power className="w-4 h-4" /></button>
                      <button onClick={() => remove(l)} className="p-1.5 rounded-lg text-[#8a92a6] hover:text-rose-600 hover:bg-rose-500/10" title="ลบ"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#171c23] rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-cyan-600 to-blue-700 text-white flex items-center justify-between">
              <div className="font-black text-lg flex items-center gap-2"><Warehouse className="w-5 h-5" />{editing ? 'แก้ไขจุดรับ' : 'เพิ่มจุดรับ'}</div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-full hover:bg-white/20"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">ชื่อจุดรับ *</label>
                <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] text-sm" placeholder="เช่น คลังลูกค้า A ลาดกระบัง" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">ประเภท</label>
                  <select value={form.kind || 'PICKUP'} onChange={e => setForm({ ...form, kind: e.target.value as LocationKind })} className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] text-sm bg-[#171c23]">
                    <option value="PICKUP">จุดรับ</option>
                    <option value="DROP">จุดส่ง</option>
                    <option value="BOTH">ใช้ได้ทั้งรับ+ส่ง</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">เบอร์ (จุดส่ง)</label>
                  <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] text-sm" placeholder="เบอร์ผู้รับ" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">ที่อยู่</label>
                <input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">ลูกค้า</label>
                <select value={form.customerId || ''} onChange={e => setForm({ ...form, customerId: e.target.value || null })} className="w-full px-3.5 py-2 rounded-xl border border-[#30353d] text-sm bg-[#171c23]">
                  <option value="">จุดกลาง (ใช้ได้ทุกลูกค้า)</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#d1c6ab] uppercase mb-1">พิกัด (lat, lng)</label>
                <div className="flex gap-2">
                  <input value={latStr} onChange={e => setLatStr(e.target.value)} inputMode="decimal" placeholder="lat" className="w-1/2 px-3.5 py-2 rounded-xl border border-[#30353d] text-sm font-mono" />
                  <input value={lngStr} onChange={e => setLngStr(e.target.value)} inputMode="decimal" placeholder="lng" className="w-1/2 px-3.5 py-2 rounded-xl border border-[#30353d] text-sm font-mono" />
                </div>
                <button type="button" onClick={useGps} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600"><LocateFixed className="w-4 h-4" /> ใช้ตำแหน่งปัจจุบัน (GPS)</button>
              </div>
              <div className="pt-3 flex justify-end gap-3 border-t border-[#30353d]">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl border border-[#30353d] text-[#d1c6ab] font-bold">ยกเลิก</button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
