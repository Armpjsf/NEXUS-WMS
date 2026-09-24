import { useState, useEffect, useRef } from 'react';
import { Search, X, Package } from 'lucide-react';
// Remove unused NextImage if we switch to regular img tag for consistency with other parts,
// OR keep it but use the proxy URL. Let's use regular img tag to avoid 'hostname' config issues 
// unless we are sure about domains. The user's other pages use regular <img> tags with the proxy.
// For consistency and reliability with dynamic user content, regular <img> is safer here.

interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  image?: string;
  location?: string;
}

interface ProductSelectorProps {
  products?: Product[];
  onSelect: (product: Product | null) => void;
  selectedId?: string;
}

const MOCK_PRODUCTS: Product[] = [];

export default function ProductSelector({ products = MOCK_PRODUCTS, onSelect, selectedId }: ProductSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const selectedProduct = products.find(p => p.id === selectedId);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (product: Product) => {
    onSelect(product);
    setSearchTerm(''); 
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setSearchTerm('');
  };

  const getImageUrl = (url: string) => {
      // Use the proxy for all images to handle Google Drive links correctly
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Select Product</label>
      
      {selectedProduct ? (
        // Selected View - Show Card + Clear Button
        <div className="w-full bg-white border border-indigo-100 rounded-2xl p-3 flex items-center justify-between animate-in fade-in zoom-in-95 duration-200 shadow-sm">
             <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-slate-50 rounded-xl flex-shrink-0 relative overflow-hidden border border-slate-100 p-1">
                    {selectedProduct.image ? (
                        <img 
                            src={getImageUrl(selectedProduct.image)} 
                            alt={selectedProduct.name} 
                            className="w-full h-full object-cover rounded-lg" 
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package className="w-6 h-6" />
                        </div>
                    )}
                 </div>
                 <div>
                    <div className="font-bold text-slate-800 text-sm line-clamp-1">{selectedProduct.name}</div>
                    <div className="text-xs text-indigo-500 font-bold font-mono">{selectedProduct.location || '-'} <span className="text-slate-400 font-medium">| Stock: {selectedProduct.stock}</span></div>
                 </div>
             </div>
             <button 
                onClick={handleClear}
                className="p-2 hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500 transition-colors"
                title="Change Selection"
             >
                <X className="w-5 h-5" />
             </button>
        </div>
      ) : (
        // Search View
        <div className="relative group">
            <input 
                type="text"
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                placeholder="🔍 Search items by name or ID..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:font-medium placeholder:text-slate-400"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            
            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto no-scrollbar">
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                            <div 
                                key={product.id}
                                className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0 transition-colors"
                                onClick={() => handleSelect(product)}
                            >
                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex-shrink-0 relative overflow-hidden p-0.5 border border-slate-100">
                                     {product.image ? (
                                        <img 
                                            src={getImageUrl(product.image)} 
                                            alt={product.name} 
                                            className="w-full h-full object-cover rounded-md" 
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <Package className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm text-slate-800 font-bold line-clamp-1">{product.name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600">{product.location || '-'}</span>
                                        <span className={product.stock < 10 ? "text-rose-500 font-bold" : "text-emerald-600 font-bold"}>Stock: {product.stock}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-400 text-sm font-medium">
                            No products found matching "{searchTerm}"
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
}
