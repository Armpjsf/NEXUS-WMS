'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Volume2,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  MapPin,
  Layers,
  Headphones,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  VoicePickStep,
  synthesizePickSpeech,
  synthesizeConfirmSuccess,
  synthesizeErrorSpeech,
} from '@/lib/voiceEngine';

type ExtendedVoicePickStep = VoicePickStep & {
  orderId?: string;
  orderNo?: string;
};

export default function VoicePickingPage() {
  const [tasks, setTasks] = useState<ExtendedVoicePickStep[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [checkDigitInput, setCheckDigitInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pickStatus, setPickStatus] = useState<'IDLE' | 'CORRECT' | 'WRONG'>('IDLE');
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedOrderIds, setCompletedOrderIds] = useState<string[]>([]);

  const fetchPickTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch('/api/orders?limit=100');
      if (res.ok) {
        const json = await res.json();
        const orders = json.orders || [];
        const pendingOrders = orders.filter((o: any) => o.status === 'NEW' || o.status === 'PICKING');
        const steps: ExtendedVoicePickStep[] = [];
        let stepCounter = 1;

        for (const order of pendingOrders) {
          for (const item of order.items || []) {
            const loc = item.location || 'A-01-01';
            const numPart = loc.replace(/\D/g, '');
            const checkDigit = numPart.length >= 2 ? numPart.slice(-2) : '12';
            steps.push({
              stepIndex: stepCounter++,
              locationCode: loc,
              sku: item.sku,
              productName: item.name || item.sku,
              targetQuantity: Number(item.qty || 1),
              unit: item.unit || 'ชิ้น',
              checkDigit,
              orderId: order.id,
              orderNo: order.orderNo || order.id,
            });
          }
        }
        setTasks(steps);
      }
    } catch (e) {
      console.error('Failed to load voice pick tasks:', e);
    } finally {
      setLoadingTasks(false);
    }
  };

  React.useEffect(() => {
    fetchPickTasks();
  }, []);

  const currentStep = tasks[currentStepIndex];

  // Function to speak Thai text using Web Speech API
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('เบราว์เซอร์นี้ไม่รองรับระบบเสียงสังเคราะห์ (Speech Synthesis)');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handlePlayPrompt = () => {
    if (!currentStep) return;
    const prompt = synthesizePickSpeech(currentStep);
    speakText(prompt);
  };

  const markOrdersPicked = async (orderIds: string[]) => {
    const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)));
    for (const orderId of uniqueIds) {
      if (completedOrderIds.includes(orderId)) continue;
      try {
        const res = await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: orderId, status: 'PICKED' }),
        });
        if (res.ok) {
          setCompletedOrderIds((prev) => (prev.includes(orderId) ? prev : [...prev, orderId]));
        }
      } catch (err) {
        console.error(`Failed to mark order ${orderId} as PICKED:`, err);
      }
    }
  };

  const handleConfirmPick = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentStep) return;

    if (checkDigitInput.trim() === currentStep.checkDigit) {
      setPickStatus('CORRECT');
      speakText(synthesizeConfirmSuccess(currentStep));
      toast.success(`ยืนยันหยิบสำเร็จ! (${currentStep.targetQuantity} ${currentStep.unit})`);

      // Check if this step completes all items for currentStep.orderId
      if (currentStep.orderId) {
        const hasMoreStepsForOrder = tasks
          .slice(currentStepIndex + 1)
          .some((t) => t.orderId === currentStep.orderId);
        if (!hasMoreStepsForOrder) {
          void markOrdersPicked([currentStep.orderId]);
        }
      }

      setTimeout(async () => {
        setCheckDigitInput('');
        setPickStatus('IDLE');
        if (currentStepIndex + 1 < tasks.length) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          const allOrderIds = Array.from(
            new Set(tasks.map((t) => t.orderId).filter((id): id is string => Boolean(id)))
          );
          await markOrdersPicked(allOrderIds);
          setIsCompleted(true);
          speakText('ยินดีด้วยค่ะ คุณหยิบสินค้าในรอบนี้ครบทุกรายการเรียบร้อยแล้ว');
        }
      }, 1400);
    } else {
      setPickStatus('WRONG');
      speakText(synthesizeErrorSpeech());
      toast.error('เลขทวนสอบไม่ตรงกับพิกัด กรุณาตรวจสอบป้ายหน้าแร็ค');
      setTimeout(() => setPickStatus('IDLE'), 1800);
    }
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
    setIsCompleted(false);
    setCheckDigitInput('');
    setPickStatus('IDLE');
    setCompletedOrderIds([]);
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Open Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <Headphones className="w-3 h-3 text-amber-600" />
                Voice-Directed Picking Terminal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              ระบบสั่งหยิบด้วยเสียงภาษาไทย (Voice WMS)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              ระบบหยิบสินค้าแบบ Hands-Free ทำงานได้เร็วขึ้น ไม่ต้องก้มมองจอ ยืนยันพิกัดด้วยเลขทวนสอบ 2 หลัก (Check Digits)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleRestart();
                fetchPickTasks();
              }}
              className="px-4 py-2 bg-white/85 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 rounded-full shadow-xs transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> รีเซ็ตงาน
            </button>
            <Link
              href="/ops/tasks"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-sm transition text-xs font-semibold"
            >
              กลับคิวงาน
            </Link>
          </div>
        </div>

        {loadingTasks ? (
          <div className="nx-glass-card p-12 text-center text-xs text-slate-600">กำลังค้นหาคิวงานหยิบสินค้า...</div>
        ) : tasks.length === 0 ? (
          <div className="nx-glass-card p-12 text-center text-xs text-slate-600 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">ไม่มีรายการคำสั่งซื้อค้างรอหยิบในระบบ</h3>
            <p>เมื่อมีคำสั่งซื้อใหม่เข้ามา ระบบเสียงสังเคราะห์จะแนะนำตำแหน่งหยิบและเลขทวนสอบโดยอัตโนมัติ</p>
            <button
              onClick={fetchPickTasks}
              className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-semibold shadow-xs transition"
            >
              รีเฟรชคิวงาน
            </button>
          </div>
        ) : !isCompleted && currentStep ? (
          <div className="space-y-6">
            {/* Main Giant Pick Card for Warehouse Operators */}
            <div
              className={`nx-glass-card p-6 md:p-8 transition-all ${
                pickStatus === 'CORRECT'
                  ? 'ring-2 ring-emerald-500 bg-emerald-50/90'
                  : pickStatus === 'WRONG'
                  ? 'ring-2 ring-rose-500 bg-rose-50/90'
                  : ''
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <span className="px-3.5 py-1 bg-amber-500/15 border border-amber-500/25 rounded-full text-xs font-mono font-bold tracking-wider uppercase text-amber-800 tabular-nums">
                    งานที่ {currentStepIndex + 1} จาก {tasks.length}
                  </span>
                  {currentStep && <span className="text-xs font-mono text-slate-500">SKU: {currentStep.sku}</span>}
                </div>
                <button
                  onClick={handlePlayPrompt}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
                >
                  <Volume2 className="w-4 h-4" />{' '}
                  {isSpeaking ? 'กำลังอ่าน...' : 'ฟังสั่งเสียงซ้ำ (Audio Repeat)'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Target Location & Visual Light (1 Dark Accent Card for ultra-high bay contrast) */}
                <div className="nx-dark-accent-card p-6 space-y-4">
                  <span className="text-xs uppercase tracking-widest text-amber-300 font-bold block">
                    พิกัดที่ต้องเดินไป (Target Location)
                  </span>
                  <div className="text-4xl md:text-5xl font-bold font-mono tracking-tight text-white flex items-center gap-3 tabular-nums">
                    <MapPin className="w-9 h-9 text-amber-400 shrink-0" />
                    <span>{currentStep.locationCode}</span>
                  </div>

                  {/* Simulated Pick-To-Light Indicator Bar */}
                  <div className="p-3 bg-white/10 rounded-2xl border border-white/15 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                      </span>
                      <span className="text-xs font-semibold text-emerald-300">Pick-to-Light Bay LED Active</span>
                      <span
                        className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-bold text-amber-300"
                        title="ยังไม่ได้ต่อไฟชั้นวางจริง"
                      >
                        ทดลอง
                      </span>
                    </div>
                    <span className="font-mono text-xs px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full font-bold tabular-nums">
                      BAY #{currentStep.checkDigit}
                    </span>
                  </div>
                </div>

                {/* Product SKU & Pick Quantity */}
                <div className="bg-white/85 p-6 rounded-2xl border border-slate-200/80 space-y-4">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block mb-1">รหัสสินค้า & ชื่อ</span>
                    <div className="text-xl font-bold text-slate-900">{currentStep.productName}</div>
                    <div className="text-xs font-mono text-sky-700 font-semibold mt-0.5">{currentStep.sku}</div>
                  </div>

                  <div className="pt-4 border-t border-slate-200/70 flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-slate-600">จำนวนที่ต้องหยิบ:</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-emerald-700 font-mono tabular-nums">
                        {currentStep.targetQuantity}
                      </span>
                      <span className="text-sm text-slate-600 font-medium">{currentStep.unit}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operator Voice / Check Digit Confirmation */}
              <div className="mt-8 pt-6 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-600">
                  💡 <strong className="text-slate-900">คำแนะนำ Hands-Free:</strong> สังเกตป้ายเลขทวนสอบหน้าแร็ค
                  (Check Digit:{' '}
                  <span className="font-mono text-amber-700 font-bold">&quot;{currentStep.checkDigit}&quot;</span>)
                  แล้วพิมพ์หรือยืนยัน
                </div>

                <form onSubmit={handleConfirmPick} className="flex items-center gap-2.5 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="เลขทวนสอบ"
                    value={checkDigitInput}
                    onChange={(e) => setCheckDigitInput(e.target.value)}
                    className="px-4 py-2.5 bg-white border-2 border-amber-500 text-slate-900 placeholder-slate-400 rounded-full font-mono font-bold text-center text-lg w-40 tabular-nums focus:outline-none focus:ring-4 focus:ring-amber-500/20"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full text-sm shadow-sm transition active:scale-95 flex items-center gap-2 whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-5 h-5" /> ยืนยันหยิบ (Confirm)
                  </button>
                </form>
              </div>
            </div>

            {/* Next Queue Steps Preview */}
            <div className="nx-glass-card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-600" /> คิวหยิบถัดไปในรอบงานนี้
                </h3>
                <span className="text-xs text-slate-500 tabular-nums">{tasks.length} รายการ</span>
              </div>
              <div className="divide-y divide-slate-200/70">
                {tasks.map((t, idx) => (
                  <div
                    key={t.stepIndex}
                    className={`py-3 flex items-center justify-between text-xs transition ${
                      idx === currentStepIndex
                        ? 'font-bold text-amber-800'
                        : idx < currentStepIndex
                        ? 'text-slate-400 line-through'
                        : 'text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono border tabular-nums ${
                          idx === currentStepIndex
                            ? 'bg-amber-500 text-slate-900 border-amber-500 font-bold'
                            : idx < currentStepIndex
                            ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {idx < currentStepIndex ? '✓' : idx + 1}
                      </span>
                      <span>
                        พิกัด:{' '}
                        <strong
                          className={`font-mono ${idx === currentStepIndex ? 'text-amber-700' : 'text-sky-700'}`}
                        >
                          {t.locationCode}
                        </strong>{' '}
                        — {t.productName}
                      </span>
                    </div>
                    <div className="font-mono text-slate-600 tabular-nums">
                      {t.targetQuantity} {t.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Completion Card */
          <div className="nx-glass-card p-12 text-center space-y-5">
            <div className="w-20 h-20 bg-emerald-500/12 text-emerald-600 border border-emerald-500/25 rounded-full flex items-center justify-center mx-auto text-3xl">
              🎉
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-900">เสร็จสิ้นการหยิบรอบนี้ครบ 100%!</h2>
              <p className="text-xs text-slate-600">
                สินค้าทั้งหมดถูกจัดลงตะกร้าเรียบร้อย สามารถส่งต่อไปยังสถานีตรวจแพ็ค (Packing QA) ได้ทันที
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  handleRestart();
                  fetchPickTasks();
                }}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 rounded-full font-semibold text-xs shadow-xs transition"
              >
                หยิบรอบถัดไป
              </button>
              <Link
                href="/ops/packing"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold text-xs shadow-sm transition flex items-center gap-1.5"
              >
                ไปแท่นตรวจแพ็ค (Packing QA) <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
