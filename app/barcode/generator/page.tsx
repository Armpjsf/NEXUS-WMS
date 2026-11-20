'use client';

import { useState, useEffect, useRef } from 'react';
import { QrCode, Barcode, Printer, Download, ArrowLeft, Package, Search } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  category: string;
  location: string;
}

type CodeType = 'qrcode' | 'barcode';

export default function BarcodeGeneratorPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [codeType, setCodeType] = useState<CodeType>('qrcode');
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  // Load products
  useEffect(() => {
    fetch(getApiUrl('/api/products'))
      .then(res => res.json())
      .then(data => {
        setProducts(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Generate barcode when product changes
  useEffect(() => {
    if (selectedProduct && codeType === 'barcode' && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, selectedProduct.id, {
          format: 'CODE128',
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
          margin: 10
        });
      } catch (err) {
        console.error('Barcode generation error:', err);
      }
    }
  }, [selectedProduct, codeType]);

  // Filter products
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  // Print handler
  const handlePrint = () => {
    if (!selectedProduct) return;
    window.print();
  };

  // Download as PNG (for QR Code)
  const handleDownload = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${selectedProduct?.id || 'qrcode'}.png`;
      link.href = pngUrl;
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen text-slate-900 print:bg-white">
      <div className="p-4 md:p-8 pb-32 print:hidden">
        <div className="max-w-5xl mx-auto space-y-6 relative z-10">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            กลับหน้าแอดมิน
          </Link>

          {/* Open Page Header */}
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Barcode &amp; QR Studio
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Barcode className="w-7 h-7 text-emerald-600 shrink-0" />
              <span>{t('barcode_title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('barcode_subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Selection */}
            <div className="nx-glass-card overflow-hidden">
              <div className="p-4 border-b border-slate-200/70 bg-white/50 flex items-center justify-between">
                <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-emerald-600" />
                  {t('select_product')}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-800 border border-emerald-500/20 tabular-nums">
                  {filteredProducts.length.toLocaleString()} SKUs
                </span>
              </div>

              <div className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('search_product')}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/85 border border-slate-200 rounded-full text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all"
                  />
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    <p className="text-center text-slate-500 py-8 text-sm">{t('loading')}</p>
                  ) : filteredProducts.length === 0 ? (
                    <p className="text-center text-slate-500 py-8 text-sm">{t('no_products_found')}</p>
                  ) : (
                    filteredProducts.slice(0, 20).map(product => (
                      <button
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className={cn(
                          "w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2",
                          selectedProduct?.id === product.id
                            ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                            : "border-slate-200/80 bg-white/65 hover:bg-white hover:border-slate-300"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{product.name}</p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {product.id} • {product.location || '-'}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">
                          ฿{product.price?.toLocaleString()}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Code Preview */}
            <div className="nx-glass-card overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200/70 bg-white/50 flex items-center justify-between">
                <h2 className="font-bold text-slate-900 text-sm">{t('preview')}</h2>
                
                {/* Type Toggle */}
                <div className="flex bg-slate-200/70 rounded-full p-1">
                  <button
                    onClick={() => setCodeType('qrcode')}
                    className={cn(
                      "px-3.5 py-1 rounded-full text-xs font-semibold transition-all",
                      codeType === 'qrcode' 
                        ? "bg-slate-900 text-white shadow-xs" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    QR Code
                  </button>
                  <button
                    onClick={() => setCodeType('barcode')}
                    className={cn(
                      "px-3.5 py-1 rounded-full text-xs font-semibold transition-all",
                      codeType === 'barcode' 
                        ? "bg-slate-900 text-white shadow-xs" 
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Barcode
                  </button>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between">
                {selectedProduct ? (
                  <>
                    {/* Printable Area — crisp black-on-white */}
                    <div
                      ref={printRef}
                      className="bg-white text-black p-6 border border-dashed border-slate-300 rounded-2xl text-center shadow-xs"
                    >
                      <p className="text-sm font-bold text-black mb-4">{selectedProduct.name}</p>
                      
                      {codeType === 'qrcode' ? (
                        <div className="flex justify-center">
                          <QRCodeSVG
                            id="qr-code-svg"
                            value={JSON.stringify({
                              loc: selectedProduct.location || '-',
                              name: selectedProduct.name,
                              stock: selectedProduct.stock
                            })}
                            size={180}
                            level="M"
                            includeMargin
                          />
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <svg ref={barcodeRef}></svg>
                        </div>
                      )}

                      <p className="text-xs font-mono text-slate-700 mt-4">{selectedProduct.location || '-'}</p>
                      <p className="text-sm font-bold text-black tabular-nums mt-0.5">฿{selectedProduct.price?.toLocaleString()}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={handlePrint}
                        className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full transition-colors flex items-center justify-center gap-2 shadow-sm text-sm"
                      >
                        <Printer className="w-4 h-4" />
                        {t('print_btn')}
                      </button>
                      {codeType === 'qrcode' && (
                        <button
                          onClick={handleDownload}
                          className="px-5 py-3 bg-white/85 hover:bg-white border border-slate-200 text-slate-700 hover:text-slate-900 font-semibold rounded-full transition-colors shadow-xs"
                          title="ดาวน์โหลด PNG"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center my-auto">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/80 border border-slate-200/80 rounded-2xl flex items-center justify-center shadow-xs">
                      <QrCode className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 text-sm font-medium">{t('select_product')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Only Section — pure black-on-white */}
      {selectedProduct && (
        <div className="hidden print:flex flex-col items-center justify-center min-h-screen bg-white text-black text-center p-10">
          <div className="w-full max-w-[400px]">
             <p className="text-xl font-bold text-black mb-6">{selectedProduct.name}</p>
             
             {codeType === 'qrcode' ? (
                <div className="flex justify-center mb-6">
                    <QRCodeSVG
                        value={JSON.stringify({
                            loc: selectedProduct.location || '-',
                            name: selectedProduct.name,
                            stock: selectedProduct.stock
                        })}
                        size={300}
                        level="M"
                        includeMargin
                    />
                </div>
             ) : (
                <div className="flex justify-center mb-6">
                    {/* Re-render barcode for print with larger size */}
                    <div className="scale-150 transform origin-center">
                        <svg 
                            ref={(el) => {
                                if (el) {
                                    JsBarcode(el, selectedProduct.id, {
                                        format: 'CODE128',
                                        width: 2,
                                        height: 80,
                                        displayValue: true,
                                        fontSize: 14,
                                        margin: 10
                                    });
                                }
                            }}
                        ></svg>
                    </div>
                </div>
             )}

             <div className="mt-8">
                 <p className="text-lg font-bold text-black uppercase tracking-widest">{selectedProduct.location || '-'}</p>
                 <p className="text-2xl font-black text-black mt-2 tabular-nums">฿{selectedProduct.price?.toLocaleString()}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
