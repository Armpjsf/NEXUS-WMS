'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Truck, Plus, Trash2, Check, X, User, MapPin, Phone, PackageCheck, ScanLine, PenLine } from 'lucide-react';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import SignatureModal from '@/components/SignatureModal';
import { getApiUrl } from '@/lib/config';

interface Item { sku: string; name: string; qty: number }
interface Carrier { code: string; name: string; isDefault?: boolean }

// Cross-dock dispatch: goods are checked at the dock and loaded straight onto
// the truck — no warehouse stock involved. Enter items freely (custom), confirm
// the check, pick the fleet, and ship. Shipping with a company-fleet carrier
// auto-creates the delivery job in TMS.
export default function MobileDispatchPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [carrier, setCarrier] = useState<string>('รถขนส่งบริษัท (จัดส่งเอง)');

  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');

  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [scanOpen, setScanOpen] = useState(false);
  const [sigTarget, setSigTarget] = useState<'' | 'sender' | 'receiver'>('');
  const [senderSig, setSenderSig] = useState('');
  const [receiverSig, setReceiverSig] = useState('');

  const loadCarriers = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/carriers'), { cache: 'no-store' });
      const data = await res.json();
      const list: Carrier[] = data.carriers || [];
      setCarriers(list);
      const def = list.find(c => c.isDefault) || list.find(c => /บริษัท|จัดส่งเอง|fleet/i.test(c.name)) || list[0];
      if (def) setCarrier(def.name);
    } catch { /* keep default */ }
  }, []);
  useEffect(() => { loadCarriers(); }, [loadCarriers]);

  const addItem = () => {
    const n = name.trim();
    const q = Number(qty);
    if (!n) { toast.error('ใส่ชื่อ/รายการของ'); return; }
    if (!q || q <= 0) { toast.error('จำนวนไม่ถูกต้อง'); return; }
    setItems(prev => [...prev, { sku: `XD-${Date.now().toString().slice(-6)}`, name: n, qty: q }]);
    setName(''); setQty('1');
    setChecked(false);
  };
  const removeItem = (i: number) => { setItems(prev => prev.filter((_, idx) => idx !== i)); setChecked(false); };

  const onScanned = (code: string) => {
    const c = (code || '').trim();
    if (!c) return;
    setItems(prev => [...prev, { sku: `XD-${Date.now().toString().slice(-6)}`, name: c, qty: 1 }]);
    setChecked(false);
    toast.success(`เพิ่ม: ${c}`);
  };

  const isFleet = /บริษัท|จัดส่งเอง|fleet/i.test(carrier);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  const dispatch = async () => {
    if (items.length === 0) { toast.error('ยังไม่มีรายการของ'); return; }
    if (!address.trim()) { toast.error('ใส่ที่อยู่จัดส่ง'); return; }
    if (!checked) { toast.error('กรุณายืนยันว่าเช็คของครบแล้ว'); return; }
    setSubmitting(true);
    const t = toast.loading('กำลังสร้างงานและส่งขึ้นรถ...');
    try {
      const branchCode = typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('branchId') || '')
        : '';

      // 1) Create the cross-dock order (custom items, no stock).
      const createRes = await fetch(getApiUrl('/api/orders'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'CROSS_DOCK', customerName: customer, phone, shipAddress: address,
          carrier, items, branchCode,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok || !created.order) throw new Error(created.error || 'สร้างออเดอร์ไม่สำเร็จ');

      // 2) Ship immediately → triggers TMS job for company-fleet carriers.
      //    Attach handover signatures (staff = ผู้ส่ง, client = ผู้รับ) if captured.
      const qcSignatures = (senderSig || receiverSig) ? {
        staffSignature: senderSig || undefined,
        staffName: 'ผู้ส่ง (พนักงาน)',
        clientSignature: receiverSig || undefined,
        clientName: customer || 'ผู้รับ',
        signedAt: new Date().toISOString(),
        notes: 'Cross-dock เช็คของขึ้นรถ',
      } : undefined;
      const shipRes = await fetch(getApiUrl('/api/orders'), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: created.order.id, status: 'SHIPPED', ...(qcSignatures ? { qcSignatures } : {}) }),
      });
      const shipped = await shipRes.json();
      if (!shipRes.ok) throw new Error(shipped.error || 'ส่งขึ้นรถไม่สำเร็จ');

      toast.success(
        `✅ ${created.order.orderNo} ส่งขึ้นรถแล้ว${isFleet ? ' + ส่งเข้า TMS' : ''}`,
        { id: t, duration: 5000 }
      );
      // reset
      setItems([]); setCustomer(''); setPhone(''); setAddress(''); setChecked(false);
      setSenderSig(''); setReceiverSig('');
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาด', { id: t });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-40 font-sans select-none">
      <div className="sticky top-0 z-10 bg-gradient-to-br from-cyan-600 to-blue-700 text-white px-5 pt-6 pb-5 shadow-lg">
        <div className="flex items-center gap-2 text-cyan-100 text-sm font-medium">
          <Truck className="w-4 h-4" /> เช็คของขึ้นรถ (Cross-Dock)
        </div>
        <h1 className="text-2xl font-black mt-0.5">{items.length} รายการ · {totalQty} ชิ้น</h1>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Customer / destination */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-2.5">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="ชื่อลูกค้า/ผู้รับ" className="w-full bg-transparent text-sm outline-none" />
          </div>
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="เบอร์โทร (ไม่บังคับ)" inputMode="tel" className="w-full bg-transparent text-sm outline-none" />
          </div>
          <div className="flex items-start gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="ที่อยู่จัดส่ง *" rows={2} className="w-full bg-transparent text-sm outline-none resize-none" />
          </div>
        </div>

        {/* Quick item entry */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">เพิ่มรายการของ (ไม่ต้องมีในคลัง)</span>
            <button onClick={() => setScanOpen(true)} className="flex items-center gap-1 text-xs font-bold text-cyan-600 active:scale-95 transition-transform">
              <ScanLine className="w-4 h-4" /> สแกนยิงของ
            </button>
          </div>
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
              placeholder="ชื่อ/รายการของ หรือกดสแกน" className="flex-1 bg-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300" />
            <input value={qty} onChange={e => setQty(e.target.value)} type="number" inputMode="numeric"
              className="w-16 bg-slate-100 rounded-xl px-2 py-2.5 text-sm text-center outline-none focus:ring-2 focus:ring-cyan-300" />
            <button onClick={addItem} className="px-3 rounded-xl bg-cyan-600 text-white active:scale-95 transition-transform"><Plus className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <PackageCheck className="w-11 h-11 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">ยังไม่มีรายการ</p>
            <p className="text-xs">พิมพ์ชื่อของ + จำนวน แล้วกด +</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center font-bold shrink-0">{i + 1}</div>
                <div className="min-w-0 flex-1"><div className="font-bold text-slate-900 truncate">{it.name}</div>
                  <div className="text-xs text-slate-500">จำนวน <strong className="text-cyan-600">{it.qty}</strong> ชิ้น</div></div>
                <button onClick={() => removeItem(i)} className="p-2 text-slate-400 hover:text-rose-600 active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></button>
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
          {isFleet
            ? <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> รถบริษัท — จะสร้างงานส่งเข้า TMS อัตโนมัติ</p>
            : <p className="text-xs text-slate-400 mt-1.5">ขนส่งเอกชน — ไม่เข้า TMS</p>}
        </div>

        {/* Handover signatures (optional) */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setSigTarget('sender')}
              className={`rounded-2xl p-3.5 border flex flex-col items-center gap-1.5 transition-all ${senderSig ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'}`}>
              <PenLine className={`w-5 h-5 ${senderSig ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="text-xs font-bold text-slate-700">ลายเซ็นผู้ส่ง</span>
              {senderSig ? <span className="text-[10px] text-emerald-600 font-bold">✓ เซ็นแล้ว</span> : <span className="text-[10px] text-slate-400">แตะเพื่อเซ็น</span>}
            </button>
            <button onClick={() => setSigTarget('receiver')}
              className={`rounded-2xl p-3.5 border flex flex-col items-center gap-1.5 transition-all ${receiverSig ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'}`}>
              <PenLine className={`w-5 h-5 ${receiverSig ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="text-xs font-bold text-slate-700">ลายเซ็นผู้รับ</span>
              {receiverSig ? <span className="text-[10px] text-emerald-600 font-bold">✓ เซ็นแล้ว</span> : <span className="text-[10px] text-slate-400">แตะเพื่อเซ็น</span>}
            </button>
          </div>
        )}

        {/* QC check confirm */}
        {items.length > 0 && (
          <button onClick={() => setChecked(v => !v)}
            className={`w-full flex items-center gap-3 rounded-2xl p-3.5 border transition-all ${checked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'}`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${checked ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 border border-slate-300'}`}>
              {checked && <Check className="w-4 h-4" />}
            </div>
            <span className="text-sm font-semibold text-left text-slate-700">เช็คของครบถ้วน พร้อมขึ้นรถแล้ว</span>
          </button>
        )}
      </div>

      {/* Dispatch bar */}
      {items.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="max-w-lg mx-auto">
            <button onClick={dispatch} disabled={submitting || !checked}
              className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 active:scale-[0.99] text-white font-black rounded-2xl py-4 shadow-xl shadow-cyan-600/30 transition-all">
              <Truck className="w-5 h-5" />
              {submitting ? 'กำลังส่ง...' : `ส่งขึ้นรถ (${totalQty} ชิ้น)`}
            </button>
          </div>
        </div>
      )}

      {/* Scan items */}
      <CameraScannerModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={onScanned}
        continuous
        title="สแกนยิงของขึ้นรถ"
        description="ส่องกล้องไปที่บาร์โค้ด/QR บนตัวสินค้าหรือกล่อง — สแกนต่อเนื่องได้"
      />

      {/* Signatures */}
      <SignatureModal
        isOpen={sigTarget === 'sender'}
        onClose={() => setSigTarget('')}
        docNum={`ผู้ส่ง${customer ? ' → ' + customer : ''}`}
        onSave={async (dataUrl) => { setSenderSig(dataUrl); }}
      />
      <SignatureModal
        isOpen={sigTarget === 'receiver'}
        onClose={() => setSigTarget('')}
        docNum={`ผู้รับ${customer ? ': ' + customer : ''}`}
        onSave={async (dataUrl) => { setReceiverSig(dataUrl); }}
      />

      <MobileNav />
    </div>
  );
}
