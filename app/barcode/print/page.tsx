'use client';

import { useState, useEffect, useRef } from 'react';
import { Printer, Search, Copy, Check, Grid, File } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function BarcodePrintPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [printFormat, setPrintFormat] = useState<'label-4x6' | 'a4-sheet'>('label-4x6');
  const [quantity, setQuantity] = useState(1);
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(getApiUrl('/api/products'))
      .then(res => res.json())
      .then(data => setProducts(data || []))
      .catch(console.error);
  }, []);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    pageStyle: printFormat === 'label-4x6' 
      ? '@page { size: 4in 6in; margin: 0; } body { margin: 0; }' 
      : '@page { size: A4; margin: 10mm; }'
  });

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.id.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8">
      <AmbientBackground />
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Left: Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-teal-200 bg-white/85 p-6 shadow-xl shadow-teal-900/10 backdrop-blur-xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-600 via-blue-700 to-amber-500" />
            <h1 className="text-3xl font-black text-slate-900 mb-2">Print Labels</h1>
            <p className="text-slate-500">สร้างสติ๊กเกอร์บาร์โค้ดสินค้า</p>
          </div>

          {/* Product Search */}
          <div className="bg-white/90 p-6 rounded-2xl border border-slate-200 shadow-lg shadow-slate-900/5">
            <h3 className="font-bold text-slate-800 mb-4">1. Select Product</h3>
            <div className="relative mb-4">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
               <input 
                 type="text" 
                 placeholder="Search product..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
               />
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
               {filtered.map(p => (
                 <div 
                   key={p.id}
                   onClick={() => setSelectedProduct(p)}
                   className={cn(
                     "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                     selectedProduct?.id === p.id 
                       ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500" 
                       : "bg-white border-slate-100 hover:border-indigo-300"
                   )}
                 >
                    <div className="truncate pr-2">
                       <div className="font-bold text-slate-800 truncate">{p.name}</div>
                       <div className="text-xs text-slate-500">{p.id}</div>
                    </div>
                    {selectedProduct?.id === p.id && <Check className="w-5 h-5 text-indigo-600" />}
                 </div>
               ))}
            </div>
          </div>

          {/* Config */}
          <div className="bg-white/90 p-6 rounded-2xl border border-slate-200 shadow-lg shadow-slate-900/5">
             <h3 className="font-bold text-slate-800 mb-4">2. Configuration</h3>
             
             <div className="space-y-4">
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Format</label>
                   <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setPrintFormat('label-4x6')}
                        className={cn(
                          "p-3 rounded-xl border text-sm font-bold flex flex-col items-center gap-2 transition-all",
                          printFormat === 'label-4x6' ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-white border-slate-200 text-slate-500"
                        )}
                      >
                         <Printer className="w-5 h-5" />
                         4" x 6" Label
                      </button>
                      <button 
                        onClick={() => setPrintFormat('a4-sheet')}
                        className={cn(
                          "p-3 rounded-xl border text-sm font-bold flex flex-col items-center gap-2 transition-all",
                          printFormat === 'a4-sheet' ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-white border-slate-200 text-slate-500"
                        )}
                      >
                         <Grid className="w-5 h-5" />
                         A4 Sheet (3x8)
                      </button>
                   </div>
                </div>

                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Quantity</label>
                   <input 
                     type="number" 
                     min="1" max="100"
                     value={quantity}
                     onChange={e => setQuantity(parseInt(e.target.value))}
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500"
                   />
                </div>
             </div>
          </div>

          <button
             onClick={handlePrint}
             disabled={!selectedProduct}
             className="w-full py-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
             <Printer className="w-5 h-5" /> Print Now
          </button>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-2 bg-white/80 rounded-2xl border border-slate-200 p-8 flex items-center justify-center overflow-auto min-h-[600px] shadow-xl shadow-slate-900/5 backdrop-blur-xl">
           {!selectedProduct ? (
              <div className="text-center text-slate-400">
                 <Printer className="w-16 h-16 mx-auto mb-4 opacity-20" />
                 <p>Select a product to preview label</p>
              </div>
           ) : (
              <div ref={componentRef} className="bg-white text-black shadow-xl mx-auto p-0 origin-top transform scale-75 md:scale-100 transition-transform">
                 {printFormat === 'label-4x6' ? (
                   // 4x6 Label Template
                   <div className="w-[4in] h-[6in] p-4 flex flex-col items-center justify-between border border-dashed border-slate-200 relative">
                      <div className="w-full text-center border-b-2 border-black pb-4">
                         <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">WMS 360</h2>
                         <p className="text-xs font-bold uppercase">Inventory Tag</p>
                      </div>
                      
                      <div className="text-center my-4">
                         <h1 className="text-4xl font-black mb-2 line-clamp-2 leading-tight px-4">{selectedProduct.name}</h1>
                         <p className="text-xl font-mono text-slate-500">{selectedProduct.id}</p>
                      </div>

                      <div className="w-full flex justify-center py-4 bg-white">
                          <QRCode value={JSON.stringify({loc: selectedProduct.location || '-', name: selectedProduct.name, stock: selectedProduct.stock})} size={150} />
                      </div>
                      
                      <div className="w-full grid grid-cols-2 border-t-2 border-black pt-4 mt-auto">
                          <div>
                             <p className="text-xs font-bold uppercase text-slate-500">Location</p>
                             <p className="text-2xl font-black">{selectedProduct.location || '-'}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-xs font-bold uppercase text-slate-500">Category</p>
                             <p className="text-lg font-bold">{selectedProduct.category}</p>
                          </div>
                      </div>
                       <div className="w-full text-center mt-4">
                          <Barcode value={selectedProduct.id} width={2} height={40} fontSize={12} displayValue={false} />
                       </div>
                   </div>
                 ) : (
                   // A4 Sheet Template (Grid)
                   <div className="w-[210mm] min-h-[297mm] p-[10mm] grid grid-cols-3 gap-4 content-start bg-white">
                      {Array.from({ length: quantity }).map((_, i) => (
                         <div key={i} className="border border-slate-300 rounded-lg p-3 flex flex-col items-center text-center h-[40mm] justify-between break-inside-avoid">
                            <h4 className="font-bold text-xs line-clamp-2 w-full leading-tight">{selectedProduct.name}</h4>
                            <div className="my-1">
                               <Barcode value={selectedProduct.id} width={1.2} height={25} fontSize={10} displayValue={true} />
                            </div>
                            <div className="w-full flex justify-between items-end border-t border-slate-100 pt-1 mt-1">
                               <span className="text-[10px] text-slate-500">{selectedProduct.location}</span>
                               <span className="text-[10px] font-bold">WMS 360</span>
                            </div>
                         </div>
                      ))}
                   </div>
                 )}
              </div>
           )}
        </div>

      </div>
    </div>
  );
}
