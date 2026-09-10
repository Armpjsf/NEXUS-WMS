'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, SwitchCamera, Zap, Volume2, VolumeX, CheckCircle2, RefreshCw, Keyboard } from 'lucide-react';
import { triggerHaptic } from '@/lib/voiceAssistant';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  description?: string;
  continuous?: boolean;
}

export default function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'สแกนบาร์โค้ด / QR Code',
  description = 'ส่องกล้องไปที่บาร์โค้ดหรือ QR Code บนตัวสินค้าหรือกล่องพัสดุ',
  continuous = false,
}: CameraScannerModalProps) {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const scannerRef = useRef<any>(null);
  const readerId = useRef(`qr-reader-${Math.random().toString(36).slice(2, 7)}`);
  // Dedup/throttle via refs — the html5-qrcode success callback captures a stale
  // render closure, so reading state there never dedups. Refs are stable and
  // always current, so they gate the flood of ~10-30 callbacks/second.
  const lastCodeRef = useRef<string | null>(null);
  const lastTimeRef = useRef(0);
  const audioCtxRef = useRef<any>(null);

  // Play audio beep. Reuse ONE AudioContext (creating one per scan leaks and
  // eventually throws when the browser's context limit is hit).
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // ignore audio context restrictions
    }
  };

  const handleDecoded = (decodedText: string) => {
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    // Ref-based dedup: skip the same code within 1.5s, and hard-throttle ANY
    // scan to at most one per 700ms so continuous mode can't flood.
    const now = Date.now();
    if (now - lastTimeRef.current < 700) return;
    if (cleanCode === lastCodeRef.current && now - lastTimeRef.current < 1500) return;
    lastCodeRef.current = cleanCode;
    lastTimeRef.current = now;

    playBeep();
    triggerHaptic('success');
    setLastScanned(cleanCode);

    onScan(cleanCode);

    if (!continuous) {
      onClose();
    }
  };

  const submitManual = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    handleDecoded(clean);
    setManualCode('');
  };

  useEffect(() => {
    let isMounted = true;

    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).then(() => {
          try { scannerRef.current?.clear(); } catch {}
          scannerRef.current = null;
        });
      }
      return;
    }

    setIsStarting(true);
    setError(null);
    setLastScanned(null);

    const initScanner = async () => {
      try {
        // Check secure context and mediaDevices availability first
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const isSecure = typeof window !== 'undefined' && (window.isSecureContext || isLocalhost);
        
        if (!isSecure && typeof window !== 'undefined' && window.location.protocol !== 'https:') {
          setError(`เบราว์เซอร์บล็อกการเปิดกล้องผ่าน HTTP (${window.location.hostname})\nChrome/Safari อนุญาตให้เปิดกล้องเฉพาะ HTTPS หรือ localhost เท่านั้น\n(สามารถพิมพ์รหัสบาร์โค้ดด้านล่างเพื่อทำงานต่อได้ทันที)`);
          setIsStarting(false);
          return;
        }

        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Camera Stream\n(ไม่มีกล้องเว็บแคม หรือยังไม่ได้อนุญาตสิทธิ์การใช้งาน)');
          setIsStarting(false);
          return;
        }

        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        // Ensure container exists
        const container = document.getElementById(readerId.current);
        if (!container) return;

        const scanner = new Html5Qrcode(readerId.current);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode },
          {
            fps: 12,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) handleDecoded(decodedText);
          },
          () => {
            // ignore scan frame errors
          }
        );

        if (isMounted) setIsStarting(false);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Camera Scanner Error:', err);
        const raw = String(err?.message || err || '');
        if (raw.includes('streaming not supported') || raw.includes('NotAllowedError') || raw.includes('Permission denied')) {
          setError('ไม่สามารถเปิดกล้องได้ (เบราว์เซอร์ปฏิเสธสิทธิ์ หรือไม่มีอุปกรณ์กล้อง)\nสามารถพิมพ์รหัสบาร์โค้ดด้านล่างนี้แทนได้ครับ');
        } else {
          setError(raw || 'ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งานกล้องในเบราว์เซอร์');
        }
        setIsStarting(false);
      }
    };

    // Small delay to ensure modal DOM is mounted
    const timer = setTimeout(initScanner, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).then(() => {
          try { scannerRef.current?.clear(); } catch {}
          scannerRef.current = null;
        });
      }
      try { audioCtxRef.current?.close(); } catch {}
      audioCtxRef.current = null;
      lastCodeRef.current = null;
      lastTimeRef.current = 0;
    };
  }, [isOpen, facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{title}</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowManual(!showManual)}
                  className={`p-2 rounded-xl transition-colors ${showManual ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'}`}
                  title="เปิด/ปิดช่องพิมพ์รหัสเอง"
                >
                  <Keyboard className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                  title={soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                  title="สลับกล้องหน้า/หลัง"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewport Area */}
            <div className="relative w-full bg-black aspect-square flex items-center justify-center overflow-hidden">
              <div id={readerId.current} className="w-full h-full" />

              {/* Laser animation and target box */}
              {!error && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative w-64 h-64 border-2 border-emerald-500/60 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] flex flex-col justify-between p-2">
                    {/* Corners */}
                    <div className="flex justify-between">
                      <span className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                      <span className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                    </div>
                    {/* Laser line */}
                    <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse my-auto" />
                    <div className="flex justify-between">
                      <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                      <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isStarting && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 gap-3">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-300">กำลังเชื่อมต่อกล้อง...</p>
                </div>
              )}

              {/* Error View with Built-in Manual Barcode Input */}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 p-5 text-center z-20 overflow-y-auto">
                  <div className="w-11 h-11 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2 shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-rose-300 font-bold whitespace-pre-line leading-relaxed max-w-xs mb-3">
                    {error}
                  </p>

                  {/* Immediate Manual Barcode Entry */}
                  <div className="w-full max-w-xs bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-left mb-3">
                    <label className="text-[11px] font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>พิมพ์รหัสบาร์โค้ด / SKU:</span>
                    </label>
                    <form onSubmit={submitManual} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={e => setManualCode(e.target.value)}
                        placeholder="ระบุรหัสบาร์โค้ด แล้วกดส่ง..."
                        autoFocus
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={!manualCode.trim()}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shrink-0"
                      >
                        ส่งรหัส
                      </button>
                    </form>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setIsStarting(true);
                        setFacingMode(prev => prev);
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>ลองใหม่</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      ปิดหน้าต่าง
                    </button>
                  </div>
                </div>
              )}

              {/* Last Scanned Tag overlay */}
              {lastScanned && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="absolute bottom-4 inset-x-4 bg-emerald-600/95 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2 justify-center backdrop-blur-md z-30"
                >
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <span className="text-xs font-black truncate">สแกนสำเร็จ: {lastScanned}</span>
                </motion.div>
              )}
            </div>

            {/* Footer with Expandable Manual Input */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-900/90 flex flex-col gap-2.5">
              {showManual && (
                <form onSubmit={submitManual} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    placeholder="พิมพ์รหัสบาร์โค้ด / SKU..."
                    autoFocus
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shrink-0"
                  >
                    ส่งรหัส
                  </button>
                </form>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>รองรับปืนสแกนไร้สาย (PDA Laser)</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-xs"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
