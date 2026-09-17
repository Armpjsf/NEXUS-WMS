'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mic,
  Volume2,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  MapPin,
  Sparkles,
  Layers,
  Radio,
  Headphones
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import {
  VoicePickStep,
  sampleVoicePickTasks,
  synthesizePickSpeech,
  synthesizeConfirmSuccess,
  synthesizeErrorSpeech
} from '@/lib/voiceEngine';

export default function VoicePickingPage() {
  const [tasks, setTasks] = useState<VoicePickStep[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [checkDigitInput, setCheckDigitInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pickStatus, setPickStatus] = useState<'IDLE' | 'CORRECT' | 'WRONG'>('IDLE');
  const [isCompleted, setIsCompleted] = useState(false);

  const fetchPickTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch('/api/orders?limit=100');
      if (res.ok) {
        const json = await res.json();
        const orders = json.orders || [];
        const pendingOrders = orders.filter((o: any) => o.status === 'NEW' || o.status === 'PICKING');
        const steps: VoicePickStep[] = [];
        let stepCounter = 1;

        for (const order of pendingOrders) {
          for (const item of (order.items || [])) {
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
              checkDigit
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

  const handleConfirmPick = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentStep) return;

    if (checkDigitInput.trim() === currentStep.checkDigit) {
      setPickStatus('CORRECT');
      speakText(synthesizeConfirmSuccess(currentStep));
      toast.success(`ยืนยันหยิบสำเร็จ! (${currentStep.targetQuantity} ${currentStep.unit})`);

      setTimeout(() => {
        setCheckDigitInput('');
        setPickStatus('IDLE');
        if (currentStepIndex + 1 < tasks.length) {
          setCurrentStepIndex(prev => prev + 1);
        } else {
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
  };

  return (
    <div className="relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 font-mono text-[#dee2ec]">
      <AmbientBackground />

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="border border-[#30353d] bg-[#171c23]/90 p-5 rounded-xl shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#facc15] via-[#4cd7f6] to-[#57ec7f]" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#facc15] animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#facc15] flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5" /> VOICE-DIRECTED PICKING TERMINAL
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[#dee2ec] tracking-tight flex items-center gap-2.5">
                <span>ระบบสั่งหยิบด้วยเสียงภาษาไทย (Voice WMS)</span>
              </h1>
              <p className="text-xs text-[#8a92a6]">
                ระบบหยิบสินค้าแบบ Hands-Free ทำงานได้เร็วขึ้น ไม่ต้องก้มมองจอ ยืนยันพิกัดด้วยเลขทวนสอบ 2 หลัก (Check Digits)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { handleRestart(); fetchPickTasks(); }}
                className="px-3.5 py-2 bg-[#252a32] hover:bg-[#30353d] border border-[#30353d] hover:border-[#facc15] text-[#dee2ec] hover:text-[#facc15] rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ตงาน
              </button>
              <Link
                href="/ops/tasks"
                className="px-3.5 py-2 bg-[#12161d] hover:bg-[#252a32] border border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec] rounded-xl transition text-xs font-semibold"
              >
                กลับคิวงาน
              </Link>
            </div>
          </div>
        </div>

        {loadingTasks ? (
          <div className="p-12 text-center text-xs text-[#8a92a6] bg-[#171c23]/90 rounded-2xl border border-[#30353d]">
            กำลังค้นหาคิวงานหยิบสินค้า...
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#8a92a6] bg-[#171c23]/90 rounded-2xl border border-[#30353d] space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#57ec7f] mx-auto" />
            <h3 className="text-base font-bold text-[#dee2ec]">ไม่มีรายการคำสั่งซื้อค้างรอหยิบในระบบ</h3>
            <p>เมื่อมีคำสั่งซื้อใหม่เข้ามา ระบบเสียงสังเคราะห์จะแนะนำตำแหน่งหยิบและเลขทวนสอบโดยอัตโนมัติ</p>
            <button
              onClick={fetchPickTasks}
              className="mt-2 px-4 py-2 bg-[#252a32] hover:bg-[#30353d] border border-[#30353d] text-[#dee2ec] rounded-xl font-bold"
            >
              รีเฟรชคิวงาน
            </button>
          </div>
        ) : !isCompleted && currentStep ? (
          <div className="space-y-6">
            {/* Main Giant Pick Card for Warehouse Operators */}
            <div
              className={`p-6 md:p-8 rounded-2xl border-2 transition-all shadow-2xl backdrop-blur-xl ${
                pickStatus === 'CORRECT'
                  ? 'bg-[#0a2012]/95 text-[#57ec7f] border-[#57ec7f] shadow-[0_0_50px_rgba(87,236,127,0.25)]'
                  : pickStatus === 'WRONG'
                  ? 'bg-[#2d0e14]/95 text-[#ff6e80] border-[#ff6e80] shadow-[0_0_50px_rgba(255,110,128,0.25)]'
                  : 'bg-[#171c23]/95 text-[#dee2ec] border-[#30353d]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#30353d] pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-[#252a32] border border-[#30353d] rounded-full text-xs font-mono font-bold tracking-widest uppercase text-[#facc15]">
                    งานที่ {currentStepIndex + 1} จาก {tasks.length}
                  </span>
                  <span className="text-xs text-[#8a92a6]">Wave: WAVE-2026-B01</span>
                </div>
                <button
                  onClick={handlePlayPrompt}
                  className="px-4 py-2 bg-[#facc15] hover:bg-[#eec200] text-[#1b1600] rounded-xl font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95"
                >
                  <Volume2 className="w-4 h-4" /> {isSpeaking ? 'กำลังอ่าน...' : 'ฟังสั่งเสียงซ้ำ (Audio Repeat)'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Target Location & Visual Light */}
                <div className="space-y-4">
                  <span className="text-xs uppercase tracking-widest text-[#facc15] font-bold block">
                    พิกัดที่ต้องเดินไป (Target Location)
                  </span>
                  <div className="text-5xl md:text-6xl font-black font-mono tracking-tight text-[#dee2ec] flex items-center gap-3">
                    <MapPin className="w-10 h-10 text-[#facc15] shrink-0" />
                    <span>{currentStep.locationCode}</span>
                  </div>

                  {/* Simulated Pick-To-Light Indicator Bar */}
                  <div className="p-3 bg-[#12161d] rounded-xl border border-[#30353d] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#57ec7f] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#57ec7f]"></span>
                      </span>
                      <span className="text-xs font-semibold text-[#57ec7f]">Pick-to-Light Bay LED Active</span>
                    </div>
                    <span className="font-mono text-xs px-2.5 py-0.5 bg-[#57ec7f]/10 text-[#57ec7f] border border-[#57ec7f]/30 rounded font-bold">
                      BAY #{currentStep.checkDigit}
                    </span>
                  </div>
                </div>

                {/* Product SKU & Pick Quantity */}
                <div className="bg-[#12161d] p-6 rounded-xl border border-[#30353d] space-y-4">
                  <div>
                    <span className="text-xs text-[#8a92a6] block mb-1">รหัสสินค้า & ชื่อ</span>
                    <div className="text-xl font-bold text-[#dee2ec]">{currentStep.productName}</div>
                    <div className="text-xs font-mono text-[#4cd7f6] mt-0.5">{currentStep.sku}</div>
                  </div>

                  <div className="pt-4 border-t border-[#30353d] flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-[#8a92a6]">จำนวนที่ต้องหยิบ:</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-[#57ec7f] font-mono">{currentStep.targetQuantity}</span>
                      <span className="text-sm text-[#8a92a6] font-medium">{currentStep.unit}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operator Voice / Check Digit Confirmation */}
              <div className="mt-8 pt-6 border-t border-[#30353d] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-[#8a92a6]">
                  💡 <strong className="text-[#dee2ec]">คำแนะนำ Hands-Free:</strong> สังเกตป้ายเลขทวนสอบสีเหลืองหน้าแร็ค (Check Digit: <span className="font-mono text-[#facc15] font-bold">"{currentStep.checkDigit}"</span>) แล้วพิมพ์หรือยืนยัน
                </div>

                <form onSubmit={handleConfirmPick} className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="เลขทวนสอบ"
                    value={checkDigitInput}
                    onChange={(e) => setCheckDigitInput(e.target.value)}
                    className="px-4 py-3 bg-[#090f15] border-2 border-[#facc15] text-[#dee2ec] placeholder-[#8a92a6] rounded-xl font-mono font-bold text-center text-lg w-40 focus:outline-none focus:ring-4 focus:ring-[#facc15]/30"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#57ec7f] hover:bg-[#46c368] text-[#090f15] font-bold rounded-xl text-sm shadow-lg transition active:scale-95 flex items-center gap-2 whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-5 h-5" /> ยืนยันหยิบ (Confirm)
                  </button>
                </form>
              </div>
            </div>

            {/* Next Queue Steps Preview */}
            <div className="bg-[#171c23]/90 rounded-xl border border-[#30353d] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#dee2ec] text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#4cd7f6]" /> คิวหยิบถัดไปในรอบงานนี้
                </h3>
                <span className="text-xs text-[#8a92a6]">{tasks.length} รายการ</span>
              </div>
              <div className="divide-y divide-[#30353d]/50">
                {tasks.map((t, idx) => (
                  <div
                    key={t.stepIndex}
                    className={`py-3 flex items-center justify-between text-xs transition ${
                      idx === currentStepIndex
                        ? 'font-bold text-[#facc15]'
                        : idx < currentStepIndex
                        ? 'text-[#8a92a6] line-through'
                        : 'text-[#dee2ec]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono border ${
                        idx === currentStepIndex
                          ? 'bg-[#facc15] text-[#1b1600] border-[#facc15]'
                          : idx < currentStepIndex
                          ? 'bg-[#57ec7f]/20 text-[#57ec7f] border-[#57ec7f]/40'
                          : 'bg-[#252a32] text-[#8a92a6] border-[#30353d]'
                      }`}>
                        {idx < currentStepIndex ? '✓' : idx + 1}
                      </span>
                      <span>พิกัด: <strong className={idx === currentStepIndex ? 'text-[#facc15]' : 'text-[#4cd7f6]'}>{t.locationCode}</strong> — {t.productName}</span>
                    </div>
                    <div className="font-mono text-[#8a92a6]">
                      {t.targetQuantity} {t.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Completion Card */
          <div className="bg-[#171c23]/90 rounded-2xl border border-[#57ec7f]/40 p-12 text-center shadow-2xl space-y-5 backdrop-blur-xl">
            <div className="w-20 h-20 bg-[#57ec7f]/10 text-[#57ec7f] border border-[#57ec7f]/30 rounded-full flex items-center justify-center mx-auto text-3xl">
              🎉
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[#dee2ec]">เสร็จสิ้นการหยิบรอบนี้ครบ 100%!</h2>
              <p className="text-xs text-[#8a92a6]">
                สินค้าทั้งหมดถูกจัดลงตะกร้าเรียบร้อย สามารถส่งต่อไปยังสถานีตรวจแพ็ค (Packing QA) ได้ทันที
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => { handleRestart(); fetchPickTasks(); }}
                className="px-5 py-2.5 bg-[#252a32] hover:bg-[#30353d] border border-[#30353d] text-[#dee2ec] rounded-xl font-bold text-xs transition"
              >
                หยิบรอบถัดไป
              </button>
              <Link
                href="/ops/packing"
                className="px-6 py-2.5 bg-[#57ec7f] hover:bg-[#46c368] text-[#090f15] rounded-xl font-bold text-xs shadow transition flex items-center gap-1.5"
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
