'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Truck, MapPin, Phone, PackageCheck, CheckCircle2, RefreshCw, ChevronRight, X, PenLine, Camera } from 'lucide-react';
import SignatureModal from '@/components/SignatureModal';
import MobileNav from '@/components/MobileNav';
import { errorMessage } from '@/lib/errors';

// Convert a data URL (from the signature pad) into a File for upload.
function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

async function uploadPod(file: File, prefix: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('bucket', 'pod-images');
  fd.append('prefix', prefix);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'อัปโหลดไม่สำเร็จ');
  return json.url;
}

interface Line { sku: string; name: string; qty: number; }
interface Order {
  id: string; orderNo: string; customerName: string; phone: string; shipAddress: string;
  status: string; items: Line[]; totalQty: number; carrier: string; trackingNo: string;
  tmsJobId?: string;
}

// งานที่ยิงเข้า TMS/รถบริษัท = คนขับส่ง → POD ทำที่แอปคนขับ (TMS) ไม่ใช่งานเช็คเกอร์
function isDriverDelivered(o: Order): boolean {
  return Boolean(o.tmsJobId || (o.trackingNo && o.trackingNo.startsWith('JOB-')));
}

// Driver delivery view: SHIPPED outbound orders awaiting proof of delivery.
export default function DriverJobsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?status=SHIPPED', { cache: 'no-store' });
      const json = await res.json();
      setOrders(json.orders || []);
    } catch { toast.error('โหลดงานส่งไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen text-slate-900 pb-28 font-sans select-none">
      <div className="sticky top-0 z-10 bg-white/75 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-xs">
        <div className="max-w-lg mx-auto nx-dark-accent-card px-5 py-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              <Truck className="w-4 h-4" /> งานจัดส่ง
            </div>
            <h1 className="text-xl font-black text-white mt-0.5 tabular-nums">รอส่ง {orders.length} งาน</h1>
          </div>
          <button
            onClick={load}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white active:scale-90 transition-transform flex items-center justify-center"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {loading ? <div className="text-center text-slate-500 py-16 text-sm">กำลังโหลด...</div>
          : orders.length === 0 ? (
            <div className="nx-glass-card text-center text-slate-500 py-16 px-6">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
              <p className="font-bold text-slate-800">ไม่มีงานค้างส่ง</p>
              <p className="text-sm text-slate-500 mt-1">ออเดอร์ที่จัดส่งแล้วจะมาอยู่ที่นี่</p>
            </div>
          ) : orders.map(o => (
            <button key={o.id} onClick={() => setActive(o)} className="w-full text-left nx-glass-card p-4 active:scale-[.99] transition-transform hover:bg-white/95">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900 tabular-nums">{o.orderNo}</span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
              <div className="mt-1.5 font-bold text-slate-900">{o.customerName || 'ไม่ระบุลูกค้า'}</div>
              {o.shipAddress && <div className="mt-1 text-xs text-slate-600 flex items-start gap-1.5"><MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />{o.shipAddress}</div>}
              <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs text-slate-500">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold tabular-nums">{o.totalQty} ชิ้น</span>
                {o.carrier && (
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/12 text-sky-700 border border-sky-500/20 font-semibold">
                    {o.carrier} {o.trackingNo}
                  </span>
                )}
              </div>
            </button>
          ))}
      </div>

      {active && <PodSheet order={active} onClose={() => setActive(null)} onDone={() => { setActive(null); load(); }} />}
      <MobileNav />
    </div>
  );
}

