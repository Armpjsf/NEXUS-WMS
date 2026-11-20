'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer, Minus, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function PrintLabelsPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-nexus-hybrid min-h-screen flex items-center justify-center text-slate-700">
          <div className="nx-glass-card px-6 py-4 text-sm font-semibold">Loading...</div>
        </div>
      }
    >
      <PrintLabelsContent />
    </Suspense>
  );
}

function PrintLabelsContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get data from URL
  const sku = searchParams.get('sku') || 'UNKNOWN-SKU';
  const name = searchParams.get('name') || 'Unknown Product';
  const price = searchParams.get('price') || '0';
  const code = searchParams.get('code') || sku; // Use 'code' for barcode value, fallback to SKU
  const stock = Number(searchParams.get('stock') || '0');
  const location = searchParams.get('location') || '';
  
  const [copies, setCopies] = useState(1);
  const [labelSize, setLabelSize] = useState<'standard' | 'small' | 'large'>('standard');
  const [showPrice, setShowPrice] = useState(true);
  const [showQR, setShowQR] = useState(false);
  
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `Label-${sku}`,
  });

  // Hotkey for printing (Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrint]);

  void router;

  return (
    <div className="theme-nexus-hybrid min-h-screen flex flex-col md:flex-row text-slate-900 print:bg-white">
      {/* Sidebar Controls - Hidden on Print */}
      <div className="w-full md:w-88 bg-white/75 backdrop-blur-xl border-b md:border-b-0 md:border-r border-white/85 p-6 flex flex-col h-auto md:h-screen overflow-y-auto print:hidden z-10 shadow-sm md:shadow-none">
        <div className="mb-6">
            <Link
              href="/inventory"
              className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-slate-200/80 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all mb-4 w-fit"
            >
                <ArrowLeft className="w-3.5 h-3.5" /> {t('back_to_inventory')}
            </Link>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/75 border border-slate-200/80 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Label Studio
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('label_printer_title')}</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('label_printer_subtitle')}</p>
        </div>

        {/* Item Details (Hero Dark Accent Card) */}
        <div className="nx-dark-accent-card p-4 mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Selected SKU</p>
            <h3 className="font-bold text-white mb-2 leading-snug">{name}</h3>
            <div className="flex justify-between items-center text-sm pt-2 border-t border-white/10">
                <span className="font-mono text-xs text-slate-300">{sku}</span>
                <span className="font-bold text-emerald-400 tabular-nums">฿{Number(price).toLocaleString()}</span>
            </div>
        </div>

        {/* Controls */}
        <div className="space-y-6 flex-1">
            {/* Copies */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{t('copies')}</label>
                <div className="flex items-center gap-2.5">
                    <button 
                        onClick={() => setCopies(Math.max(1, copies - 1))}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/85 border border-slate-200 hover:bg-white text-slate-700 hover:text-slate-900 shadow-xs transition-colors"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <input 
                        type="number" 
                        value={copies}
                        onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 h-10 bg-white/85 border border-slate-200 rounded-full text-center font-bold text-slate-900 tabular-nums focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all"
                    />
                    <button 
                         onClick={() => setCopies(copies + 1)}
                         className="w-10 h-10 flex items-center justify-center rounded-full bg-white/85 border border-slate-200 hover:bg-white text-slate-700 hover:text-slate-900 shadow-xs transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Sizes */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{t('size')}</label>
                <div className="grid grid-cols-3 gap-2">
                    {['small', 'standard', 'large'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setLabelSize(s as any)}
                            className={`px-2 py-2 rounded-full text-xs font-semibold capitalize border transition-all ${
                                labelSize === s 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                                : 'bg-white/80 text-slate-700 border-slate-200 hover:bg-white hover:text-slate-900'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Options */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{t('options')}</label>
                <div className="space-y-1.5">
                    <label className="flex items-center space-x-2.5 cursor-pointer p-2.5 rounded-2xl bg-white/60 hover:bg-white/90 border border-slate-200/70 transition-colors">
                        <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span className="text-sm font-medium text-slate-800">{t('show_price')}</span>
                    </label>
                    <label className="flex items-center space-x-2.5 cursor-pointer p-2.5 rounded-2xl bg-white/60 hover:bg-white/90 border border-slate-200/70 transition-colors">
                        <input type="checkbox" checked={showQR} onChange={(e) => setShowQR(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span className="text-sm font-medium text-slate-800">{t('use_qr')}</span>
                    </label>
                </div>
            </div>
        </div>

        {/* Action Button */}
        <div className="mt-8 pt-6 border-t border-slate-200/80">
            <button
                type="button"
                onClick={() => window.print()}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-full shadow-sm transition-all flex items-center justify-center gap-2 group"
            >
                <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>{t('print_labels_btn')}</span>
            </button>
            <p className="text-center text-xs text-slate-500 mt-3 flex items-center justify-center gap-1">
                <span className="bg-white/85 px-1.5 py-0.5 rounded-md border border-slate-200 font-mono text-slate-700">Ctrl</span> + <span className="bg-white/85 px-1.5 py-0.5 rounded-md border border-slate-200 font-mono text-slate-700">Enter</span> to print
            </p>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto flex justify-center items-start print:p-0 print:bg-white">
        <div className="w-full max-w-3xl space-y-4">
            <div className="nx-glass-card px-5 py-3 flex items-center justify-between print:hidden">
                <h2 className="font-semibold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-2">
                    <Settings className="w-4 h-4 text-emerald-600" /> {t('preview')}
                </h2>
                <span className="px-3 py-1 rounded-full bg-emerald-500/12 text-emerald-800 border border-emerald-500/20 text-xs font-semibold tabular-nums">
                  {t('total_labels').replace('{0}', copies.toString())}
                </span>
            </div>

            {/* THE PRINTABLE AREA — crisp black-on-white */}
            <div ref={componentRef} className="bg-white text-black p-8 rounded-2xl border border-slate-200/80 shadow-sm min-h-[500px] print:shadow-none print:border-0 print:p-0 print:m-0 print:bg-transparent">
                <style type="text/css" media="print">
                    {`
                        @page { size: auto; margin: 0mm; }
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                        .print-page-break { page-break-after: always; }
                    `}
                </style>
                
                <div className="grid grid-cols-1 gap-4 print:block"> {/* Grid for preview, block for print flow */}
                     {Array.from({ length: copies }).map((_, i) => (
                        <div key={i} className="inline-block p-2 print:p-0">
                              <Label 
                                 sku={sku} 
                                 name={name} 
                                 price={price}
                                 code={code} 
                                 size={labelSize} 
                                 showPrice={showPrice} 
                                 showQR={showQR}
                                 stock={stock}
                                 location={location}
                              />
                        </div>
                     ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function Label({ sku, name, price, code, size, showPrice, showQR, stock, location }: any) {
    // Size configurations. Title font is kept small enough that a 2-line name
    // + code/QR + footer always fit inside the fixed print height (a long name
    // was clipping/overlapping the barcode on Standard).
    const sizeConfig = {
        small:    { w: '200px', h: '120px', text: 'text-[10px]', title: 'text-[11px]', price: 'text-sm',  p: 'p-2',   bc: { w: 1.2, h: 26, fs: 10 }, qr: 54 },
        standard: { w: '300px', h: '180px', text: 'text-xs',     title: 'text-sm',     price: 'text-lg',  p: 'p-3',   bc: { w: 1.7, h: 40, fs: 11 }, qr: 74 },
        large:    { w: '400px', h: '250px', text: 'text-sm',     title: 'text-xl',     price: 'text-xl',  p: 'p-5',   bc: { w: 2,   h: 54, fs: 12 }, qr: 96 },
    };

    const s = sizeConfig[size as keyof typeof sizeConfig];

    return (
        <div
             className={`bg-white border-2 border-black rounded-lg ${s.p} flex flex-col items-center text-center relative break-inside-avoid mx-auto mb-4 print:mb-0 print:mx-0 overflow-hidden`}
             style={{ width: s.w, height: s.h }}
        >
            <div className={`shrink-0 font-bold text-black leading-tight line-clamp-2 ${s.title} w-full`}>
                {name}
            </div>

            <div className="flex-1 min-h-0 flex items-center justify-center w-full">
                {showQR ? (
                    <QRCodeSVG value={JSON.stringify({loc: location || '-', name, stock: Number(stock)})} size={s.qr} level={"H"} />
                ) : (
                    <div className="w-full flex justify-center overflow-hidden">
                        <Barcode
                            value={code}
                            width={s.bc.w}
                            height={s.bc.h}
                            fontSize={s.bc.fs}
                            displayValue={true}
                            margin={0}
                        />
                    </div>
                )}
            </div>

            <div className="shrink-0 w-full flex justify-between items-end gap-2 border-t-2 border-black pt-1">
                <span className={`font-mono font-bold text-black truncate ${s.text}`}>{code !== sku ? `${code}` : sku}</span>
                {showPrice && (
                    <span className={`font-black text-black shrink-0 ${s.price}`}>฿{Number(price).toLocaleString()}</span>
                )}
            </div>
        </div>
    );
}
