'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Truck, MapPin, Phone, PackageCheck, CheckCircle2, RefreshCw, ChevronRight, X, PenLine, Camera, FileText } from 'lucide-react';
import SignatureModal from '@/components/SignatureModal';

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
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-10 bg-gradient-to-br from-cyan-600 to-blue-700 text-white px-5 pt-6 pb-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-100 text-sm font-medium"><Truck className="w-4 h-4" /> งานจัดส่ง</div>
            <h1 className="text-2xl font-black mt-0.5">รอส่ง {orders.length} งาน</h1>
          </div>
          <button onClick={load} className="p-2.5 rounded-full bg-white/15 active:scale-90 transition-transform"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? <div className="text-center text-slate-400 py-16">กำลังโหลด...</div>
          : orders.length === 0 ? (
            <div className="text-center text-slate-400 py-20">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
              <p className="font-bold text-slate-600">ไม่มีงานค้างส่ง</p>
              <p className="text-sm">ออเดอร์ที่จัดส่งแล้วจะมาอยู่ที่นี่</p>
            </div>
          ) : orders.map(o => (
            <button key={o.id} onClick={() => setActive(o)} className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 shadow-sm active:scale-[.99] transition-transform">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900">{o.orderNo}</span>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
              <div className="mt-1.5 font-bold text-slate-800">{o.customerName || 'ไม่ระบุลูกค้า'}</div>
              {o.shipAddress && <div className="mt-1 text-sm text-slate-500 flex items-start gap-1.5"><MapPin className="w-4 h-4 shrink-0 mt-0.5" />{o.shipAddress}</div>}
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                <span>{o.totalQty} ชิ้น</span>
                {o.carrier && <span className="text-cyan-600 font-medium">{o.carrier} {o.trackingNo}</span>}
              </div>
            </button>
          ))}
      </div>

      {active && <PodSheet order={active} onClose={() => setActive(null)} onDone={() => { setActive(null); load(); }} />}
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

  const saveSignature = async (dataUrl: string) => {
    setBusy('sig');
    try { setSigUrl(await uploadPod(dataUrlToFile(dataUrl, 'sig.jpg'), `sig-${order.orderNo}`)); toast.success('บันทึกลายเซ็นแล้ว'); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(''); }
  };

  const capturePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy('photo');
    try { setPhotoUrl(await uploadPod(file, `photo-${order.orderNo}`)); toast.success('แนบรูปแล้ว'); }
    catch (err: any) { toast.error(err.message); } finally { setBusy(''); e.target.value = ''; }
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
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">ยืนยันส่งถึง</h2>
          <button onClick={onClose} className="p-2 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4">
          <div className="font-mono font-bold text-slate-900">{order.orderNo}</div>
          <div className="font-bold text-slate-700 mt-1">{order.customerName}</div>
          {order.phone && <a href={`tel:${order.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-cyan-600 font-medium"><Phone className="w-4 h-4" />{order.phone}</a>}
          <div className="mt-3 space-y-1">
            {order.items.map(l => <div key={l.sku} className="flex justify-between text-sm"><span className="text-slate-600 truncate">{l.name}</span><span className="font-bold text-slate-800">×{l.qty}</span></div>)}
          </div>
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="ผู้รับ / หมายเหตุการส่ง (เช่น ฝากไว้หน้าบ้าน)" rows={2}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-cyan-500 resize-none" />

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setSigOpen(true)} disabled={busy === 'sig'}
            className={`rounded-2xl border-2 border-dashed p-3 flex flex-col items-center justify-center gap-1 transition-colors ${sigUrl ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
            {sigUrl ? <img src={sigUrl} alt="ลายเซ็น" className="h-12 object-contain" /> : <PenLine className="w-6 h-6 text-slate-400" />}
            <span className="text-xs font-bold text-slate-600">{busy === 'sig' ? 'กำลังบันทึก...' : sigUrl ? 'ลายเซ็น ✓' : 'เซ็นรับ'}</span>
          </button>
          <label className={`rounded-2xl border-2 border-dashed p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${photoUrl ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
            {photoUrl ? <img src={photoUrl} alt="รูปส่ง" className="h-12 object-contain rounded" /> : <Camera className="w-6 h-6 text-slate-400" />}
            <span className="text-xs font-bold text-slate-600">{busy === 'photo' ? 'กำลังอัปโหลด...' : photoUrl ? 'รูปหลักฐาน ✓' : 'ถ่ายรูป'}</span>
            <input type="file" accept="image/*" capture="environment" onChange={capturePhoto} className="hidden" />
          </label>
        </div>

        <button onClick={deliver} disabled={saving} className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
          <PackageCheck className="w-6 h-6" /> {saving ? 'กำลังบันทึก...' : 'ยืนยันส่งสำเร็จ'}
        </button>
      </div>
      <SignatureModal isOpen={sigOpen} onClose={() => setSigOpen(false)} onSave={saveSignature} docNum={order.orderNo} />
    </div>
  );
}
