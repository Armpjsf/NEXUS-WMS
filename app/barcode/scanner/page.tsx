'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, Camera, Search, Package, ArrowLeft, History, X, Volume2, VolumeX, Zap } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import { speakScanSuccess, speakScanMismatch, vibrateSuccess, vibrateError } from '@/lib/voiceAssistant';
import { errorMessage } from '@/lib/errors';

interface Product {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  price: number;
  category: string;
  location: string;
  image?: string;
}

interface ScanResult {
  code: string;
  product: Product | null;
  timestamp: Date;
}

export default function BarcodeScannerPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);

  void videoRef;

  // Load products for matching
  useEffect(() => {
    fetch(getApiUrl('/api/products'))
      .then(res => res.json())
      .then(data => {
        setProducts(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Initialize scanner
  const startScanner = async () => {
    setIsScanning(true);
    setError(null);

    try {
      // Dynamic import for html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode');
      
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Ignore scan errors (no code found)
        }
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setError(errorMessage(err) || 'ไม่สามารถเปิดกล้องได้');
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  };
  const handleScanSuccess = useCallback((code: string) => {
    // Find matching product
    const matchedProduct = products.find(p => 
      p.name.toLowerCase().includes(code.toLowerCase()) ||
      p.id.toLowerCase() === code.toLowerCase() ||
      code.toLowerCase().includes(p.name.toLowerCase())
    );

    if (matchedProduct) {
      vibrateSuccess();
      if (soundEnabled) {
        speakScanSuccess(matchedProduct.name, matchedProduct.stock);
      }
    } else {
      vibrateError();
      if (soundEnabled) {
        speakScanMismatch(code, 'ไม่พบสินค้าในระบบ');
      }
    }

    const result: ScanResult = {
      code,
      product: matchedProduct || null,
      timestamp: new Date()
    };

    setScanResult(result);
    setScanHistory(prev => [result, ...prev.slice(0, 9)]); // Keep last 10

    // Stop camera scanner after scan if it was active
    stopScanner();
  }, [products, soundEnabled]);

  // Hook hardware wedge / PDA scanner directly
  usePdaScanner({
    onScan: (scanned) => {
      handleScanSuccess(scanned.trim());
    },
    enabled: true,
  });

  const handleManualSearch = () => {
    if (!manualCode.trim()) return;
    handleScanSuccess(manualCode.trim());
    setManualCode('');
  };

  const clearResult = () => {
    setScanResult(null);
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen p-4 md:p-8 pb-32 text-slate-900">
      <div className="max-w-2xl mx-auto space-y-6 relative z-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          กลับหน้าหลัก
        </Link>

        {/* Open Page Header */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Scanner
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <QrCode className="w-7 h-7 text-emerald-600 shrink-0" />
              <span>Barcode Scanner</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">สแกนบาร์โค้ดหรือ QR Code เพื่อค้นหาสินค้า</p>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-2.5 rounded-full border transition-all shadow-xs",
              soundEnabled 
                ? "bg-emerald-500/12 border-emerald-500/25 text-emerald-700" 
                : "bg-white/80 border-slate-200 text-slate-500 hover:text-slate-800"
            )}
            title={soundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Hero Dark Accent Status Strip */}
        <div className="nx-dark-accent-card p-2">
          <button
            onClick={() => {
              if (isScanning) stopScanner();
            }}
            className="w-full py-2.5 px-4 rounded-2xl text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-all text-white hover:bg-white/5"
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>โหมดเลเซอร์ฮาร์ดแวร์ (Industrial Scanner Ready)</span>
          </button>
        </div>

        {/* Scanner Area */}
        <div className="nx-glass-card overflow-hidden">
          {!isScanning && !scanResult ? (
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-emerald-500/12 border border-emerald-500/25 rounded-2xl flex items-center justify-center">
                <QrCode className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">ฮาร์ดแวร์สแกนเนอร์พร้อมทำงาน</h2>
              <p className="text-slate-600 text-xs mb-5">
                ยิงด้วยปืนสแกนเนอร์ไร้สาย, PDA Zebra DataWedge, เครื่องสแกนบาร์โค้ด USB ได้ทันที
              </p>
              
              <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/12 border border-emerald-500/25 text-emerald-800 text-xs font-semibold font-mono rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>LISTENING TO SCANNER (ตรวจจับสัญญาณอัตโนมัติ)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={startScanner}
                  disabled={loading}
                  className="py-3 px-4 bg-white/85 hover:bg-white border border-slate-200 text-slate-800 font-semibold rounded-full transition-all flex items-center justify-center gap-2 text-xs shadow-xs disabled:opacity-50"
                >
                  <Camera className="w-4 h-4 text-sky-600" />
                  เปิดกล้องมือถือสแกน (Camera Mode)
                </button>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                    placeholder="ยิงหรือพิมพ์บาร์โค้ด..."
                    className="flex-1 px-4 py-2.5 bg-white/85 border border-slate-200 rounded-full text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all"
                  />
                  <button
                    onClick={handleManualSearch}
                    className="px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full transition-colors font-semibold text-xs shadow-sm"
                    aria-label="ค้นหาบาร์โค้ด"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : isScanning ? (
            <div className="relative">
              <div id="qr-reader" className="w-full" style={{ minHeight: '300px' }}></div>
              <button
                onClick={stopScanner}
                className="absolute top-4 right-4 p-2 bg-slate-900/70 text-white rounded-full hover:bg-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-md">
                  <div className="text-center p-4">
                    <p className="text-rose-600 font-semibold">{error}</p>
                    <button
                      onClick={() => { setError(null); setIsScanning(false); }}
                      className="mt-4 px-5 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold"
                    >
                      ลองอีกครั้ง
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Scan Result */}
        <AnimatePresence>
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="nx-glass-card overflow-hidden"
            >
              <div className="p-4 border-b border-slate-200/70 flex items-center justify-between bg-white/50">
                <span className="text-sm font-bold text-slate-900">ผลการสแกน</span>
                <button onClick={clearResult} className="text-slate-400 hover:text-slate-700 p-1 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {scanResult.product ? (
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-slate-100 border border-slate-200/80 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {scanResult.product.image ? (
                        <img 
                          src={`/api/proxy/image?url=${encodeURIComponent(scanResult.product.image)}`} 
                          alt={scanResult.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-lg leading-snug">{scanResult.product.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{scanResult.product.category}</p>
                      
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="bg-white/75 border border-slate-200/80 p-3 rounded-2xl">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">สต็อก</p>
                          <p className={cn(
                            "text-xl font-bold tabular-nums",
                            scanResult.product.stock <= scanResult.product.minStock ? "text-rose-600" : "text-emerald-700"
                          )}>
                            {scanResult.product.stock.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white/75 border border-slate-200/80 p-3 rounded-2xl">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">ตำแหน่ง</p>
                          <p className="text-sm font-bold font-mono text-slate-900 mt-1">{scanResult.product.location || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2.5">
                    <Link
                      href={`/inventory/stock-card?search=${encodeURIComponent(scanResult.product.name)}&sku=${encodeURIComponent(scanResult.product.id || '')}`}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full text-center text-xs transition-colors shadow-sm"
                    >
                      ดู Stock Card
                    </Link>
                    <button
                      onClick={() => { clearResult(); startScanner(); }}
                      className="px-5 py-2.5 bg-white/85 hover:bg-white border border-slate-200 text-slate-700 hover:text-slate-900 font-semibold rounded-full text-xs transition-colors shadow-xs"
                    >
                      สแกนอีกครั้ง
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-rose-500/12 border border-rose-500/25 rounded-2xl flex items-center justify-center">
                    <Search className="w-8 h-8 text-rose-600" />
                  </div>
                  <p className="font-bold text-slate-900 mb-1">ไม่พบสินค้าในระบบ</p>
                  <p className="text-xs font-mono text-slate-500 mb-5">รหัสบาร์โค้ด: {scanResult.code}</p>
                  <button
                    onClick={() => { clearResult(); startScanner(); }}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full text-xs transition-colors shadow-sm"
                  >
                    สแกนอีกครั้ง
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan History */}
        {scanHistory.length > 0 && !isScanning && (
          <div className="nx-glass-card overflow-hidden">
            <div className="p-4 border-b border-slate-200/70 flex items-center gap-2 bg-white/50">
              <History className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-slate-900">ประวัติการสแกน</span>
            </div>
            <ul className="divide-y divide-slate-200/50 max-h-60 overflow-y-auto">
              {scanHistory.map((item, idx) => (
                <li 
                  key={idx}
                  className="p-4 hover:bg-emerald-50/40 transition-colors cursor-pointer"
                  onClick={() => setScanResult(item)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">
                        {item.product?.name || item.code}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums font-mono">
                        {item.timestamp.toLocaleTimeString('th-TH')}
                      </p>
                    </div>
                    {item.product ? (
                      <span className="text-[11px] px-2.5 py-0.5 bg-emerald-500/12 text-emerald-700 border border-emerald-500/20 rounded-full font-semibold shrink-0">
                        พบสินค้า
                      </span>
                    ) : (
                      <span className="text-[11px] px-2.5 py-0.5 bg-rose-500/12 text-rose-700 border border-rose-500/20 rounded-full font-semibold shrink-0">
                        ไม่พบ
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
