'use client';

import { useState, useEffect, useRef } from 'react';
import { QrCode, Barcode, Printer, Download, ArrowLeft, Package, Search } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
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
    <div className="relative min-h-screen">
      <div className="p-4 md:p-8 pb-32 print:hidden">
        <AmbientBackground />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 bg-[#171c23] border border-[#30353d] rounded-xl text-[#8a92a6] hover:text-indigo-600 hover:border-indigo-500/30 hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#dee2ec] flex items-center gap-2">
              <Barcode className="w-6 h-6 text-[#facc15]" />
              {t('barcode_title')}
            </h1>
            <p className="text-sm text-[#d1c6ab]">{t('barcode_subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Selection */}
          <div className="bg-[#171c23] rounded-3xl border border-[#30353d] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[#30353d] bg-[#1b2027]">
              <h2 className="font-bold text-[#d1c6ab] flex items-center gap-2">
                <Package className="w-4 h-4" />
                {t('select_product')}
              </h2>
            </div>

            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a92a6]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('search_product')}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1b2027] border border-[#30353d] rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {loading ? (
                  <p className="text-center text-[#8a92a6] py-8">{t('loading')}</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-center text-[#8a92a6] py-8">{t('no_products_found')}</p>
                ) : (
                  filteredProducts.slice(0, 20).map(product => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={cn(
                        "w-full p-3 rounded-xl border text-left transition-all",
                        selectedProduct?.id === product.id
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-[#30353d] hover:border-[#30353d] hover:bg-[#1b2027]"
                      )}
                    >
                      <p className="font-medium text-[#dee2ec] text-sm truncate">{product.name}</p>
                      <p className="text-xs text-[#8a92a6]">{product.location || '-'}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Code Preview */}
          <div className="bg-[#171c23] rounded-3xl border border-[#30353d] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[#30353d] bg-[#1b2027] flex items-center justify-between">
              <h2 className="font-bold text-[#d1c6ab]">{t('preview')}</h2>
              
              {/* Type Toggle */}
              <div className="flex bg-[#252a32] rounded-lg p-1">
                <button
                  onClick={() => setCodeType('qrcode')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-bold transition-all",
                    codeType === 'qrcode' 
                      ? "bg-[#171c23] text-indigo-600 shadow-sm" 
                      : "text-[#8a92a6] hover:text-[#d1c6ab]"
                  )}
                >
                  QR Code
                </button>
                <button
                  onClick={() => setCodeType('barcode')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-bold transition-all",
                    codeType === 'barcode' 
                      ? "bg-[#171c23] text-indigo-600 shadow-sm" 
                      : "text-[#8a92a6] hover:text-[#d1c6ab]"
                  )}
                >
                  Barcode
                </button>
              </div>
            </div>

            <div className="p-6">
              {selectedProduct ? (
                <>
                  {/* Printable Area */}
                  <div
                    ref={printRef}
                    className="bg-white p-6 border border-dashed border-slate-300 rounded-2xl text-center"
                  >
                    <p className="text-sm font-bold text-slate-800 mb-4">{selectedProduct.name}</p>
                    
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

                    <p className="text-xs text-slate-500 mt-4">{selectedProduct.location || '-'}</p>
                    <p className="text-xs text-slate-500">฿{selectedProduct.price?.toLocaleString()}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handlePrint}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      {t('print_btn')}
                    </button>
                    {codeType === 'qrcode' && (
                      <button
                        onClick={handleDownload}
                        className="px-4 py-3 bg-[#252a32] hover:bg-[#30353d] text-[#d1c6ab] font-bold rounded-xl transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[#1b2027] rounded-2xl flex items-center justify-center">
                    <QrCode className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-[#8a92a6]">{t('select_product')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Print Only Section */}
      {selectedProduct && (
        <div className="hidden print:flex flex-col items-center justify-center min-h-screen bg-white text-center p-10">
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
                 <p className="text-2xl font-black text-black mt-2">฿{selectedProduct.price?.toLocaleString()}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
