'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Plus, Truck, Trash2, Search, Trophy } from 'lucide-react';

interface Rate { id: string; carrier: string; zone: string; minWeight: number; maxWeight: number; price: number; etaDays?: number; active: boolean }
interface Option { carrier: string; zone: string; price: number; etaDays?: number }

export default function CarrierRatesPage() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ carrier: '', zone: 'ALL', minWeight: '', maxWeight: '', price: '', etaDays: '' });
  // compare tool
  const [weight, setWeight] = useState('');
  const [zone, setZone] = useState('ALL');
  const [result, setResult] = useState<{ cheapest: Option | null; options: Option[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await (await fetch('/api/carriers/rates', { cache: 'no-store' })).json(); setRates(d.rates || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.carrier.trim() || !(Number(form.price) >= 0)) return toast.error('ใส่ชื่อขนส่ง + ราคา');
    const d = await (await fetch('/api/carriers/rates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrier: form.carrier, zone: form.zone || 'ALL', minWeight: Number(form.minWeight) || 0, maxWeight: Number(form.maxWeight) || 999999, price: Number(form.price), etaDays: form.etaDays ? Number(form.etaDays) : null }),
    })).json();
    if (d.success === false) return toast.error(d.error);
    toast.success('บันทึกเรตแล้ว'); setForm({ carrier: '', zone: 'ALL', minWeight: '', maxWeight: '', price: '', etaDays: '' }); load();
  };

  const del = async (id: string) => {
    if (!confirm('ลบเรตนี้?')) return;
    await fetch(`/api/carriers/rates?id=${id}`, { method: 'DELETE' }); load();
  };

  const compare = async () => {
    const d = await (await fetch(`/api/carriers/rate-shop?weight=${Number(weight) || 0}&zone=${encodeURIComponent(zone || 'ALL')}`, { cache: 'no-store' })).json();
    setResult({ cheapest: d.cheapest, options: d.options || [] });
  };

  return (
    <div className="min-h-screen bg-[#0f141b] text-[#dee2ec] pb-16">
      <header className="sticky top-0 z-20 bg-[#0f141b]/95 backdrop-blur border-b border-[#30353d] px-5 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/ops" className="p-2 rounded-xl bg-[#1b2027] border border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec]"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="font-headline font-black text-lg text-[#facc15] flex items-center gap-2"><Truck className="w-5 h-5" /> เทียบราคาขนส่ง (Rate Shopping)</h1>
            <p className="text-[11px] text-[#8a92a6] font-mono">ตั้งเรตต่อขนส่ง/โซน/น้ำหนัก แล้วหาขนส่งถูกสุดอัตโนมัติ</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 grid md:grid-cols-2 gap-5">
        {/* compare tool */}
        <div className="bg-[#171c23] border border-[#30353d] rounded-2xl p-5 space-y-3">
          <div className="text-sm font-bold text-[#d1c6ab] flex items-center gap-2"><Search className="w-4 h-4" /> หาขนส่งถูกสุด</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={weight} onChange={e => setWeight(e.target.value)} inputMode="decimal" placeholder="น้ำหนัก (กก.)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#4cd7f6]" />
            <input value={zone} onChange={e => setZone(e.target.value)} placeholder="โซนปลายทาง (เช่น BKK, ALL)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4cd7f6]" />
          </div>
          <button onClick={compare} className="w-full py-2.5 rounded-xl bg-[#4cd7f6] text-[#04222b] font-bold text-sm flex items-center justify-center gap-1.5"><Search className="w-4 h-4" /> เทียบราคา</button>
          {result && (
            result.options.length === 0 ? <div className="text-xs text-[#8a92a6] text-center py-3">ไม่มีเรตที่ตรงเงื่อนไข (ตั้งเรตทางขวาก่อน)</div> : (
              <div className="space-y-1.5 pt-1">
                {result.options.map((o, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${i === 0 ? 'bg-[#57ec7f]/10 border-[#57ec7f]/30' : 'bg-[#1b2027] border-[#30353d]'}`}>
                    <span className="flex items-center gap-1.5 text-sm font-bold">{i === 0 && <Trophy className="w-3.5 h-3.5 text-[#57ec7f]" />}{o.carrier} <span className="text-[11px] text-[#8a92a6]">({o.zone}{o.etaDays ? ` · ${o.etaDays}วัน` : ''})</span></span>
                    <span className={`font-mono font-black ${i === 0 ? 'text-[#57ec7f]' : 'text-[#dee2ec]'}`}>฿{o.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* rate management */}
        <div className="bg-[#171c23] border border-[#30353d] rounded-2xl p-5 space-y-3">
          <div className="text-sm font-bold text-[#d1c6ab] flex items-center gap-2"><Plus className="w-4 h-4" /> เพิ่มเรตขนส่ง</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} placeholder="ขนส่ง เช่น Kerry" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#facc15]" />
            <input value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} placeholder="โซน (ALL)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#facc15]" />
            <input value={form.minWeight} onChange={e => setForm(f => ({ ...f, minWeight: e.target.value }))} inputMode="decimal" placeholder="นน.ต่ำ (กก.)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#facc15]" />
            <input value={form.maxWeight} onChange={e => setForm(f => ({ ...f, maxWeight: e.target.value }))} inputMode="decimal" placeholder="นน.สูง (กก.)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#facc15]" />
            <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} inputMode="decimal" placeholder="ราคา (บาท)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#facc15]" />
            <input value={form.etaDays} onChange={e => setForm(f => ({ ...f, etaDays: e.target.value }))} inputMode="numeric" placeholder="ETA (วัน)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#facc15]" />
          </div>
          <button onClick={save} className="w-full py-2 rounded-lg bg-[#facc15] text-[#1b1600] font-bold text-sm">บันทึกเรต</button>

          <div className="pt-2 max-h-64 overflow-y-auto space-y-1.5">
            {loading ? <div className="text-center text-[#8a92a6] py-4"><RefreshCw className="w-4 h-4 animate-spin inline" /></div>
              : rates.length === 0 ? <div className="text-xs text-[#8a92a6] text-center py-4">ยังไม่มีเรต</div>
              : rates.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-[#1b2027] border border-[#30353d] rounded-lg px-3 py-2 text-xs">
                  <span className="min-w-0 truncate"><b className="text-[#dee2ec]">{r.carrier}</b> <span className="text-[#8a92a6]">{r.zone} · {r.minWeight}-{r.maxWeight}กก.{r.etaDays ? ` · ${r.etaDays}วัน` : ''}</span></span>
                  <span className="flex items-center gap-2 shrink-0"><span className="font-mono font-bold text-[#facc15]">฿{r.price.toLocaleString()}</span><button onClick={() => del(r.id)} className="text-[#8a92a6] hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></span>
                </div>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
