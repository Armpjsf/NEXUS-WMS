'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, Camera, Package, ArrowRight, History, Search } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  location: string;
  category: string;
}

interface ScanResult {
  code: string;
  product: Product | null;
  timestamp: Date;
}

export default function MobileScanPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  // Load products
  useEffect(() => {
    fetch(getApiUrl('/api/products'))
      .then(res => res.json())
      .then(data => setProducts(data || []))
      .catch(err => console.error(err));
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Stop error:', err);
      }
    }
    setIsScanning(false);
  }, []);

  const handleScanSuccess = useCallback((code: string) => {
    // Play beep
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz tone
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // volume
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 150); // 150ms duration
    } catch (e) {
      console.error("Audio beep error:", e);
    }

    setProducts(prevProducts => {
       // Find product using latest state
       const q = (code || '').toLowerCase();
       const matchedProduct = prevProducts.find(p =>
         (p.name || '').toLowerCase().includes(q) ||
         (p.id || '').toLowerCase() === q
       );

       const result: ScanResult = {
         code,
         product: matchedProduct || null,
         timestamp: new Date()
       };

       setScanResult(result);
       setScanHistory(prev => [result, ...prev.slice(0, 4)]);
       return prevProducts;
    });
    
    stopScanner();
  }, [stopScanner]);

  const startScanner = useCallback(async () => {
    setIsScanning(true);
    setError(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode("mobile-scanner");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        (decodedText: string) => handleScanSuccess(decodedText),
        () => {}
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setError('ไม่สามารถเปิดกล้องได้');
      setIsScanning(false);
    }
  }, [handleScanSuccess]);

  // Start scanner immediately on mount
  useEffect(() => {
    startScanner();
    return () => {
      // Cleanup function need to be careful with async, usually we just flag
      if (scannerRef.current) {
         scannerRef.current.stop().catch(console.error);
      }
    };
  }, [startScanner]);

  const scanAgain = () => {
    setScanResult(null);
    startScanner();
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen text-slate-900 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <h1 className="text-base font-bold flex items-center gap-2 text-slate-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-700">
              <QrCode className="w-4 h-4" />
            </span>
            <span>Quick Scan</span>
          </h1>
          <Link
            href="/dashboard"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-full bg-white/90 border border-slate-200/80 text-slate-700 hover:text-slate-900 text-xs font-bold shadow-xs active:scale-95 transition-all"
          >
            ปิด
          </Link>
        </div>
      </header>

      {/* Scanner Area */}
      <div className="flex-1 relative p-4 max-w-lg w-full mx-auto flex flex-col">
        {isScanning && !scanResult && (
          <div className="nx-dark-accent-card flex-1 relative overflow-hidden min-h-[360px] flex flex-col justify-center">
            <div id="mobile-scanner" className="w-full h-full"></div>
            {/* Scan Frame Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/30 rounded-3xl relative">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-2 border-emerald-400 rounded-tl-2xl"></div>
                <div className="absolute -top-1 -right-1 w-8 h-8 border-2 border-amber-400 rounded-tr-2xl"></div>
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-2 border-sky-400 rounded-bl-2xl"></div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-2 border-emerald-400 rounded-br-2xl"></div>
              </div>
            </div>
            <p className="absolute bottom-6 left-4 right-4 text-center text-white/90 text-xs font-semibold bg-black/45 backdrop-blur-md py-2 px-4 rounded-full mx-auto w-fit">
              หันกล้องไปที่บาร์โค้ดหรือ QR Code
            </p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="nx-glass-card w-full text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
                <Camera className="w-8 h-8" />
              </div>
              <p className="text-rose-700 font-bold text-sm">{error}</p>
              <button
                onClick={startScanner}
                className="min-h-[44px] px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                ลองอีกครั้ง
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="flex-1 flex flex-col"
            >
              {scanResult.product ? (
                <div className="flex-1 flex flex-col gap-4">
                  <div className="nx-dark-accent-card p-6 space-y-5 flex-1">
                    <div className="w-16 h-16 mx-auto bg-emerald-500/20 border border-emerald-400/35 rounded-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-emerald-300" />
                    </div>
                    <div className="text-center space-y-1">
                      <span className="inline-block px-3 py-0.5 rounded-full bg-white/10 text-emerald-300 text-[11px] font-semibold">
                        {scanResult.product.category || 'สินค้าในคลัง'}
                      </span>
                      <h2 className="text-2xl font-bold text-white leading-snug pt-1">
                        {scanResult.product.name}
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/10 border border-white/15 rounded-2xl p-4 text-center">
                        <p className="text-xs text-slate-300 mb-1">สต็อกคงเหลือ</p>
                        <p className={cn(
                          "text-3xl font-black tabular-nums",
                          scanResult.product.stock <= scanResult.product.minStock
                            ? "text-rose-300"
                            : "text-emerald-300"
                        )}>
                          {scanResult.product.stock}
                        </p>
                      </div>
                      <div className="bg-white/10 border border-white/15 rounded-2xl p-4 text-center">
                        <p className="text-xs text-slate-300 mb-1">ตำแหน่ง</p>
                        <p className="text-lg font-bold font-mono text-amber-300 tabular-nums">
                          {scanResult.product.location || '-'}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/inventory/stock-card?search=${encodeURIComponent(scanResult.product.name)}&sku=${encodeURIComponent(scanResult.product.id || '')}`}
                      className="min-h-[48px] w-full py-3 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full text-center font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                      ดู Stock Card <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>

                  <button
                    onClick={scanAgain}
                    className="w-full min-h-[48px] py-3.5 px-5 nx-glass-card text-slate-900 hover:bg-white/95 rounded-full font-bold text-sm active:scale-[0.98] transition-all"
                  >
                    สแกนอีกครั้ง
                  </button>
                </div>
              ) : (
                <div className="nx-glass-card flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 mb-4 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center text-amber-600">
                    <Search className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-1">ไม่พบสินค้า</h2>
                  <p className="text-slate-600 text-sm font-mono mb-6 tabular-nums">รหัส: {scanResult.code}</p>
                  <button
                    onClick={scanAgain}
                    className="min-h-[44px] px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    สแกนอีกครั้ง
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History */}
      {scanHistory.length > 0 && !isScanning && !scanResult && (
        <div className="max-w-lg w-full mx-auto px-4 pb-6">
          <div className="nx-glass-card p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-3">
              <History className="w-4 h-4 text-emerald-600" />
              ล่าสุด
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {scanHistory.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setScanResult(item)}
                  className="flex-shrink-0 min-h-[40px] px-4 py-2 bg-white/90 border border-slate-200 hover:border-emerald-400 text-slate-900 rounded-full text-xs font-semibold shadow-xs"
                >
                  {item.product?.name || item.code}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
