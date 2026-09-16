'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Volume2, MapPin, CheckCircle2, Mic, ScanLine, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';
import { VoicePickStep, synthesizePickSpeech, synthesizeConfirmSuccess, synthesizeErrorSpeech } from '@/lib/voiceEngine';

interface Task {
  id: string; task_type: string; sku?: string; product_name?: string;
  requested_qty?: number; source_location?: string;
}

// เลขทวนสอบ = 2 ตัวท้ายของพิกัด (เทียบกับป้ายหน้าแร็คจริง) — ถ้าไม่มีให้สแกนพิกัด/SKU ยืนยันแทน
const deriveCheckDigit = (loc?: string) => {
  const digits = (loc || '').replace(/[^0-9]/g, '');
  return digits.slice(-2) || (loc || '').slice(-2).toUpperCase() || '00';
};

export default function MobileVoicePickingPage() {
  const [steps, setSteps] = useState<(VoicePickStep & { taskId: string })[]>([]);
  const [idx, setIdx] = useState(0);
  const [check, setCheck] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'CORRECT' | 'WRONG'>('IDLE');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const spokenFor = useRef<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/tasks?status=PENDING'), { cache: 'no-store' });
      const data = await res.json();
      const picks: (VoicePickStep & { taskId: string })[] = (data.data || [])
        .filter((t: Task) => t.task_type === 'PICKING')
        .map((t: Task) => ({
          id: t.id,
          taskId: t.id,
          locationCode: t.source_location || '-',
          sku: t.sku || '',
          productName: t.product_name || t.sku || '',
          targetQuantity: Number(t.requested_qty || 0),
          unit: 'ชิ้น',
          checkDigit: deriveCheckDigit(t.source_location),
        }));
      setSteps(picks);
      setIdx(0);
    } catch { toast.error('โหลดงานหยิบไม่สำเร็จ'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH'; u.rate = 1.0;
    window.speechSynthesis.speak(u);
  }, []);

  const current = steps[idx];
  const done = !loading && steps.length > 0 && idx >= steps.length;

  // พูดคำสั่งเมื่อถึงสเต็ปใหม่
  useEffect(() => {
    if (current && spokenFor.current !== current.taskId) {
      spokenFor.current = current.taskId;
      setCheck(''); setStatus('IDLE');
      speak(synthesizePickSpeech(current));
    }
  }, [current, speak]);

  const confirm = useCallback(async (value: string) => {
    if (!current || busy) return;
    const v = value.trim().toLowerCase();
    const ok = v === current.checkDigit.toLowerCase()
      || v === current.sku.toLowerCase()
      || v === current.locationCode.toLowerCase();
    if (!ok) { setStatus('WRONG'); speak(synthesizeErrorSpeech()); return; }
    setStatus('CORRECT'); setBusy(true);
    speak(synthesizeConfirmSuccess(current));
    try {
      await fetch(getApiUrl('/api/tasks'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'COMPLETE', taskId: current.taskId, completedQty: current.targetQuantity }),
      });
    } catch { /* non-fatal */ }
    setBusy(false);
    setTimeout(() => setIdx(i => i + 1), 700);
  }, [current, busy, speak]);

  usePdaScanner({ enabled: !!current, onScan: (code) => confirm(code) });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mobile" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-95"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="font-bold text-base leading-tight flex items-center gap-1.5"><Mic className="w-4 h-4 text-amber-500" /> สั่งหยิบด้วยเสียง</h1>
            <p className="text-[11px] text-slate-500">{steps.length > 0 && !done ? `ขั้นที่ ${idx + 1} / ${steps.length}` : 'Voice Picking (ภาษาไทย)'}</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-slate-100 text-slate-500 active:scale-95"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>

      <main className="p-4">
        {loading ? (
          <p className="text-center text-slate-400 text-sm py-10">กำลังโหลด...</p>
        ) : done ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-3" />
            <p className="font-bold text-lg text-slate-900">หยิบครบทุกงานแล้ว 🎉</p>
            <button onClick={load} className="mt-5 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold active:scale-95">โหลดงานใหม่</button>
          </div>
        ) : !current ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Mic className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">ไม่มีงานหยิบในคิว</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-3xl border-2 p-6 shadow-lg transition-colors ${
              status === 'CORRECT' ? 'bg-emerald-50 border-emerald-300' : status === 'WRONG' ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'
            }`}>
              <button onClick={() => speak(synthesizePickSpeech(current))} className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold active:scale-95">
                <Volume2 className="w-4 h-4" /> ฟังคำสั่งอีกครั้ง
              </button>
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1"><MapPin className="w-4 h-4" /> ไปที่พิกัด</div>
              <div className="font-mono font-black text-3xl text-slate-900 tracking-tight">{current.locationCode}</div>
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="text-xl font-bold text-slate-900">{current.productName}</div>
                <div className="font-mono text-xs text-slate-500">{current.sku}</div>
                <div className="mt-2 text-2xl font-black text-blue-600">{current.targetQuantity} <span className="text-sm font-normal text-slate-500">{current.unit}</span></div>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              💡 สแกนป้ายพิกัด/บาร์โค้ดสินค้า หรือกรอก <b>เลขทวนสอบ</b> หน้าแร็ค (<span className="font-mono font-bold">{current.checkDigit}</span>) เพื่อยืนยัน
            </div>

            <form onSubmit={(e) => { e.preventDefault(); confirm(check); }} className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="w-5 h-5 absolute left-3 top-3.5 text-amber-500" />
                <input
                  autoFocus value={check} onChange={e => setCheck(e.target.value)} inputMode="text"
                  placeholder="สแกน / กรอกเลขทวนสอบ"
                  className="w-full pl-10 pr-3 py-3.5 bg-white border-2 border-slate-200 rounded-xl text-base font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>
              <button type="submit" disabled={busy} className="px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm active:scale-95 disabled:opacity-50">ยืนยัน</button>
            </form>

            <button onClick={() => setIdx(i => i + 1)} className="w-full py-2 text-xs text-slate-400 active:text-slate-600">ข้ามงานนี้ →</button>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