function PodSheet({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigUrl, setSigUrl] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [busy, setBusy] = useState<'' | 'sig' | 'photo'>('');
  const driverJob = isDriverDelivered(order);

  const saveSignature = async (dataUrl: string) => {
    setBusy('sig');
    try { setSigUrl(await uploadPod(dataUrlToFile(dataUrl, 'sig.jpg'), `sig-${order.orderNo}`)); toast.success('บันทึกลายเซ็นแล้ว'); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(''); }
  };

  const capturePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy('photo');
    try { setPhotoUrl(await uploadPod(file, `photo-${order.orderNo}`)); toast.success('แนบรูปแล้ว'); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(''); e.target.value = ''; }
  };

  const deliver = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: 'DELIVERED', podNote: note, podSignature: sigUrl, podPhoto: photoUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');
      toast.success('ยืนยันส่งถึงแล้ว');
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs overflow-y-auto p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-xl border border-white/90 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-28 sm:pb-5 space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">{driverJob ? 'งานส่งโดยคนขับ' : 'มอบของให้ลูกค้า (รับที่คลัง)'}</h2>
          <button onClick={onClose} className="min-h-[36px] min-w-[36px] p-1.5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
          <div className="font-mono font-bold text-slate-900 tabular-nums">{order.orderNo}</div>
          <div className="font-bold text-slate-800 mt-1">{order.customerName}</div>
          {order.phone && <a href={`tel:${order.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-sky-700 font-semibold"><Phone className="w-4 h-4" />{order.phone}</a>}
          <div className="mt-3 space-y-1">
            {order.items.map(l => <div key={l.sku} className="flex justify-between text-sm"><span className="text-slate-600 truncate">{l.name}</span><span className="font-bold text-slate-900 tabular-nums">×{l.qty}</span></div>)}
          </div>
        </div>

        {driverJob ? (
          <>
            <div className="rounded-2xl bg-sky-500/10 border border-sky-500/25 p-4 text-sm text-sky-900 space-y-2">
              <p className="font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-sky-700" /> งานนี้ส่งโดยคนขับ (Cross-dock / รถบริษัท)</p>
              <p className="text-xs leading-relaxed">หลักฐานส่งถึง (ลายเซ็นผู้รับปลายทาง + รูป) ให้ <b>คนขับปิดที่แอปคนขับ (TMS)</b> เมื่อส่งถึงแต่ละดรอป แล้วสถานะจะซิงก์กลับ WMS อัตโนมัติ — เช็คเกอร์ไม่ต้องเซ็นที่นี่</p>
            </div>
            <button onClick={onClose} className="w-full min-h-[48px] py-3.5 rounded-full bg-slate-100 text-slate-700 font-bold active:scale-95">ปิด</button>
          </>
        ) : (
          <>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              onFocus={e => setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)}
              placeholder="ชื่อผู้มารับ / หมายเหตุ"
              rows={2}
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 font-medium text-slate-900 outline-none focus:border-emerald-500 resize-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setSigOpen(true)} disabled={busy === 'sig'}
                className={`min-h-[84px] rounded-2xl border-2 border-dashed p-3 flex flex-col items-center justify-center gap-1 transition-colors ${sigUrl ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-300 bg-slate-50'}`}>
                {sigUrl ? <img src={sigUrl} alt="ลายเซ็น" className="h-12 object-contain" /> : <PenLine className="w-6 h-6 text-slate-400" />}
                <span className="text-xs font-bold text-slate-700">{busy === 'sig' ? 'กำลังบันทึก...' : sigUrl ? 'ลายเซ็น ✓' : 'ลูกค้าเซ็นรับ'}</span>
              </button>
              <label className={`min-h-[84px] rounded-2xl border-2 border-dashed p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${photoUrl ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-300 bg-slate-50'}`}>
                {photoUrl ? <img src={photoUrl} alt="รูปมอบของ" className="h-12 object-contain rounded" /> : <Camera className="w-6 h-6 text-slate-400" />}
                <span className="text-xs font-bold text-slate-700">{busy === 'photo' ? 'กำลังอัปโหลด...' : photoUrl ? 'รูปหลักฐาน ✓' : 'ถ่ายรูปหลักฐาน'}</span>
                <input type="file" accept="image/*" capture="environment" onChange={capturePhoto} className="hidden" />
              </label>
            </div>

            <button onClick={deliver} disabled={saving} className="w-full min-h-[52px] py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base shadow-lg shadow-emerald-600/25 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              <PackageCheck className="w-5 h-5" /> {saving ? 'กำลังบันทึก...' : 'ยืนยันมอบของสำเร็จ'}
            </button>
          </>
        )}
      </div>
      <SignatureModal isOpen={sigOpen} onClose={() => setSigOpen(false)} onSave={saveSignature} docNum={order.orderNo} />
    </div>
  );
}
