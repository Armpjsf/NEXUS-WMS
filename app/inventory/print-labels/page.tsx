'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer, Minus, Plus, Copy, Settings } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function PrintLabelsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
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

  return (
    <div className="min-h-screen bg-[#1b2027] flex flex-col md:flex-row">
      {/* Sidebar Controls - Hidden on Print */}
      <div className="w-full md:w-80 bg-[#171c23] border-r border-[#30353d] p-6 flex flex-col h-auto md:h-screen overflow-y-auto print:hidden z-10 shadow-lg md:shadow-none">
        <div className="mb-8">
            <Link href="/inventory" className="inline-flex items-center text-[#8a92a6] hover:text-[#dee2ec] transition-colors mb-4">
                <ArrowLeft className="w-4 h-4 mr-1" /> {t('back_to_inventory')}
            </Link>
            <h1 className="text-2xl font-black text-[#dee2ec] tracking-tight">{t('label_printer_title')}</h1>
            <p className="text-sm text-[#8a92a6] mt-1">{t('label_printer_subtitle')}</p>
        </div>

        {/* Item Details */}
        <div className="bg-[#1b2027] p-4 rounded-xl border border-[#30353d] mb-6">
            <h3 className="font-bold text-[#d1c6ab] mb-1">{name}</h3>
            <div className="flex justify-between items-center text-sm">
                <span className="font-mono text-[#8a92a6]">{sku}</span>
                <span className="font-bold text-[#dee2ec]">฿{Number(price).toLocaleString()}</span>
            </div>
        </div>

        {/* Controls */}
        <div className="space-y-6 flex-1">
            {/* Copies */}
            <div>
                <label className="block text-xs font-bold text-[#8a92a6] uppercase tracking-wider mb-2">{t('copies')}</label>
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={() => setCopies(Math.max(1, copies - 1))}
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#30353d] hover:bg-[#1b2027] text-[#d1c6ab] transition-colors"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <input 
                        type="number" 
                        value={copies}
                        onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 h-10 border border-[#30353d] rounded-lg text-center font-bold text-[#dee2ec] focus:border-indigo-500 outline-none"
                    />
                    <button 
                         onClick={() => setCopies(copies + 1)}
                         className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#30353d] hover:bg-[#1b2027] text-[#d1c6ab] transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Sizes */}
            <div>
                <label className="block text-xs font-bold text-[#8a92a6] uppercase tracking-wider mb-2">{t('size')}</label>
                <div className="grid grid-cols-3 gap-2">
                    {['small', 'standard', 'large'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setLabelSize(s as any)}
                            className={`px-2 py-2 rounded-lg text-xs font-bold capitalize border transition-all ${
                                labelSize === s 
                                ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/30' 
                                : 'bg-[#171c23] text-[#d1c6ab] border-[#30353d] hover:border-[#30353d]'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Options */}
            <div>
                <label className="block text-xs font-bold text-[#8a92a6] uppercase tracking-wider mb-2">{t('options')}</label>
                <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg hover:bg-[#1b2027] transition-colors">
                        <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm font-medium text-[#d1c6ab]">{t('show_price')}</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg hover:bg-[#1b2027] transition-colors">
                        <input type="checkbox" checked={showQR} onChange={(e) => setShowQR(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm font-medium text-[#d1c6ab]">{t('use_qr')}</span>
                    </label>
                </div>
            </div>
        </div>

        {/* Action Button */}
        <div className="mt-8 pt-6 border-t border-[#30353d]">
            <button
                type="button"
                onClick={() => window.print()}
                className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
            >
                <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>{t('print_labels_btn')}</span>
            </button>
            <p className="text-center text-xs text-[#8a92a6] mt-3 flex items-center justify-center gap-1">
                <span className="bg-[#252a32] px-1 py-0.5 rounded border border-[#30353d] font-mono">Ctrl</span> + <span className="bg-[#252a32] px-1 py-0.5 rounded border border-[#30353d] font-mono">Enter</span> to print
            </p>
        </div>
      </div>

      {/* Preview Area */}
      {/* (Omit unmodified surrounding elements but target the Label props inside the loop) */}
      <div className="flex-1 bg-[#252a32] p-8 overflow-y-auto flex justify-center items-start">
        <div className="w-full max-w-3xl">
            <div className="mb-4 flex items-center justify-between print:hidden">
                <h2 className="font-bold text-[#8a92a6] uppercase tracking-wider text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4" /> {t('preview')}
                </h2>
                <span className="text-xs text-[#8a92a6]">{t('total_labels').replace('{0}', copies.toString())}</span>
            </div>

            {/* THE PRINTABLE AREA */}
            <div ref={componentRef} className="bg-white p-8 rounded-xl shadow-sm min-h-[500px] print:shadow-none print:p-0 print:m-0 print:bg-transparent">
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
    // Size configurations
    const sizeConfig = {
        small: { w: '200px', h: '120px', text: 'text-xs', title: 'text-sm', p: 'p-2' },
        standard: { w: '300px', h: '180px', text: 'text-sm', title: 'text-lg', p: 'p-4' },
        large: { w: '400px', h: '250px', text: 'text-base', title: 'text-xl', p: 'p-6' },
    };
    
    const s = sizeConfig[size as keyof typeof sizeConfig];

    return (
        <div 
             className={`bg-white border-2 border-black rounded-lg ${s.p} flex flex-col justify-between items-center text-center relative break-inside-avoid mx-auto mb-4 print:mb-0 print:mx-0`}
             style={{ 
                 width: s.w, 
                 height: s.h,
             }}
        >
            <div className={`font-bold text-black leading-tight line-clamp-2 ${s.title} mb-1 w-full`}>
                {name}
            </div>

            <div className="flex-1 flex items-center justify-center w-full py-1">
                {showQR ? (
                    <QRCodeSVG value={JSON.stringify({loc: location || '-', name, stock: Number(stock)})} size={size === 'small' ? 60 : 80} level={"H"} />
                ) : (
                    <div className="w-full flex justify-center overflow-hidden">
                        <Barcode 
                            value={code} 
                            width={size === 'small' ? 1.5 : 2} 
                            height={size === 'small' ? 30 : 50} 
                            fontSize={12}
                            displayValue={true}
                            margin={0}
                        />
                    </div>
                )}
            </div>

            <div className="w-full flex justify-between items-end mt-1 border-t-2 border-black pt-1">
                <span className={`font-mono font-bold text-black ${s.text}`}>{code !== sku ? `${code}` : sku}</span>
                {showPrice && (
                    <span className={`font-black text-black ${s.title}`}>฿{Number(price).toLocaleString()}</span>
                )}
            </div>
        </div>
    );
}
