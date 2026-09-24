'use client';

import { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  image?: string;
  sku?: string; // Sometimes SKU is key or derived
}

interface LabelDesignerProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

export default function LabelDesigner({ product, isOpen, onClose }: LabelDesignerProps) {
  const [labelSize, setLabelSize] = useState<'4x6' | 'sticker' | 'qr'>('sticker');
  const printRef = useRef<HTMLDivElement>(null);
  
  // State for customization (can expand later)
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Label-${product.name}`,
    pageStyle: labelSize === '4x6' 
      ? `@page { size: 4in 6in; margin: 0; }` 
      : labelSize === 'sticker' 
        ? `@page { size: 50mm 30mm; margin: 0; }` // Common thermal sticker size
        : `@page { size: auto; margin: 0; }`, // Default
  } as any);

  // Effect to render barcode
  useEffect(() => {
    if (isOpen && labelSize === 'sticker') {
         // Tiny delay to ensure DOM is ready
         setTimeout(() => {
            try {
                JsBarcode("#barcode-canvas", product.id || "UNKNOWN", {
                    format: "CODE128",
                    width: 1.5,
                    height: 40,
                    displayValue: true,
                    fontSize: 12,
                    margin: 0
                });
            } catch (e) {
                console.error("Barcode Render Error", e);
            }
         }, 100);
    }
  }, [isOpen, labelSize, product]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Printer className="w-5 h-5 text-indigo-600" />
              Label Designer
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6 flex flex-col lg:flex-row gap-8">
             {/* Controls */}
             <div className="w-full lg:w-1/3 space-y-6">
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-3">Label Type</label>
                   <div className="space-y-2">
                      <button 
                        onClick={() => setLabelSize('sticker')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${labelSize === 'sticker' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                         <div className="w-8 h-5 border-2 border-current rounded-sm"></div>
                         <div className="text-left">
                            <div className="font-bold text-sm">Thermal Sticker</div>
                            <div className="text-xs opacity-70">50mm x 30mm</div>
                         </div>
                      </button>

                      <button 
                        onClick={() => setLabelSize('qr')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${labelSize === 'qr' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                         <div className="w-6 h-6 border-2 border-current rounded flex items-center justify-center text-[10px]">QR</div>
                         <div className="text-left">
                            <div className="font-bold text-sm">QR Sticker</div>
                            <div className="text-xs opacity-70">Square</div>
                         </div>
                      </button>
                   </div>
                </div>

                <div className="space-y-3">
                   <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-medium text-slate-600">Show Product Name</span>
                   </label>
                   <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-medium text-slate-600">Show Price</span>
                   </label>
                </div>

                <button 
                  onClick={handlePrint}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <Printer className="w-5 h-5" />
                  Print Label
                </button>
             </div>

             {/* Preview */}
             <div className="flex-1 bg-slate-100 rounded-2xl flex items-center justify-center p-8 border border-slate-200 shadow-inner">
                <div className="bg-white shadow-xl isolate">
                   {/* Capture Area */}
                   <div ref={printRef} className="print-content">
                      {labelSize === 'sticker' && (
                        <div className="w-[50mm] h-[30mm] p-[2mm] flex flex-col items-center justify-center text-center bg-white overflow-hidden relative border border-slate-100/50 box-border">
                            {showName && <div className="text-[10px] font-bold leading-tight line-clamp-2 w-full px-1">{product.name}</div>}
                            <canvas id="barcode-canvas" className="w-full h-auto my-1"></canvas>
                            {showPrice && <div className="text-[12px] font-black">฿{product.price.toLocaleString()}</div>}
                        </div>
                      )}

                      {labelSize === 'qr' && (
                         <div className="w-[40mm] h-[40mm] p-2 flex flex-col items-center justify-center bg-white border border-slate-100/50">
                            <QRCodeSVG value={JSON.stringify({loc: (product as any).location || '-', name: product.name, stock: product.stock})} size={100} />
                            {showName && <div className="text-[8px] mt-1 font-bold text-center w-full truncate">{product.name}</div>}
                         </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
