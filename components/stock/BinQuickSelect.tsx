'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Boxes, Scan, Plus, Check, ChevronDown, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import CameraScannerModal from '@/components/CameraScannerModal';

export interface BinStockItem {
  binCode: string;
  quantity: number;
  lotNo?: string;
}

interface BinQuickSelectProps {
  sku: string;
  selectedBin: string;
  onSelectBin: (bin: string) => void;
  mode?: 'putaway' | 'picking';
  unit?: string;
  className?: string;
  theme?: 'dark' | 'light';
  label?: string;
}

export default function BinQuickSelect({
  sku,
  selectedBin,
  onSelectBin,
  mode = 'putaway',
  unit = 'ชิ้น',
  className,
  theme = 'dark',
  label
}: BinQuickSelectProps) {
  const [bins, setBins] = useState<BinStockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (!sku) {
      setBins([]);
      return;
    }
    let isMounted = true;
    async function loadBins() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stock/bins?sku=${encodeURIComponent(sku)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.bins) {
            setBins(data.bins);
          }
        }
      } catch (err) {
        console.error('Failed to load bins for sku:', sku, err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadBins();
    return () => { isMounted = false; };
  }, [sku]);

  // For picking, we usually only care about bins that currently hold quantity > 0
  const displayBins = mode === 'picking' 
    ? bins.filter(b => b.quantity > 0)
    : bins;

  const isDark = theme === 'dark';

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectBin(customInput.trim().toUpperCase());
      setIsCustomOpen(false);
      setCustomInput('');
    }
  };

  const handleScanLocation = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean) {
      onSelectBin(clean);
      setCameraOpen(false);
      setIsCustomOpen(false);
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className={isDark ? 'text-[#8a92a6]' : 'text-slate-500'}>
            {label}
          </span>
          {displayBins.length > 0 && (
            <span className={cn('text-[10px]', isDark ? 'text-[#4cd7f6]' : 'text-blue-600')}>
              พบ {displayBins.length} พิกัดในคลัง
            </span>
          )}
        </div>
      )}

      {/* Quick-Select Bin Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {loading ? (
          <span className={cn('text-xs italic py-1', isDark ? 'text-[#8a92a6]' : 'text-slate-400')}>
            กำลังค้นหาพิกัด...
          </span>
        ) : displayBins.length > 0 ? (
          displayBins.map((b) => {
            const isSelected = selectedBin?.toUpperCase() === b.binCode.toUpperCase();
            return (
              <button
                key={b.binCode}
                type="button"
                onClick={() => onSelectBin(b.binCode)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all',
                  isSelected
                    ? isDark
                      ? 'bg-[#facc15] text-[#1b1600] font-black shadow-md border border-[#facc15]'
                      : 'bg-blue-600 text-white font-bold shadow-md'
                    : isDark
                      ? 'bg-[#252a32] text-[#dee2ec] hover:bg-[#30353d] border border-[#30353d]'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                )}
                title={`มีสต็อก ${b.quantity} ${unit} ${b.lotNo ? `(Lot: ${b.lotNo})` : ''}`}
              >
                <MapPin className="w-3 h-3 opacity-70" />
                <span className="font-bold">{b.binCode}</span>
                <span className={cn(
                  'text-[10px] px-1 rounded',
                  isSelected 
                    ? isDark ? 'bg-[#1b1600]/20 text-[#1b1600]' : 'bg-white/20 text-white'
                    : isDark ? 'bg-[#12161d] text-[#4cd7f6]' : 'bg-slate-100 text-blue-600'
                )}>
                  {b.quantity}
                </span>
                {isSelected && <Check className="w-3 h-3 ml-0.5" />}
              </button>
            );
          })
        ) : mode === 'picking' ? (
          <span className={cn('text-xs italic py-1', isDark ? 'text-[#ffb4ab]' : 'text-red-500')}>
            (ไม่มีสต็อกเหลือในพิกัดใดๆ)
          </span>
        ) : null}

        {/* Custom / New Bin Button */}
        {!isCustomOpen ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsCustomOpen(true)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors',
                isDark
                  ? 'bg-[#171c23] hover:bg-[#252a32] border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec]'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
              )}
            >
              <Plus className="w-3 h-3" />
              <span>{mode === 'putaway' ? 'ระบุ Bin อื่น' : 'เลือก Bin อื่น'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className={cn(
                'p-1 rounded-lg border transition-colors',
                isDark
                  ? 'bg-[#171c23] hover:bg-[#252a32] border-[#30353d] text-[#8a92a6] hover:text-[#facc15]'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-blue-600'
              )}
              title="สแกนบาร์โค้ดชั้นวาง"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-1">
            <input
              type="text"
              autoFocus
              placeholder="พิมพ์พิกัด..."
              value={customInput}
              onChange={e => setCustomInput(e.target.value.toUpperCase())}
              className={cn(
                'w-24 px-2 py-0.5 text-xs font-mono font-bold rounded-lg border uppercase outline-none',
                isDark
                  ? 'bg-[#12161d] border-[#4cd7f6] text-[#dee2ec]'
                  : 'bg-white border-blue-500 text-slate-900'
              )}
            />
            <button
              type="submit"
              className={cn(
                'px-2 py-0.5 rounded-lg text-xs font-bold',
                isDark ? 'bg-[#4cd7f6] text-[#042027]' : 'bg-blue-600 text-white'
              )}
            >
              ตกลง
            </button>
            <button
              type="button"
              onClick={() => setIsCustomOpen(false)}
              className={cn(
                'px-1.5 py-0.5 rounded-lg text-xs',
                isDark ? 'text-[#8a92a6] hover:text-white' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              ✕
            </button>
          </form>
        )}
      </div>

      {cameraOpen && (
        <CameraScannerModal
          isOpen={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onScan={handleScanLocation}
          title="สแกนบาร์โค้ดพิกัดชั้นวาง (Rack/Bin Barcode)"
          description="ส่องกล้องไปที่ป้ายบาร์โค้ดประจำชั้นวางหรือช่องจัดเก็บ"
        />
      )}
    </div>
  );
}
