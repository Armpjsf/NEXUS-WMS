'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Truck, Plus, Minus, Trash2, Check, MapPin, Phone, User, PackageCheck, ScanLine, PenLine, ChevronDown } from 'lucide-react';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import SignatureModal from '@/components/SignatureModal';
import { getApiUrl } from '@/lib/config';

interface Item { sku: string; name: string; qty: number; drop: number }
interface Drop { name: string; phone: string; address: string }
interface Carrier { code: string; name: string; isDefault?: boolean }
interface Vehicle { id: string; plate: string; driverName: string; vehicleType: string }
interface CustomerOpt { id: string; name: string; phone: string; address: string; defaultCarrier?: string }

// Full static class strings (Tailwind can't see dynamically-built class names).
const DROP_STYLES = [
  { border: 'border-cyan-200', text: 'text-cyan-600', chip: 'bg-cyan-600 text-white', badge: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  { border: 'border-violet-200', text: 'text-violet-600', chip: 'bg-violet-600 text-white', badge: 'bg-violet-50 text-violet-600 border-violet-100' },
  { border: 'border-amber-200', text: 'text-amber-600', chip: 'bg-amber-600 text-white', badge: 'bg-amber-50 text-amber-600 border-amber-100' },
  { border: 'border-rose-200', text: 'text-rose-600', chip: 'bg-rose-600 text-white', badge: 'bg-rose-50 text-rose-600 border-rose-100' },
  { border: 'border-emerald-200', text: 'text-emerald-600', chip: 'bg-emerald-600 text-white', badge: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
];
const ds = (i: number) => DROP_STYLES[((i % 5) + 5) % 5];
const DRAFT_KEY = 'xd-dispatch-draft';

// Cross-dock dispatch: check goods at the dock and load onto a fixed company
// truck. No stock needed. Supports multiple drops (group items per drop) and
// picking the vehicle/driver; shipping auto-creates the TMS job.
export default function MobileDispatchPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [carrier, setCarrier] = useState('รถขนส่งบริษัท (จัดส่งเอง)');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [customerOpts, setCustomerOpts] = useState<CustomerOpt[]>([]);

  const [customer, setCustomer] = useState('');
  const [drops, setDrops] = useState<Drop[]>([{ name: '', phone: '', address: '' }]);
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [activeDrop, setActiveDrop] = useState(1);

  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [sigTarget, setSigTarget] = useState<'' | 'customer' | 'checker'>('');
  const [customerStaffSig, setCustomerStaffSig] = useState('');
  const [checkerSig, setCheckerSig] = useState('');
  // NOTE: the driver does NOT use the WMS app — driver confirms the loaded count
  // in the TMS app instead. So no driver signature/count here.

  const load = useCallback(async () => {
    try {
      const [rc, rv, rcu] = await Promise.all([
        fetch(getApiUrl('/api/carriers'), { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch(getApiUrl('/api/fleet-vehicles?active=1'), { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch(getApiUrl('/api/customers'), { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      ]);
      const cs: Carrier[] = rc.carriers || [];
      setCarriers(cs);
      const def = cs.find(c => c.isDefault) || cs.find(c => /บริษัท|จัดส่งเอง|fleet/i.test(c.name)) || cs[0];
      if (def) setCarrier(def.name);
      setVehicles(rv.vehicles || []);
      setCustomerOpts((rcu.customers || [])
        .filter((c: any) => c.status !== 'INACTIVE')
        .map((c: any) => ({ id: c.id, name: c.name, phone: c.phone || '', address: c.address || '', defaultCarrier: c.defaultCarrier || '' })));
    } catch { /* keep defaults */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Persist an in-progress draft so a screen lock / app reload doesn't lose the
  // scanned items. Restore on mount, autosave on change, clear on dispatch.
  const restored = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.items) && d.items.length > 0) {
          setItems(d.items);
          setDrops(Array.isArray(d.drops) && d.drops.length ? d.drops : [{ name: '', phone: '', address: '' }]);
          setCustomer(d.customer || ''); setVehicleId(d.vehicleId || ''); setActiveDrop(d.activeDrop || 1);
          setCustomerStaffSig(d.customerStaffSig || ''); setCheckerSig(d.checkerSig || '');
          toast('กู้รายการที่ค้างไว้กลับมาแล้ว', { icon: '↩️' });
        }
      }
    } catch { /* ignore */ }
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (items.length === 0) { localStorage.removeItem(DRAFT_KEY); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ items, drops, customer, vehicleId, activeDrop, customerStaffSig, checkerSig }));
    } catch { /* ignore quota/private-mode */ }
  }, [items, drops, customer, vehicleId, activeDrop, customerStaffSig, checkerSig]);

  const isFleet = /บริษัท|จัดส่งเอง|fleet/i.test(carrier);
  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  // Add qty of an item to the active drop. If the same code/name already exists
  // in that drop, merge (increment) — so scanning one label twice = qty 2, and
  // "1 label = N pieces" is just an editable qty on the row.
  const addOrMerge = (itemName: string, itemSku: string, addQty: number) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.drop === activeDrop && (itemSku ? i.sku === itemSku : i.name === itemName));
      if (idx >= 0) {
        const c = [...prev]; c[idx] = { ...c[idx], qty: c[idx].qty + addQty }; return c;
      }
      return [...prev, { sku: itemSku || itemName || `XD-${Date.now().toString().slice(-6)}`, name: itemName, qty: addQty, drop: activeDrop }];
    });
    setChecked(false);
  };

  const addItem = () => {
    const n = name.trim(); const q = Number(qty);
    if (!n) { toast.error('ใส่ชื่อ/รายการของ'); return; }
    if (!q || q <= 0) { toast.error('จำนวนไม่ถูกต้อง'); return; }
    addOrMerge(n, n, q);
    setName(''); setQty('1');
  };
  const onScanned = (code: string) => {
    let itemName = (code || '').trim(); if (!itemName) return;
    let itemSku = '';
    // WMS/old QR labels encode {"loc","name","stock"} — pull out the real name.
    if (itemName.startsWith('{')) {
      try {
        const o = JSON.parse(itemName);
        if (o && (o.name || o.sku)) { itemName = String(o.name || o.sku); itemSku = String(o.sku || o.name || ''); }
      } catch { /* not JSON — keep raw */ }
    }
    addOrMerge(itemName, itemSku, 1);
    toast.success(`ดรอป ${activeDrop}: ${itemName}`);
  };
  const removeItem = (i: number) => { setItems(prev => prev.filter((_, idx) => idx !== i)); setChecked(false); };
  const setItemDrop = (i: number, d: number) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, drop: d } : it));
  const bumpQty = (i: number, delta: number) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Math.max(1, it.qty + delta) } : it));
  const setQtyVal = (i: number, v: number) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Math.max(1, Math.floor(v) || 1) } : it));

  const addDrop = () => { setDrops(prev => [...prev, { name: '', phone: '', address: '' }]); setActiveDrop(drops.length + 1); };
  const removeDrop = (idx: number) => {
    if (drops.length <= 1) return;
    const dropNo = idx + 1;
    setDrops(prev => prev.filter((_, i) => i !== idx));
    // reassign items: remove-drop items → drop 1; shift higher drops down
    setItems(prev => prev.map(it => it.drop === dropNo ? { ...it, drop: 1 } : it.drop > dropNo ? { ...it, drop: it.drop - 1 } : it));
    setActiveDrop(1); setChecked(false);
  };
  const patchDrop = (idx: number, key: keyof Drop, val: string) =>
    setDrops(prev => prev.map((d, i) => i === idx ? { ...d, [key]: val } : d));

  const multi = drops.length > 1;

  const dispatch = async () => {
    if (items.length === 0) { toast.error('ยังไม่มีรายการของ'); return; }
    if (drops.some(d => !d.address.trim())) { toast.error('ใส่ที่อยู่ให้ครบทุกดรอป'); return; }
    if (isFleet && vehicles.length > 0 && !vehicleId) { toast.error('เลือกรถ/ทะเบียนก่อน'); return; }
    if (!customerStaffSig || !checkerSig) { toast.error('ต้องมีลายเซ็น พนักงานจัดของ(ลูกค้า) + เช็คเกอร์'); return; }
    if (!checked) { toast.error('กรุณายืนยันว่าเช็คของครบแล้ว'); return; }
    // Driver signature + load-count confirm are OPTIONAL here: one checker serves
    // many trucks and often finishes checking before the truck arrives. The
    // driver confirms/loads later (in the TMS app); don't block the checker.
    setSubmitting(true);
    const t = toast.loading('กำลังสร้างงานและส่งขึ้นรถ...');
    try {
      const branchCode = typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('branchId') || '') : '';
      const destinations = drops.map((d, i) => ({ drop: i + 1, name: d.name, phone: d.phone, address: d.address }));

      const createRes = await fetch(getApiUrl('/api/orders'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'CROSS_DOCK',
          customerName: customer || drops[0].name,
          phone: drops[0].phone,
          shipAddress: drops[0].address,
          carrier, items, branchCode, destinations,
          vehicleType: selectedVehicle?.vehicleType || '4-Wheel',
          vehiclePlate: selectedVehicle?.plate || '',
          driverName: selectedVehicle?.driverName || '',
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok || !created.order) throw new Error(created.error || 'สร้างออเดอร์ไม่สำเร็จ');

      // Cross-dock handover signatures (dock): customer staff + checker + driver.
      // (End-customer POD is captured later in TMS at delivery.)
      const qcSignatures = {
        customerStaffSignature: customerStaffSig || undefined, customerStaffName: 'พนักงานจัดของ (ลูกค้า)',
        checkerSignature: checkerSig || undefined, checkerName: 'เช็คเกอร์',
        signedAt: new Date().toISOString(), notes: 'Cross-dock เช็คของขึ้นรถ (คนขับยืนยันจำนวนในแอป TMS)',
      };

      const shipRes = await fetch(getApiUrl('/api/orders'), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: created.order.id, status: 'SHIPPED', qcSignatures }),
      });
      const shipped = await shipRes.json();
      if (!shipRes.ok) throw new Error(shipped.error || 'ส่งขึ้นรถไม่สำเร็จ');

      toast.success(
        `✅ ${created.order.orderNo} ส่งขึ้นรถแล้ว${selectedVehicle ? ` (${selectedVehicle.plate})` : ''}${isFleet ? ' + เข้า TMS' : ''}`,
        { id: t, duration: 5000 });
      setItems([]); setCustomer(''); setDrops([{ name: '', phone: '', address: '' }]);
      setActiveDrop(1); setChecked(false); setVehicleId('');
      setCustomerStaffSig(''); setCheckerSig('');
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาด', { id: t });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-40 font-sans select-none">
      <div className="sticky top-0 z-10 bg-gradient-to-br from-cyan-600 to-blue-700 text-white px-5 pt-6 pb-5 shadow-lg">
        <div className="flex items-center gap-2 text-cyan-100 text-sm font-medium"><Truck className="w-4 h-4" /> เช็คของขึ้นรถ (Cross-Dock)</div>
        <h1 className="text-2xl font-black mt-0.5">{items.length} รายการ · {totalQty} ชิ้น{multi ? ` · ${drops.length} ดรอป` : ''}</h1>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Vehicle */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">รถ / ทะเบียน + คนขับ</div>
          {vehicles.length === 0 ? (
            <p className="text-xs text-amber-600">ยังไม่มีรถในระบบ — ให้แอดมินเพิ่มที่เมนู “รถบริษัท (Fleet)”</p>
          ) : (
            <div className="relative">
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                className="w-full appearance-none bg-slate-100 rounded-xl px-3 py-3 text-sm font-semibold outline-none">
                <option value="">— เลือกรถ —</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} · {v.driverName || 'ไม่ระบุคนขับ'} ({v.vehicleType})</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Overall customer — pick from Customer Master or type free text */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2.5 shadow-sm">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={customer}
            list="dispatch-customers"
            onChange={e => {
              const v = e.target.value;
              setCustomer(v);
              // If they picked an exact match from the list, prefill drop 1's
              // contact/address when those fields are still empty.
              const hit = customerOpts.find(c => c.name === v);
              if (hit) setDrops(prev => prev.map((d, i) => i === 0 ? {
                name: d.name || hit.name,
                phone: d.phone || hit.phone,
                address: d.address || hit.address,
              } : d));
            }}
            placeholder="ชื่อลูกค้า/งาน — เลือกจากรายชื่อหรือพิมพ์เอง (ไม่บังคับ)"
            className="w-full bg-transparent text-sm outline-none"
          />
          <datalist id="dispatch-customers">
            {customerOpts.map(c => <option key={c.id} value={c.name} />)}
          </datalist>
        </div>

        {/* Drops */}
        <div className="space-y-2.5">
          {drops.map((d, idx) => (
            <div key={idx} className={`bg-white border rounded-2xl p-3.5 shadow-sm space-y-2 ${ds(idx).border}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-black ${ds(idx).text}`}>📍 ดรอป {idx + 1}{multi ? '' : ' (จุดส่ง)'}</span>
                {drops.length > 1 && <button onClick={() => removeDrop(idx)} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <input value={d.name} onChange={e => patchDrop(idx, 'name', e.target.value)} placeholder="ชื่อผู้รับ" className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none" />
              <input value={d.phone} onChange={e => patchDrop(idx, 'phone', e.target.value)} placeholder="เบอร์โทร" inputMode="tel" className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none" />
              <textarea value={d.address} onChange={e => patchDrop(idx, 'address', e.target.value)} placeholder="ที่อยู่จัดส่ง *" rows={2} className="w-full bg-slate-100 rounded-lg px-3 py-2 text-sm outline-none resize-none" />
            </div>
          ))}
          <button onClick={addDrop} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-2xl py-2.5 text-sm font-bold active:scale-[0.99]">
            <Plus className="w-4 h-4" /> เพิ่มจุดส่ง (ดรอป)
          </button>
        </div>

        {/* Item entry */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">เพิ่มของ (ไม่ต้องมีในคลัง)</span>
            <button onClick={() => setScanOpen(true)} className="flex items-center gap-1 text-xs font-bold text-cyan-600 active:scale-95"><ScanLine className="w-4 h-4" /> สแกนยิงของ</button>
          </div>
          {multi && (
            <div className="flex items-center gap-1.5 mb-2 overflow-x-auto">
              <span className="text-xs text-slate-400 shrink-0">ใส่ลงดรอป:</span>
              {drops.map((_, i) => (
                <button key={i} onClick={() => setActiveDrop(i + 1)} className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${activeDrop === i + 1 ? ds(i).chip : 'bg-slate-100 text-slate-500'}`}>{i + 1}</button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addItem(); }} placeholder="ชื่อ/รายการของ หรือกดสแกน" className="flex-1 bg-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
            <input value={qty} onChange={e => setQty(e.target.value)} type="number" inputMode="numeric" className="w-16 bg-slate-100 rounded-xl px-2 py-2.5 text-sm text-center outline-none focus:ring-2 focus:ring-cyan-300" />
            <button onClick={addItem} className="px-3 rounded-xl bg-cyan-600 text-white active:scale-95"><Plus className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <div className="text-center py-8 text-slate-400"><PackageCheck className="w-11 h-11 mx-auto mb-2 text-slate-300" /><p className="text-sm font-semibold text-slate-500">ยังไม่มีรายการ</p></div>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3">
                {multi ? (
                  <select value={it.drop} onChange={e => setItemDrop(i, Number(e.target.value))} className={`w-12 h-9 rounded-xl text-center font-bold text-sm border outline-none ${ds(it.drop - 1).badge}`}>
                    {drops.map((_, di) => <option key={di} value={di + 1}>{di + 1}</option>)}
                  </select>
                ) : <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center font-bold shrink-0">{i + 1}</div>}
                <div className="min-w-0 flex-1"><div className="font-bold text-slate-900 truncate">{it.name}</div><div className="text-[11px] text-slate-400">1 ลาเบล = ใส่จำนวนชิ้นได้</div></div>
                {/* Qty stepper — supports "1 label = N pieces" */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => bumpQty(i, -1)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center active:scale-90"><Minus className="w-3.5 h-3.5" /></button>
                  <input value={it.qty} onChange={e => setQtyVal(i, Number(e.target.value))} type="number" inputMode="numeric" className="w-11 h-7 text-center text-sm font-bold text-cyan-600 bg-slate-50 border border-slate-200 rounded-lg outline-none" />
                  <button onClick={() => bumpQty(i, 1)} className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center active:scale-90"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                <button onClick={() => removeItem(i)} className="p-1.5 text-slate-400 hover:text-rose-600 active:scale-90 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Carrier */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">ขนส่ง</div>
          <select value={carrier} onChange={e => setCarrier(e.target.value)} className="w-full bg-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none">
            {carriers.length === 0 && <option>{carrier}</option>}
            {carriers.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
          </select>
          {isFleet ? <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> รถบริษัท — สร้างงานเข้า TMS อัตโนมัติ</p>
            : <p className="text-xs text-slate-400 mt-1.5">ขนส่งเอกชน — ไม่เข้า TMS</p>}
        </div>

        {/* ขั้น 2: ตรวจรับจากคลังลูกค้า — ลายเซ็น พนักงานจัดของ + เช็คเกอร์ */}
        {items.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
            <div className="text-[11px] font-bold text-cyan-700 uppercase tracking-wider">ขั้น 2 · ตรวจรับจากคลังลูกค้า</div>
            <div className="grid grid-cols-2 gap-3">
              {([['customer', 'พนักงานจัดของ (ลูกค้า)', customerStaffSig], ['checker', 'เช็คเกอร์ (เรา)', checkerSig]] as const).map(([role, label, sig]) => (
                <button key={role} onClick={() => setSigTarget(role as any)} className={`rounded-2xl p-3 border flex flex-col items-center gap-1 ${sig ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                  <PenLine className={`w-5 h-5 ${sig ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{label}</span>
                  <span className={`text-[10px] font-bold ${sig ? 'text-emerald-600' : 'text-slate-400'}`}>{sig ? '✓ เซ็นแล้ว' : 'แตะเพื่อเซ็น'}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setChecked(v => !v)} className={`w-full flex items-center gap-3 rounded-xl p-3 border ${checked ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${checked ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border border-slate-300'}`}>{checked && <Check className="w-4 h-4" />}</div>
              <span className="text-sm font-semibold text-left text-slate-700">เช็คของครบถ้วนตามที่ลูกค้าจัดเตรียม</span>
            </button>
          </div>
        )}

        {/* คนขับยืนยันจำนวนที่โหลด → ทำในแอป TMS (คนขับไม่ใช้แอป WMS) */}
        {items.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-700 flex items-start gap-2">
            <Truck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>คนขับยืนยันจำนวนที่โหลดจริงในแอป TMS ตอนขึ้นของ — เช็คเกอร์ไม่ต้องรอคนขับที่นี่</span>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="max-w-lg mx-auto">
            <button onClick={dispatch} disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 active:scale-[0.99] text-white font-black rounded-2xl py-4 shadow-xl shadow-cyan-600/30">
              <Truck className="w-5 h-5" />{submitting ? 'กำลังส่ง...' : `ส่งขึ้นรถ (${totalQty} ชิ้น)`}
            </button>
          </div>
        </div>
      )}

      <CameraScannerModal isOpen={scanOpen} onClose={() => setScanOpen(false)} onScan={onScanned} continuous title="สแกนยิงของขึ้นรถ" description={multi ? `กำลังใส่ลงดรอป ${activeDrop} — สแกนต่อเนื่องได้` : 'ส่องบาร์โค้ด/QR — สแกนต่อเนื่องได้'} />
      <SignatureModal isOpen={sigTarget === 'customer'} onClose={() => setSigTarget('')} docNum="ลายเซ็นพนักงานจัดของ (ลูกค้า)" onSave={async (d) => { setCustomerStaffSig(d); }} />
      <SignatureModal isOpen={sigTarget === 'checker'} onClose={() => setSigTarget('')} docNum="ลายเซ็นเช็คเกอร์" onSave={async (d) => { setCheckerSig(d); }} />
      <MobileNav />
    </div>
  );
}
