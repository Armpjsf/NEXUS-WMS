'use client';

import { getApiUrl } from '@/lib/config';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, RefreshCw, MapPin, Package, Wifi, WifiOff, X, Tag, Boxes, ScanLine } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import MobileNav from '@/components/MobileNav';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { usePullToRefresh, PullIndicator } from '@/components/ui/PullToRefresh';

interface Product {
  id?: string; // = SKU (product API maps sku -> id)
  name: string;
  category?: string;
  stock?: number;
  location?: string;
  image?: string;
  unit?: string;
  price?: number;
}

interface BinRow { binCode: string; quantity: number; lotNo?: string }
interface UomRow { code: string; name?: string; factor: number; isBase?: boolean }

export default function MobileInventoryPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [bins, setBins] = useState<BinRow[] | null>(null);
  const [binsLoading, setBinsLoading] = useState(false);
  const [uoms, setUoms] = useState<UomRow[] | null>(null);

  // Load per-bin breakdown + pack hierarchy (UOM) whenever a product detail opens.
  useEffect(() => {
    const sku = selected?.id;
    if (!sku) { setBins(null); setUoms(null); return; }
    let cancelled = false;
    setBinsLoading(true);
    setBins(null);
    setUoms(null);
    fetch(getApiUrl(`/api/stock/bins?sku=${encodeURIComponent(sku)}`), { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!cancelled) setBins(Array.isArray(d.bins) ? d.bins : []); })
      .catch(() => { if (!cancelled) setBins([]); })
      .finally(() => { if (!cancelled) setBinsLoading(false); });
    fetch(getApiUrl(`/api/products/uoms?sku=${encodeURIComponent(sku)}`), { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!cancelled) setUoms(Array.isArray(d.uoms) ? d.uoms : []); })
      .catch(() => { if (!cancelled) setUoms([]); });
    return () => { cancelled = true; };
  }, [selected?.id]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch(getApiUrl('/api/products'), { cache: 'no-store' });
      if (res.ok) setIsConnected(true);
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch (e) {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const stopScan = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const onScanned = useCallback((code: string) => {
    const text = (code || '').trim();
    stopScan();
    // Jump straight to the product if we can match it; otherwise search by code
    const match = products.find((p) =>
      p.name?.toLowerCase() === text.toLowerCase() ||
      p.name?.toLowerCase().includes(text.toLowerCase())
    );
    if (match) {
      setSelected(match);
      setQuery('');
    } else {
      setQuery(text);
    }
  }, [products, stopScan]);

  const startScan = useCallback(async () => {
    setScanError(null);
    setScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      // Wait a tick so the target div is mounted
      await new Promise((r) => setTimeout(r, 50));
      const scanner = new Html5Qrcode('inv-scanner');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 180 } },
        (decoded: string) => onScanned(decoded),
        () => {}
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setScanError('ไม่สามารถเปิดกล้องได้');
      setScanning(false);
    }
  }, [onScanned]);

  useEffect(() => () => { if (scannerRef.current) scannerRef.current.stop().catch(() => {}); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q)
    );
  }, [products, query]);

  const ptr = usePullToRefresh(fetchProducts);

  return (
    <div className="relative min-h-screen pb-24 bg-slate-50/50" style={ptr.rootStyle} {...ptr.bind}>
      <AmbientBackground />
      <PullIndicator pullDistance={ptr.pullDistance} refreshing={ptr.refreshing} />
      <div className="relative z-10 max-w-lg mx-auto p-4 md:p-6" style={ptr.contentStyle}>

        {/* Header */}
        <div className="mb-4 bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-white/50 shadow-sm sticky top-2 z-20">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('menu_inventory')}</h1>
              <div className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border mt-1 ${isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? t('online') : t('offline')}
              </div>
            </div>
            <button onClick={fetchProducts} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-500 shadow-sm active:scale-95">
              <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {/* Search + Scan */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาสินค้า / ตำแหน่ง..."
                className="w-full h-12 pl-12 pr-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>
            <button
              onClick={startScan}
              className="shrink-0 h-12 w-12 flex items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 transition-all"
              title="สแกนบาร์โค้ด"
            >
              <ScanLine className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">กำลังโหลด...</div>
        ) : (
          <>
            <div className="text-xs text-slate-400 font-bold px-2 mb-3">{filtered.length} รายการ</div>
            <div className="space-y-2">
              {filtered.map((p, idx) => {
                const low = typeof p.stock === 'number' && p.stock <= 0;
                return (
                  <button key={p.name + idx} onClick={() => setSelected(p)} className="w-full text-left bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3 active:scale-[0.99] transition-transform">
                    {p.image ? (
                      <img src={`/api/proxy/image?url=${encodeURIComponent(p.image)}`} alt="" className="w-12 h-12 rounded-xl bg-slate-100 object-cover border border-slate-100 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-900 font-bold text-sm truncate">{p.name}</div>
                      <div className="text-[11px] text-orange-600 font-bold flex items-center gap-1 mt-0.5 w-fit bg-orange-50 px-1.5 py-0.5 rounded-lg border border-orange-100">
                        <MapPin className="w-3 h-3" /> {p.location || '-'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black text-xl leading-none ${low ? 'text-red-500' : 'text-slate-900'}`}>{p.stock ?? '-'}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{p.unit || t('stock_label') || 'คงเหลือ'}</div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm">ไม่พบสินค้า</div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Product detail bottom-sheet */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg bg-white rounded-t-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <div className="flex items-center gap-4 mt-2">
                {selected.image ? (
                  <img src={`/api/proxy/image?url=${encodeURIComponent(selected.image)}`} alt="" className="w-20 h-20 rounded-2xl bg-slate-100 object-cover border border-slate-100" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100"><Package className="w-8 h-8" /></div>
                )}
                <div className="min-w-0">
                  <div className="text-lg font-black text-slate-900 leading-tight">{selected.name}</div>
                  {selected.category && <div className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1"><Tag className="w-3 h-3" /> {selected.category}</div>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 text-slate-400 hover:text-slate-600 shrink-0"><X className="w-6 h-6" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1"><Boxes className="w-3 h-3" /> คงเหลือ</div>
                <div className={`text-2xl font-black ${typeof selected.stock === 'number' && selected.stock <= 0 ? 'text-red-500' : 'text-slate-900'}`}>{selected.stock ?? '-'} <span className="text-sm text-slate-400 font-medium">{selected.unit || ''}</span></div>
              </div>
              <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                <div className="text-[10px] uppercase font-bold text-orange-400 flex items-center gap-1 mb-1"><MapPin className="w-3 h-3" /> ตำแหน่งหลัก</div>
                <div className="text-2xl font-black text-orange-700">{selected.location || '-'}</div>
              </div>
            </div>

            {/* Pack hierarchy (UOM) */}
            {uoms && uoms.length > 1 && (
              <div className="mt-4">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-2">
                  <Boxes className="w-3 h-3" /> หน่วยบรรจุ (Pack Hierarchy)
                </div>
                <div className="flex flex-wrap gap-2">
                  {uoms.map((u, i) => (
                    <span key={u.code + i} className={`text-xs rounded-lg px-2.5 py-1.5 border ${u.isBase ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
                      <b>{u.name || u.code}</b>{!u.isBase && <span className="text-[11px] opacity-80"> = {u.factor} {uoms[0]?.name || 'ชิ้น'}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Per-bin breakdown (multi-location stock) */}
            <div className="mt-4">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-2">
                <Boxes className="w-3 h-3" /> กระจายตามพิกัด (Bin)
              </div>
              {binsLoading ? (
                <div className="text-xs text-slate-400 py-2">กำลังโหลด...</div>
              ) : !bins || bins.length === 0 ? (
                <div className="text-xs text-slate-400 py-2">ยังไม่มีข้อมูลแยกพิกัด</div>
              ) : (
                <div className="space-y-1.5">
                  {bins.map((b, i) => (
                    <div key={b.binCode + i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                      <span className="flex items-center gap-1.5 text-sm font-mono text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />{b.binCode}
                        {b.lotNo ? <span className="text-[10px] text-slate-400">L:{b.lotNo}</span> : null}
                      </span>
                      <span className={`text-sm font-black ${b.quantity <= 0 ? 'text-slate-300' : 'text-slate-900'}`}>
                        {b.quantity} <span className="text-[10px] text-slate-400 font-medium">{selected.unit || ''}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setSelected(null)} className="w-full mt-5 min-h-[52px] bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl font-bold active:scale-[0.98] transition-all">
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Barcode scanner overlay */}
      {scanning && (
        <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col">
          <div className="flex justify-between items-center p-4 text-white">
            <span className="font-bold flex items-center gap-2"><ScanLine className="w-5 h-5" /> สแกนบาร์โค้ด</span>
            <button onClick={stopScan} className="p-2 text-white/70 hover:text-white"><X className="w-7 h-7" /></button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <div id="inv-scanner" className="w-full max-w-sm rounded-2xl overflow-hidden" />
          </div>
          <div className="p-6 text-center text-white/60 text-sm">
            {scanError ? <span className="text-red-400">{scanError}</span> : 'เล็งกล้องไปที่บาร์โค้ดสินค้า'}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50"><MobileNav /></div>
    </div>
  );
}
