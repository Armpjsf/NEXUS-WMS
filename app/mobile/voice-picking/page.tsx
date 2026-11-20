'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Volume2, MapPin, CheckCircle2, Mic, ScanLine, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';
import { VoicePickStep, synthesizePickSpeech, synthesizeConfirmSuccess, synthesizeErrorSpeech } from '@/lib/voiceEngine';
import { speakThai, primeVoice } from '@/lib/voiceAssistant';

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
    primeVoice();
    speakThai(text);
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
    <div className="theme-nexus-hybrid min-h-screen text-slate-900 pb-28 font-sans select-none">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/mobile"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs active:scale-95 transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-base text-slate-900 leading-tight flex items-center gap-2 truncate">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-700 shrink-0">
                  <Mic className="w-4 h-4" />
                </span>
                <span className="truncate">สั่งหยิบด้วยเสียง</span>
              </h1>
              <p className="text-[11px] text-slate-600 tabular-nums truncate">
                {steps.length > 0 && !done ? `ขั้นที่ ${idx + 1} / ${steps.length}` : 'Voice Picking (ภาษาไทย)'}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-600 hover:text-slate-900 shadow-xs active:scale-95 transition-all shrink-0"
            aria-label="รีเฟรช"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {loading ? (
          <div className="nx-glass-card p-10 text-center text-slate-500 text-sm">กำลังโหลด...</div>
        ) : done ? (
          <div className="nx-glass-card flex flex-col items-center justify-center py-16 px-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <p className="font-bold text-lg text-slate-900">หยิบครบทุกงานแล้ว</p>
            <button
              onClick={load}
              className="mt-2 min-h-[44px] px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold active:scale-95 transition-all shadow-sm"
            >
              โหลดงานใหม่
            </button>
          </div>
        ) : !current ? (
          <div className="nx-glass-card flex flex-col items-center justify-center py-16 px-6 text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
              <Mic className="w-7 h-7" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">ไม่มีงานหยิบในคิว</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`nx-dark-accent-card p-6 transition-all ${
              status === 'CORRECT' ? 'ring-2 ring-emerald-400' : status === 'WRONG' ? 'ring-2 ring-rose-400' : ''
            }`}>
              <div className="flex items-center justify-between gap-2 mb-4">
                <button
                  onClick={() => speak(synthesizePickSpeech(current))}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/20 border border-amber-300/35 text-amber-200 text-xs font-bold active:scale-95 transition-all"
                >
                  <Volume2 className="w-4 h-4" /> ฟังคำสั่งอีกครั้ง
                </button>
                {status !== 'IDLE' && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    status === 'CORRECT'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                      : 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                  }`}>
                    {status === 'CORRECT' ? 'ยืนยันถูกต้อง' : 'เลขไม่ตรง'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1">
                <MapPin className="w-4 h-4 text-amber-300" /> ไปที่พิกัด
              </div>
              <div className="font-mono font-black text-3xl text-amber-300 tracking-tight tabular-nums">
                {current.locationCode}
              </div>
              <div className="mt-4 pt-4 border-t border-white/15">
                <div className="text-xl font-bold text-white leading-snug">{current.productName}</div>
                <div className="font-mono text-xs text-slate-300 mt-0.5">{current.sku}</div>
                <div className="mt-2.5 text-3xl font-black text-emerald-300 tabular-nums">
                  {current.targetQuantity} <span className="text-sm font-semibold text-slate-300">{current.unit}</span>
                </div>
              </div>
            </div>

            <div className="nx-glass-card p-3.5 text-xs text-amber-900 bg-amber-50/90 border border-amber-200/80">
              สแกนป้ายพิกัด/บาร์โค้ดสินค้า หรือกรอก <b className="font-bold">เลขทวนสอบ</b> หน้าแร็ค (<span className="font-mono font-bold tabular-nums">{current.checkDigit}</span>) เพื่อยืนยัน
            </div>

            <form onSubmit={(e) => { e.preventDefault(); confirm(check); }} className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-amber-600" />
                <input
                  autoFocus
                  value={check}
                  onChange={e => setCheck(e.target.value)}
                  inputMode="text"
                  placeholder="สแกน / กรอกเลขทวนสอบ"
                  className="w-full min-h-[48px] pl-11 pr-4 py-3 bg-white/90 border-2 border-slate-200/80 rounded-full text-base font-bold font-mono text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[48px] px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50 transition-all"
              >
                ยืนยัน
              </button>
            </form>

            <button
              onClick={() => setIdx(i => i + 1)}
              className="w-full min-h-[44px] py-3 rounded-full text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors"
            >
              ข้ามงานนี้ →
            </button>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
