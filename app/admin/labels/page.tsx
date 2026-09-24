'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Search, Printer, Settings, Tag, MapPin, Box, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
// Remove useReactToPrint as it's incompatible with React 19
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';

export default function LabelDesignerPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  
  // Settings
  const [labelSize, setLabelSize] = useState<'A4' | 'THERMAL' | 'SINGLE'>('SINGLE');
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showSKU, setShowSKU] = useState(true);
  const [codeType, setCodeType] = useState<'BARCODE' | 'QR'>('BARCODE');
  
  const componentRef = useRef(null);

  useEffect(() => {
    // Fetch products for selector
    fetch('/api/products') // Assuming standard product list API exists or use inventory API
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          setProducts(data.products || []);
        }
      })
      .catch(err => console.error(err));
  }, []);
  
  const handlePrint = () => {
    window.print();
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row overflow-hidden bg-[#1b2027] print:bg-white">
      {/* Hidden print-only section */}
      <div className="hidden print:flex flex-col items-center justify-center min-h-screen w-full">
         {selectedProduct && (
             <div className="bg-white text-black p-4" style={{ width: '100mm' }}>
                {showName && <h2 className="text-xl font-bold mb-2 leading-tight text-center">{selectedProduct.name}</h2>}
                <div className="flex justify-center my-4">
                    {codeType === 'BARCODE' ? (
                        <Barcode value={selectedProduct.id} width={1.8} height={60} fontSize={16} />
                    ) : (
                        <QRCode value={JSON.stringify({loc: selectedProduct.location || '-', name: selectedProduct.name, stock: selectedProduct.stock})} size={150} />
                    )}
                </div>
                {showSKU && <p className="font-mono text-sm text-center mb-1">{selectedProduct.location || selectedProduct.id}</p>}
                {showPrice && (
                    <div className="mt-2 border-t-2 border-black pt-1 w-full text-center">
                        <p className="text-3xl font-black">฿ {selectedProduct.price?.toLocaleString()}</p>
                    </div>
                )}
             </div>
         )}
      </div>

      {/* Main UI (Hidden during print) */}
      <div className="flex-1 flex flex-col md:flex-row h-full w-full print:hidden">
      
      {/* LEFT: Controls & List */}
      <div className="w-full md:w-96 bg-[#171c23] border-r border-[#30353d] flex flex-col z-10 shadow-lg">
        <div className="p-4 border-b border-[#30353d]">
           <div className="flex items-center gap-3 mb-4">
             <Link
               href="/admin"
               className="p-1.5 bg-[#1b2027] border border-[#30353d] rounded-lg text-[#8a92a6] hover:text-indigo-600 hover:border-indigo-500/30 transition-all"
             >
               <ArrowLeft className="w-4 h-4" />
             </Link>
             <h2 className="font-bold text-lg flex items-center gap-2">
               <Settings className="w-5 h-5 text-indigo-600" />
               Label Designer
             </h2>
           </div>

           {/* Product Search */}
           <div className="relative mb-4">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#8a92a6]" />
             <input 
               type="text" 
               placeholder="Search product..." 
               className="w-full pl-9 pr-4 py-2 bg-[#1b2027] border border-[#30353d] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
           </div>

           {/* Settings */}
           <div className="space-y-4">
             <div>
               <label className="text-xs font-bold text-[#8a92a6] uppercase block mb-2">Paper Size</label>
               <div className="grid grid-cols-3 gap-2">
                 {/* Simplified options for MVP */}
                 <button 
                    onClick={() => setLabelSize('SINGLE')}
                    className={`px-2 py-1.5 text-xs rounded border ${labelSize === 'SINGLE' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-700' : 'border-[#30353d] hover:bg-[#1b2027]'}`}
                 >
                    Single Sticker
                 </button>
                  <button 
                    onClick={() => setLabelSize('THERMAL')}
                    className={`px-2 py-1.5 text-xs rounded border ${labelSize === 'THERMAL' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-700' : 'border-[#30353d] hover:bg-[#1b2027]'}`}
                 >
                    4x6 (Thermal)
                 </button>
               </div>
             </div>

             <div>
               <label className="text-xs font-bold text-[#8a92a6] uppercase block mb-2">Content</label>
               <div className="space-y-2">
                 <label className="flex items-center gap-2 text-sm cursor-pointer">
                   <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} className="rounded text-indigo-600" />
                   Show Name
                 </label>
                 <label className="flex items-center gap-2 text-sm cursor-pointer">
                   <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} className="rounded text-indigo-600" />
                   Show Price
                 </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                   <input type="checkbox" checked={showSKU} onChange={e => setShowSKU(e.target.checked)} className="rounded text-indigo-600" />
                   Show SKU
                 </label>
               </div>
             </div>

             <div>
               <label className="text-xs font-bold text-[#8a92a6] uppercase block mb-2">Code Type</label>
                <div className="flex bg-[#252a32] p-1 rounded-lg">
                    <button 
                        onClick={() => setCodeType('BARCODE')}
                        className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${codeType === 'BARCODE' ? 'bg-[#171c23] shadow-sm text-[#dee2ec]' : 'text-[#8a92a6]'}`}
                    >
                        Barcode (128)
                    </button>
                    <button 
                        onClick={() => setCodeType('QR')}
                        className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${codeType === 'QR' ? 'bg-[#171c23] shadow-sm text-[#dee2ec]' : 'text-[#8a92a6]'}`}
                    >
                        QR Code
                    </button>
                </div>
             </div>
           </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto">
           {filteredProducts.map(p => (
             <div 
               key={p.id} 
               onClick={() => setSelectedProduct(p)}
               className={`p-3 border-b border-slate-50 cursor-pointer hover:bg-[#1b2027] flex items-center gap-3 transition-colors ${selectedProduct?.id === p.id ? 'bg-indigo-500/10' : ''}`}
             >
                <div className="w-10 h-10 bg-[#30353d] rounded-lg shrink-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image ? (
                      <img 
                        src={`/api/proxy/image?url=${encodeURIComponent(p.image)}`} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          // Fallback if proxy fails or image invalid
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Box className="w-4 h-4 text-[#8a92a6]"/></div>
                    )}
                    {/* Fallback Icon (Hidden by default) */}
                    <div className="hidden w-full h-full flex items-center justify-center bg-[#252a32]"><Box className="w-4 h-4 text-slate-300"/></div>
                </div>
                <div>
                   <div className="text-sm font-bold text-[#dee2ec] line-clamp-1">{p.name}</div>
                   <div className="text-xs text-[#8a92a6] flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {p.location || 'No Loc'}
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* RIGHT: Preview Area */}
      <div className="flex-1 flex flex-col bg-[#252a32]">
         <div className="p-4 border-b border-[#30353d] bg-[#171c23] flex justify-between items-center">
            <h1 className="font-bold text-[#d1c6ab]">Print Preview</h1>
            <button 
                onClick={() => handlePrint && handlePrint()}
                disabled={!selectedProduct}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Printer className="w-5 h-5" />
                Print Label
            </button>
         </div>

         <div className="flex-1 flex justify-center items-center p-8 overflow-auto">
            {selectedProduct ? (
                <div className="shadow-2xl">
                    {/* PRINT COMPONENT */}
                    <div ref={componentRef as any} className="bg-white text-black box-border" style={{ 
                        width: labelSize === 'THERMAL' ? '100mm' : '300px',
                        height: labelSize === 'THERMAL' ? '150mm' : 'auto',
                        padding: '20px',
                        border: '1px solid #eee',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center'
                    }}>
                        {showName && <h2 className="text-xl font-bold mb-2 leading-tight">{selectedProduct.name}</h2>}
                        
                        <div className="my-4">
                            {codeType === 'BARCODE' ? (
                                <Barcode value={selectedProduct.id} width={1.5} height={50} fontSize={14} />
                            ) : (
                                <QRCode value={JSON.stringify({loc: selectedProduct.location || '-', name: selectedProduct.name, stock: selectedProduct.stock})} size={120} />
                            )}
                        </div>

                        {showSKU && <p className="font-mono text-sm mb-1">{selectedProduct.location || selectedProduct.id}</p>}
                        
                        {showPrice && (
                            <div className="mt-2 border-t-2 border-black pt-1 w-full max-w-[150px]">
                                <p className="text-2xl font-black">฿ {selectedProduct.price?.toLocaleString()}</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center text-[#8a92a6]">
                   <Tag className="w-16 h-16 mx-auto mb-4 opacity-50" />
                   <p>Select a product to start designing</p>
                </div>
            )}
          </div>
       </div>
    </div>
  </div>
  );
}
