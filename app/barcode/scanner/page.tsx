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
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <QrCode className="w-6 h-6 text-indigo-600" />
                Barcode Scanner
              </h1>
              <p className="text-sm text-slate-500">สแกนบาร์โค้ดหรือ QR Code เพื่อค้นหาสินค้า</p>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-2 rounded-xl border transition-all",
              soundEnabled 
                ? "bg-indigo-50 border-indigo-200 text-indigo-600" 
                : "bg-slate-50 border-slate-200 text-slate-400"
            )}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Scanner Area */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          {!isScanning && !scanResult ? (
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-indigo-50 rounded-2xl flex items-center justify-center">
                <Camera className="w-10 h-10 text-indigo-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">พร้อมสแกน</h2>
              <p className="text-slate-500 text-sm mb-4">กดปุ่มด้านล่างเพื่อเปิดกล้อง หรือยิงด้วยปืนสแกนไร้สาย / PDA ได้ทันที</p>
              
              <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>PDA Scanner Gun Ready (สแกนได้ทันที ไม่ต้องคลิกโฟกัส)</span>
              </div>

              <button
                onClick={startScanner}
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                เปิดกล้องสแกน
              </button>

              {/* Manual Input */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-3">หรือพิมพ์รหัสสินค้า</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                    placeholder="พิมพ์ชื่อหรือรหัสสินค้า..."
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                  <button
                    onClick={handleManualSearch}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                  >
                    <Search className="w-5 h-5" />
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
                <div className="absolute inset-0 flex items-center justify-center bg-white/90">
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
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-sm font-bold text-slate-600">ผลการสแกน</span>
                <button onClick={clearResult} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {scanResult.product ? (
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      {scanResult.product.image ? (
                        <img 
                          src={`/api/proxy/image?url=${encodeURIComponent(scanResult.product.image)}`} 
                          alt={scanResult.product.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-lg">{scanResult.product.name}</h3>
                      <p className="text-sm text-slate-500">{scanResult.product.category}</p>
                      
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-xs text-slate-400">สต็อก</p>
                          <p className={cn(
                            "text-xl font-black",
                            scanResult.product.stock <= scanResult.product.minStock ? "text-rose-500" : "text-slate-900"
                          )}>
                            {scanResult.product.stock}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-xs text-slate-400">ตำแหน่ง</p>
                          <p className="text-sm font-bold text-slate-700">{scanResult.product.location || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/stock-card?search=${encodeURIComponent(scanResult.product.name)}`}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-center transition-colors"
                    >
                      ดู Stock Card
                    </Link>
                    <button
                      onClick={() => { clearResult(); startScanner(); }}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                      สแกนอีกครั้ง
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center">
                    <Search className="w-8 h-8 text-amber-500" />
                  </div>
                  <p className="font-medium text-slate-800 mb-1">ไม่พบสินค้า</p>
                  <p className="text-sm text-slate-500 mb-4">รหัส: {scanResult.code}</p>
                  <button
                    onClick={() => { clearResult(); startScanner(); }}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
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
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
              <History className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-bold text-slate-600">ประวัติการสแกน</span>
            </div>
            <ul className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {scanHistory.map((item, idx) => (
                <li 
                  key={idx}
                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setScanResult(item)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">
                        {item.product?.name || item.code}
                      </p>
                      <p className="text-xs text-slate-400">
                        {item.timestamp.toLocaleTimeString('th-TH')}
                      </p>
                    </div>
                    {item.product && (
                      <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-600 rounded-lg font-bold">
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
