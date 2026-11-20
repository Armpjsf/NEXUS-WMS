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
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1000px] mx-auto space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> ตั้งค่าระบบ
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <Warehouse className="w-3 h-3 text-sky-600" />
                TMS GPS Coordinates
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              จุดรับ / จุดส่ง (Locations)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">คลังจุดพร้อมพิกัด — เช็คเกอร์เลือกตอนสร้างงาน แล้วส่งพิกัดไป TMS</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={load} className="p-2.5 rounded-full border border-white/90 bg-white/80 hover:bg-white text-slate-700 shadow-xs transition-colors" title="รีเฟรช">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all">
              <Plus className="w-4 h-4" /> เพิ่มจุด
            </button>
          </div>
        </div>

        <div className="nx-glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="py-3.5 px-4">ชื่อจุด / ที่อยู่</th>
                  <th className="py-3.5 px-4">ประเภท</th>
                  <th className="py-3.5 px-4">ลูกค้า</th>
                  <th className="py-3.5 px-4">พิกัด</th>
                  <th className="py-3.5 px-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {locations.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-500 font-medium">{loading ? 'กำลังโหลด...' : 'ยังไม่มีจุด — กด "เพิ่มจุด"'}</td></tr>
                ) : locations.map(l => (
                  <tr key={l.id} className={`hover:bg-white/80 transition-colors ${l.status === 'INACTIVE' ? 'opacity-50' : ''}`}>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-2">{l.name}{l.status === 'INACTIVE' && <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">ปิด</span>}</div>
                      <div className="text-xs text-slate-500">{l.address || '-'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-500/12 text-sky-700 border border-sky-500/20">{KIND_LABEL[l.kind] || l.kind}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{custName(l.customerId)}</td>
                    <td className="py-3.5 px-4 tabular-nums">
                      {l.lat != null && l.lng != null
                        ? <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-700"><MapPin className="w-3 h-3" />{l.lat.toFixed(4)}, {l.lng.toFixed(4)}</span>
                        : <span className="text-xs font-medium text-amber-700">ยังไม่มีพิกัด</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => openEdit(l)} className="p-1.5 rounded-full text-slate-500 hover:text-sky-700 hover:bg-sky-500/12 transition-colors" title="แก้ไข"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => toggleStatus(l)} className={`p-1.5 rounded-full transition-colors ${l.status === 'INACTIVE' ? 'text-emerald-600 hover:bg-emerald-500/12' : 'text-amber-600 hover:bg-amber-500/15'}`} title={l.status === 'INACTIVE' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}><Power className="w-4 h-4" /></button>
                        <button onClick={() => remove(l)} className="p-1.5 rounded-full text-slate-500 hover:text-rose-700 hover:bg-rose-500/12 transition-colors" title="ลบ"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-2xl overflow-hidden text-slate-900">
            <div className="px-6 py-5 border-b border-slate-200/80 flex items-center justify-between">
              <div className="font-bold text-lg flex items-center gap-2.5 text-slate-900">
                <span className="p-2 rounded-xl bg-sky-500/12 border border-sky-500/20 text-sky-700"><Warehouse className="w-5 h-5" /></span>
                {editing ? 'แก้ไขจุดรับ' : 'เพิ่มจุดรับ'}
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ชื่อจุดรับ *</label>
                <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 text-sm outline-none focus:border-emerald-500" placeholder="เช่น คลังลูกค้า A ลาดกระบัง" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ประเภท</label>
                  <select value={form.kind || 'PICKUP'} onChange={e => setForm({ ...form, kind: e.target.value as LocationKind })} className="w-full px-3.5 py-2 rounded-xl border border-slate-200/80 text-slate-900 text-sm bg-white outline-none focus:border-emerald-500">
                    <option value="PICKUP">จุดรับ</option>
                    <option value="DROP">จุดส่ง</option>
                    <option value="BOTH">ใช้ได้ทั้งรับ+ส่ง</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">เบอร์ (จุดส่ง)</label>
                  <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 text-sm outline-none focus:border-emerald-500" placeholder="เบอร์ผู้รับ" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ที่อยู่</label>
                <input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ลูกค้า</label>
                <select value={form.customerId || ''} onChange={e => setForm({ ...form, customerId: e.target.value || null })} className="w-full px-3.5 py-2 rounded-xl border border-slate-200/80 text-slate-900 text-sm bg-white outline-none focus:border-emerald-500">
                  <option value="">จุดกลาง (ใช้ได้ทุกลูกค้า)</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">พิกัด (lat, lng)</label>
                <div className="flex gap-2">
                  <input value={latStr} onChange={e => setLatStr(e.target.value)} inputMode="decimal" placeholder="lat" className="w-1/2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 text-sm font-mono tabular-nums outline-none focus:border-emerald-500" />
                  <input value={lngStr} onChange={e => setLngStr(e.target.value)} inputMode="decimal" placeholder="lng" className="w-1/2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-900 text-sm font-mono tabular-nums outline-none focus:border-emerald-500" />
                </div>
                <button type="button" onClick={useGps} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800"><LocateFixed className="w-4 h-4" /> ใช้ตำแหน่งปัจจุบัน (GPS)</button>
              </div>
              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200/80">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 rounded-full border border-slate-200/80 text-slate-700 text-xs font-semibold hover:bg-slate-100">ยกเลิก</button>
                <button type="submit" disabled={saving} className="px-6 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
