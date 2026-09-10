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
    } catch (err: any) {
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <QrCode className="w-5 h-5 text-teal-400" />
          Quick Scan
        </h1>
        <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">
          Close
        </Link>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 relative">
        {isScanning && !scanResult && (
          <>
            <div id="mobile-scanner" className="w-full h-full"></div>
            {/* Scan Frame Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-72 border-2 border-white/30 rounded-2xl relative">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-teal-400 rounded-tl-xl"></div>
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl"></div>
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-xl"></div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl"></div>
              </div>
            </div>
            <p className="absolute bottom-8 left-0 right-0 text-center text-white/70 text-sm">
              หันกล้องไปที่บาร์โค้ดหรือ QR Code
            </p>
          </>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-center p-8">
              <Camera className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="text-rose-400 mb-4">{error}</p>
              <button
                onClick={startScanner}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold"
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
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 bg-slate-950 p-6"
            >
              {scanResult.product ? (
                <div className="h-full flex flex-col">
                  <div className="flex-1">
                    <div className="w-20 h-20 mx-auto mb-4 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                      <Package className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-center mb-2">
                      {scanResult.product.name}
                    </h2>
                    <p className="text-slate-400 text-center mb-6">
                      {scanResult.product.category}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                        <p className="text-xs text-slate-400 mb-1">สต็อก</p>
                        <p className={cn(
                          "text-3xl font-black",
                          scanResult.product.stock <= scanResult.product.minStock 
                            ? "text-rose-400" 
                            : "text-white"
                        )}>
                          {scanResult.product.stock}
                        </p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                        <p className="text-xs text-slate-400 mb-1">ตำแหน่ง</p>
                        <p className="text-lg font-bold text-white">
                          {scanResult.product.location || '-'}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/stock-card?search=${encodeURIComponent(scanResult.product.name)}`}
                      className="block w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-center font-bold flex items-center justify-center gap-2"
                    >
                      ดู Stock Card <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>

                  <button
                    onClick={scanAgain}
                    className="w-full mt-4 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold"
                  >
                    สแกนอีกครั้ง
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-20 h-20 mb-4 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                    <Search className="w-10 h-10 text-amber-400" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">ไม่พบสินค้า</h2>
                  <p className="text-slate-400 mb-6">รหัส: {scanResult.code}</p>
                  <button
                    onClick={scanAgain}
                    className="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold"
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
        <div className="bg-slate-800 p-4 rounded-t-3xl">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
            <History className="w-4 h-4" />
            ล่าสุด
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {scanHistory.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setScanResult(item)}
                className="flex-shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm"
              >
                {item.product?.name || item.code}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
