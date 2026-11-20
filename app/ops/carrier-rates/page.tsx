'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Plus, Truck, Trash2, Search, Trophy } from 'lucide-react';

interface Rate {
  id: string;
  carrier: string;
  zone: string;
  minWeight: number;
  maxWeight: number;
  price: number;
  etaDays?: number;
  active: boolean;
}
interface Option {
  carrier: string;
  zone: string;
  price: number;
  etaDays?: number;
}

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
    try {
      const d = await (await fetch('/api/carriers/rates', { cache: 'no-store' })).json();
      setRates(d.rates || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.carrier.trim() || !(Number(form.price) >= 0)) return toast.error('ใส่ชื่อขนส่ง + ราคา');
    const d = await (
      await fetch('/api/carriers/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: form.carrier,
          zone: form.zone || 'ALL',
          minWeight: Number(form.minWeight) || 0,
          maxWeight: Number(form.maxWeight) || 999999,
          price: Number(form.price),
          etaDays: form.etaDays ? Number(form.etaDays) : null,
        }),
      })
    ).json();
    if (d.success === false) return toast.error(d.error);
    toast.success('บันทึกเรตแล้ว');
    setForm({ carrier: '', zone: 'ALL', minWeight: '', maxWeight: '', price: '', etaDays: '' });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('ลบเรตนี้?')) return;
    await fetch(`/api/carriers/rates?id=${id}`, { method: 'DELETE' });
    load();
  };

  const compare = async () => {
    const d = await (
      await fetch(`/api/carriers/rate-shop?weight=${Number(weight) || 0}&zone=${encodeURIComponent(zone || 'ALL')}`, {
        cache: 'no-store',
      })
    ).json();
    setResult({ cheapest: d.cheapest, options: d.options || [] });
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Open Header */}
        <div className="space-y-2">
          <Link
            href="/ops"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>ปฏิบัติการ</span>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12 border border-sky-500/20 text-sky-700">
                <Truck className="w-5 h-5" />
              </span>
              <span>เทียบราคาขนส่ง (Rate Shopping)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              ตั้งเรตต่อขนส่ง/โซน/น้ำหนัก แล้วหาขนส่งถูกสุดอัตโนมัติ
            </p>
          </div>
        </div>

        <main className="grid md:grid-cols-2 gap-6">
          {/* compare tool */}
          <div className="nx-glass-card p-6 space-y-4">
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-sky-600" /> หาขนส่งถูกสุด
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
                placeholder="น้ำหนัก (กก.)"
                className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 tabular-nums outline-none focus:border-emerald-500"
              />
              <input
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="โซนปลายทาง (เช่น BKK, ALL)"
                className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={compare}
              className="w-full py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              <Search className="w-4 h-4" /> เทียบราคา
            </button>
            {result &&
              (result.options.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">
                  ไม่มีเรตที่ตรงเงื่อนไข (ตั้งเรตทางขวาก่อน)
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  {result.options.map((o, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-2xl px-4 py-2.5 border ${
                        i === 0
                          ? 'bg-emerald-500/10 border-emerald-500/25'
                          : 'bg-white/75 border-slate-200/80'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        {i === 0 && <Trophy className="w-4 h-4 text-emerald-600" />}
                        {o.carrier}{' '}
                        <span className="text-[11px] font-normal text-slate-500">
                          ({o.zone}
                          {o.etaDays ? ` · ${o.etaDays}วัน` : ''})
                        </span>
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          i === 0 ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        ฿{o.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
          </div>

          {/* rate management */}
          <div className="nx-glass-card p-6 space-y-4">
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-600" /> เพิ่มเรตขนส่ง
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                value={form.carrier}
                onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
                placeholder="ขนส่ง เช่น Kerry"
                className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
              />
              <input
                value={form.zone}
                onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                placeholder="โซน (ALL)"
                className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
              />
              <input
                value={form.minWeight}
                onChange={(e) => setForm((f) => ({ ...f, minWeight: e.target.value }))}
                inputMode="decimal"
                placeholder="นน.ต่ำ (กก.)"
                className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 tabular-nums outline-none focus:border-emerald-500"
              />
              <input
                value={form.maxWeight}
                onChange={(e) => setForm((f) => ({ ...f, maxWeight: e.target.value }))}
                inputMode="decimal"
                placeholder="นน.สูง (กก.)"
                className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 tabular-nums outline-none focus:border-emerald-500"
              />
              <input
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                inputMode="decimal"
                placeholder="ราคา (บาท)"
                className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 tabular-nums outline-none focus:border-emerald-500"
              />
              <input
                value={form.etaDays}
                onChange={(e) => setForm((f) => ({ ...f, etaDays: e.target.value }))}
                inputMode="numeric"
                placeholder="ETA (วัน)"
                className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 tabular-nums outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={save}
              className="w-full py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm shadow-xs transition"
            >
              บันทึกเรต
            </button>

            <div className="pt-2 max-h-64 overflow-y-auto space-y-2">
              {loading ? (
                <div className="text-center text-slate-500 py-4 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin inline text-emerald-600" />
                </div>
              ) : rates.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">ยังไม่มีเรต</div>
              ) : (
                rates.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between bg-white/80 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs"
                  >
                    <span className="min-w-0 truncate">
                      <b className="text-slate-900">{r.carrier}</b>{' '}
                      <span className="text-slate-500 tabular-nums">
                        {r.zone} · {r.minWeight}-{r.maxWeight}กก.{r.etaDays ? ` · ${r.etaDays}วัน` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono font-bold text-amber-700 tabular-nums">
                        ฿{r.price.toLocaleString()}
                      </span>
                      <button onClick={() => del(r.id)} className="text-slate-400 hover:text-rose-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
