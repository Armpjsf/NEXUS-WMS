'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, Camera, Search, Package, ArrowLeft, History, X, Volume2, VolumeX, Zap } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import { speakScanSuccess, speakScanMismatch, vibrateSuccess, vibrateError } from '@/lib/voiceAssistant';

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
        (errorMessage) => {
          // Ignore scan errors (no code found)
        }
      );
    } catch (err: any) {
      console.error('Scanner error:', err);
      setError(err.message || 'ไม่สามารถเปิดกล้องได้');
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
    <div className="relative min-h-screen p-4 md:p-8 pb-32">
      <AmbientBackground />

      <div className="max-w-2xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 bg-[#171c23] border border-[#30353d] rounded-xl text-[#8a92a6] hover:text-[#d1c6ab] hover:border-[#30353d] transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-[#dee2ec] flex items-center gap-2">
                <QrCode className="w-6 h-6 text-[#facc15]" />
                Barcode Scanner
              </h1>
              <p className="text-sm text-[#d1c6ab]">สแกนบาร์โค้ดหรือ QR Code เพื่อค้นหาสินค้า</p>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-2 rounded-xl border transition-all",
              soundEnabled 
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600" 
                : "bg-[#1b2027] border-[#30353d] text-[#8a92a6]"
            )}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex p-1 bg-[#171c23] border border-[#30353d] rounded-2xl gap-1">
          <button
            onClick={() => {
              if (isScanning) stopScanner();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all bg-[#252a32] text-[#dee2ec] border border-[#30353d]"
          >
            <Zap className="w-4 h-4 text-[#57ec7f]" />
            <span>โหมดเลเซอร์ฮาร์ดแวร์ (Industrial Scanner Ready)</span>
          </button>
        </div>

        {/* Scanner Area */}
        <div className="bg-[#171c23] rounded-2xl border border-[#30353d] overflow-hidden shadow-lg">
          {!isScanning && !scanResult ? (
            <div className="p-8 text-center font-mono">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#facc15]/10 border border-[#facc15]/30 rounded-2xl flex items-center justify-center">
                <QrCode className="w-10 h-10 text-[#facc15]" />
              </div>
              <h2 className="text-lg font-bold text-[#dee2ec] mb-1">ฮาร์ดแวร์สแกนเนอร์พร้อมทำงาน</h2>
              <p className="text-[#8a92a6] text-xs mb-5">
                ยิงด้วยปืนสแกนเนอร์ไร้สาย, PDA Zebra DataWedge, เครื่องสแกนบาร์โค้ด USB ได้ทันที
              </p>
              
              <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-2 bg-[#57ec7f]/10 border border-[#57ec7f]/30 text-[#57ec7f] text-xs font-bold rounded-xl">
                <span className="w-2 h-2 rounded-full bg-[#57ec7f] animate-ping" />
                <Zap className="w-4 h-4 text-[#57ec7f]" />
                <span>LISTENING TO SCANNER (ตรวจจับสัญญาณอัตโนมัติ)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={startScanner}
                  disabled={loading}
                  className="py-3.5 px-4 bg-[#252a32] hover:bg-[#30353d] border border-[#30353d] text-[#dee2ec] font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Camera className="w-4 h-4 text-[#4cd7f6]" />
                  เปิดกล้องมือถือสแกน (Camera Mode)
                </button>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                    placeholder="ยิงหรือพิมพ์บาร์โค้ด..."
                    className="flex-1 px-3 py-2 bg-[#090f15] border border-[#30353d] rounded-xl text-xs text-[#dee2ec] placeholder-[#8a92a6]/50 focus:border-[#facc15] outline-none"
                  />
                  <button
                    onClick={handleManualSearch}
                    className="px-3.5 bg-[#facc15] hover:bg-[#ffe083] text-[#1b1600] rounded-xl transition-colors font-bold text-xs"
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
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#171c23]">
                  <div className="text-center p-4">
                    <p className="text-rose-500 font-medium">{error}</p>
                    <button
                      onClick={() => { setError(null); setIsScanning(false); }}
                      className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg"
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
              className="bg-[#171c23] rounded-3xl border border-[#30353d] overflow-hidden shadow-sm"
            >
              <div className="p-4 border-b border-[#30353d] flex items-center justify-between bg-[#1b2027]">
                <span className="text-sm font-bold text-[#d1c6ab]">ผลการสแกน</span>
                <button onClick={clearResult} className="text-[#8a92a6] hover:text-[#d1c6ab]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {scanResult.product ? (
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-[#252a32] rounded-xl flex items-center justify-center flex-shrink-0">
                      {scanResult.product.image ? (
                        <img 
                          src={`/api/proxy/image?url=${encodeURIComponent(scanResult.product.image)}`} 
                          alt={scanResult.product.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-[#8a92a6]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-[#dee2ec] text-lg">{scanResult.product.name}</h3>
                      <p className="text-sm text-[#8a92a6]">{scanResult.product.category}</p>
                      
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="bg-[#1b2027] p-3 rounded-xl">
                          <p className="text-xs text-[#8a92a6]">สต็อก</p>
                          <p className={cn(
                            "text-xl font-black",
                            scanResult.product.stock <= scanResult.product.minStock ? "text-rose-500" : "text-[#dee2ec]"
                          )}>
                            {scanResult.product.stock}
                          </p>
                        </div>
                        <div className="bg-[#1b2027] p-3 rounded-xl">
                          <p className="text-xs text-[#8a92a6]">ตำแหน่ง</p>
                          <p className="text-sm font-bold text-[#d1c6ab]">{scanResult.product.location || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 font-mono">
                    <Link
                      href={`/inventory/stock-card?search=${encodeURIComponent(scanResult.product.name)}&sku=${encodeURIComponent(scanResult.product.id || '')}`}
                      className="flex-1 py-2.5 bg-[#facc15] hover:bg-[#ffe083] text-[#1b1600] font-bold rounded-xl text-center text-xs transition-colors shadow-md"
                    >
                      ดู Stock Card
                    </Link>
                    <button
                      onClick={() => { clearResult(); startScanner(); }}
                      className="px-4 py-2.5 bg-[#252a32] hover:bg-[#30353d] border border-[#30353d] text-[#d1c6ab] font-bold rounded-xl text-xs transition-colors"
                    >
                      สแกนอีกครั้ง
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center font-mono">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[#facc15]/10 border border-[#facc15]/30 rounded-2xl flex items-center justify-center">
                    <Search className="w-8 h-8 text-[#facc15]" />
                  </div>
                  <p className="font-bold text-[#dee2ec] mb-1">ไม่พบสินค้าในระบบ</p>
                  <p className="text-xs text-[#8a92a6] mb-4">รหัสบาร์โค้ด: {scanResult.code}</p>
                  <button
                    onClick={() => { clearResult(); startScanner(); }}
                    className="px-6 py-2.5 bg-[#252a32] hover:bg-[#30353d] border border-[#30353d] text-[#dee2ec] font-bold rounded-xl text-xs transition-colors"
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
          <div className="bg-[#171c23] rounded-3xl border border-[#30353d] overflow-hidden">
            <div className="p-4 border-b border-[#30353d] flex items-center gap-2 bg-[#1b2027]">
              <History className="w-4 h-4 text-[#8a92a6]" />
              <span className="text-sm font-bold text-[#d1c6ab]">ประวัติการสแกน</span>
            </div>
            <ul className="divide-y divide-[#30353d] max-h-60 overflow-y-auto">
              {scanHistory.map((item, idx) => (
                <li 
                  key={idx}
                  className="p-4 hover:bg-[#1b2027] transition-colors cursor-pointer"
                  onClick={() => setScanResult(item)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#dee2ec]">
                        {item.product?.name || item.code}
                      </p>
                      <p className="text-xs text-[#8a92a6]">
                        {item.timestamp.toLocaleTimeString('th-TH')}
                      </p>
                    </div>
                    {item.product && (
                      <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-600 rounded-lg font-bold">
                        พบสินค้า
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
