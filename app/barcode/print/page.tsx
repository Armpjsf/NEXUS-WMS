'use client';

import { useState, useEffect, useRef } from 'react';
import { Printer, Search, Check, Grid } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';

export default function BarcodePrintPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [printFormat, setPrintFormat] = useState<'label-4x6' | 'a4-sheet'>('label-4x6');
  const [quantity, setQuantity] = useState(1);
  const [orgName, setOrgName] = useState('Nexus WMS');
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(getApiUrl('/api/products'))
      .then(res => res.json())
      .then(data => setProducts(data || []))
      .catch(console.error);
    fetch(getApiUrl('/api/org'), { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(dOrg => { if (dOrg?.name) setOrgName(dOrg.name); })
      .catch(() => {});
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
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Open Page Header */}
        <header className="pt-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Label Studio
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Printer className="w-7 h-7 text-emerald-600 shrink-0" />
            <span>Print Labels</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">สร้างสติ๊กเกอร์บาร์โค้ดสินค้าสำหรับใบปะหน้า 4&quot;×6&quot; และแผ่นสติ๊กเกอร์ A4</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: Controls */}
          <div className="lg:col-span-1 space-y-5">
            {/* Product Search */}
            <div className="nx-glass-card p-6">
              <h3 className="font-bold text-slate-900 text-sm mb-4">1. Select Product</h3>
              <div className="relative mb-4">
                 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                 <input 
                   type="text" 
                   placeholder="Search product..."
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-full pl-10 pr-4 py-2.5 bg-white/85 border border-slate-200 rounded-full text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                 />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                 {filtered.map(p => (
                   <div 
                     key={p.id}
                     onClick={() => setSelectedProduct(p)}
                     className={cn(
                       "p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between",
                       selectedProduct?.id === p.id 
                         ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/30" 
                         : "bg-white/75 border-slate-200/80 hover:bg-white hover:border-slate-300"
                     )}
                   >
                      <div className="truncate pr-2">
                         <div className="font-semibold text-slate-900 text-sm truncate">{p.name}</div>
                         <div className="text-xs font-mono text-slate-500">{p.id}</div>
                      </div>
                      {selectedProduct?.id === p.id && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                   </div>
                 ))}
              </div>
            </div>

            {/* Config */}
            <div className="nx-glass-card p-6">
               <h3 className="font-bold text-slate-900 text-sm mb-4">2. Configuration</h3>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Format</label>
                     <div className="grid grid-cols-2 gap-2.5">
                        <button 
                          onClick={() => setPrintFormat('label-4x6')}
                          className={cn(
                            "p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all",
                            printFormat === 'label-4x6'
                              ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                              : "bg-white/80 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900"
                          )}
                        >
                           <Printer className="w-4 h-4" />
                           4&quot; x 6&quot; Label
                        </button>
                        <button 
                          onClick={() => setPrintFormat('a4-sheet')}
                          className={cn(
                            "p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all",
                            printFormat === 'a4-sheet'
                              ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                              : "bg-white/80 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900"
                          )}
                        >
                           <Grid className="w-4 h-4" />
                           A4 Sheet (3x8)
                        </button>
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Quantity</label>
                     <input 
                       type="number" 
                       min="1" max="100"
                       value={quantity}
                       onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                       className="w-full px-4 py-2.5 bg-white/85 border border-slate-200 rounded-full font-bold text-slate-900 tabular-nums outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                     />
                  </div>
               </div>
            </div>

            <button
               onClick={handlePrint}
               disabled={!selectedProduct}
               className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
            >
               <Printer className="w-4 h-4" /> Print Now
            </button>
          </div>

          {/* Right: Preview — surrounding glass container, inner label strictly black-on-white */}
          <div className="lg:col-span-2 nx-glass-card p-6 md:p-8 flex items-center justify-center overflow-auto min-h-[600px]">
             {!selectedProduct ? (
                <div className="text-center text-slate-500">
                   <Printer className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                   <p className="text-sm font-medium">Select a product to preview label</p>
                </div>
             ) : (
                <div ref={componentRef} className="bg-white text-black shadow-xl mx-auto p-0 origin-top transform scale-75 md:scale-100 transition-transform">
                   {printFormat === 'label-4x6' ? (
                     // 4x6 Label Template
                     <div className="w-[4in] h-[6in] p-4 flex flex-col items-center justify-between border border-dashed border-slate-300 relative bg-white text-black">
                        <div className="w-full text-center border-b-2 border-black pb-4">
                           <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">{orgName}</h2>
                           <p className="text-xs font-bold uppercase">Inventory Tag</p>
                        </div>
                        
                        <div className="text-center my-4">
                           <h1 className="text-4xl font-black mb-2 line-clamp-2 leading-tight px-4">{selectedProduct.name}</h1>
                           <p className="text-xl font-mono text-slate-700">{selectedProduct.id}</p>
                        </div>

                        <div className="w-full flex justify-center py-4 bg-white">
                            <QRCode value={JSON.stringify({loc: selectedProduct.location || '-', name: selectedProduct.name, stock: selectedProduct.stock})} size={150} />
                        </div>
                        
                        <div className="w-full grid grid-cols-2 border-t-2 border-black pt-4 mt-auto">
                            <div>
                               <p className="text-xs font-bold uppercase text-slate-700">Location</p>
                               <p className="text-2xl font-black">{selectedProduct.location || '-'}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-xs font-bold uppercase text-slate-700">Category</p>
                               <p className="text-lg font-bold">{selectedProduct.category}</p>
                            </div>
                        </div>
                         <div className="w-full text-center mt-4">
                            <Barcode value={selectedProduct.id} width={2} height={40} fontSize={12} displayValue={false} />
                         </div>
                     </div>
                   ) : (
                     // A4 Sheet Template (Grid)
                     <div className="w-[210mm] min-h-[297mm] p-[10mm] grid grid-cols-3 gap-4 content-start bg-white text-black">
                        {Array.from({ length: quantity }).map((_, i) => (
                           <div key={i} className="border border-slate-300 rounded-lg p-3 flex flex-col items-center text-center h-[40mm] justify-between break-inside-avoid bg-white text-black">
                              <h4 className="font-bold text-xs line-clamp-2 w-full leading-tight">{selectedProduct.name}</h4>
                              <div className="my-1">
                                 <Barcode value={selectedProduct.id} width={1.2} height={25} fontSize={10} displayValue={true} />
                              </div>
                              <div className="w-full flex justify-between items-end border-t border-slate-200 pt-1 mt-1">
                                 <span className="text-[10px] text-slate-700">{selectedProduct.location}</span>
                                 <span className="text-[10px] font-bold">{orgName}</span>
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
    </div>
  );
}
