'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2, Image as ImageIcon, Tag, Upload, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { errorMessage } from '@/lib/errors';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product?: any; // If provided, Edit Mode
    onSuccess: () => void;
    onOpenImport?: () => void;
}

export function ProductModal({ isOpen, onClose, product, onSuccess, onOpenImport }: ProductModalProps) {
    const { t } = useLanguage();
    const isEdit = !!product;
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [emptyLocations, setEmptyLocations] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>(["FENIX", "FORMICA", "TD BORD", "TOP BORD"]);
    
    // Form State
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        price: '',
        cost: '',
        stock: '', // Read-only in Edit? Usually Add only sets initial stock? User screenshot has Min Stock. 
                   // Usually Stock is managed via Transactions. 
                   // Let's allow editing ALL fields for flexibility as requested, but maybe warn about Stock.
                   // Actually, Add Product adds a row. "Stock" in row is usually calculated or initial? 
                   // In "Stock Card", stock is calculated from transactions. 
                   // In Master Sheet, there is a "Stock" column? Or is it calculated?
                   // User screenshot: Column F is "Min Qty". Column B is Name. 
                   // Real Stock is likely calculated. 
                   // BUT, legacy `getProducts` reads "จำนวนสินค้าคงเหลือ" (Stock) from a column.
                   // If I write to that column, does it break formulas? 
                   // "Add Product" usually initializes it.
                   // I will include Min Stock (F). 
                   // I will OMIT "Current Stock" from the form because that should be managed via IN/OUT ops, 
                   // OR if the user manually sets it here, it might overwrite formula?
                   // The screenshot does NOT show a "Current Stock" column (Location, Name, Buy, Sell, Unit, Min, Cat, Status, Img, Link).
                   // So Stock is NOT in the Master Sheet (it's likely VLOOKUP'd or calculated elsewhere).
                   // SO: DO NOT EDIT STOCK HERE. Only Min Stock.
        minStock: '',
        unit: '',
        location: '',
        status: 'Active',
        image: ''
    });

    useEffect(() => {
        if (isOpen) {
             if (product) {
                 setFormData({
                     name: product.name || '',
                     category: product.category || '',
                     price: product.price?.toString() || '',
                     cost: product.cost?.toString() || '', // We might need to fetch cost derived if not in product object
                     stock: product.stock?.toString() || '',
                     minStock: product.minStock?.toString() || '',
                     unit: product.unit || '',
                     location: product.location || '',
                     status: product.status || 'Active',
                     image: product.image || ''
                 });
             } else {
                 // Reset for Add
                 setFormData({
                     name: '',
                     category: '',
                     price: '',
                     cost: '',
                     stock: '', 
                     minStock: '',
                     unit: 'ชิ้น',
                     location: '',
                     status: 'Active',
                     image: ''
                 });
             }
        }
    }, [isOpen, product]);

    useEffect(() => {
        if (!isOpen) return;

        const urlParams = new URLSearchParams(window.location.search);
        const branchId = urlParams.get('branchId') || 'hq';

        fetch(`/api/products/locations?branchId=${encodeURIComponent(branchId)}`, { cache: 'no-store' })
            .then(res => res.ok ? res.json() : { locations: [] })
            .then(data => setEmptyLocations(Array.isArray(data.locations) ? data.locations : []))
            .catch(() => setEmptyLocations([]));

        fetch(`/api/products/categories?branchId=${encodeURIComponent(branchId)}`, { cache: 'no-store' })
            .then(res => res.ok ? res.json() : { categories: [] })
            .then(data => setCategories(Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : ["FENIX", "FORMICA", "TD BORD", "TOP BORD"]))
            .catch(() => setCategories(["FENIX", "FORMICA", "TD BORD", "TOP BORD"]));
    }, [isOpen]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('sku', product?.id || formData.name || 'product');
            const res = await fetch('/api/products/image', { method: 'POST', body: fd });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Upload failed');
            setFormData(prev => ({ ...prev, image: json.url }));
        } catch (err) {
            alert('อัปโหลดรูปไม่สำเร็จ: ' + errorMessage(err));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const branchId = urlParams.get('branchId') || 'hq';

            // Edit -> /api/products/update (maps camelCase -> snake_case, matches by sku/name)
            // Add  -> /api/products (POST upsert)
            const endpoint = isEdit ? '/api/products/update' : '/api/products';
            const method = 'POST';
            const body: any = isEdit ? {
                branchId,
                oldName: product.id || product.name,
                updates: {
                    name: formData.name,
                    category: formData.category,
                    price: parseFloat(formData.price) || 0,
                    ...(formData.cost !== '' ? { cost: parseFloat(formData.cost) || 0 } : {}),
                    minStock: parseFloat(formData.minStock) || 0,
                    unit: formData.unit,
                    location: formData.location,
                    status: formData.status,
                    image: formData.image
                }
            } : {
                // Add New
                ...formData,
                branchId,
                price: parseFloat(formData.price) || 0,
                cost: parseFloat(formData.cost) || 0,
                minStock: parseFloat(formData.minStock) || 0,
                status: formData.status,
            };

            const submitProduct = async (payload: any) => {
                const res = await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                return { res, json };
            };

            let { res, json } = await submitProduct(body);

            if (res.status === 409 && json.conflict) {
                if (!isEdit) {
                    throw new Error(`Location ${json.conflict.location} is already used by ${json.conflict.productName}`);
                }

                const shouldSwap = confirm(
                    `Location ${json.conflict.location} is already used by ${json.conflict.productName}.\n\nDo you want to swap locations?`
                );

                if (!shouldSwap) {
                    setLoading(false);
                    return;
                }

                body.updates = {
                    ...body.updates,
                    swapLocation: true,
                };

                ({ res, json } = await submitProduct(body));
            }

            if (!res.ok) throw new Error(json.error || 'Failed to save');

            alert(isEdit ? 'Product updated!' : 'Product added!');
            onSuccess();
            onClose();

        } catch (error) {
            alert('Error: ' + errorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    return (
      <AnimatePresence>
        {isOpen && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white/95 backdrop-blur-xl border border-white/90 rounded-[24px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-900"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-md z-10">
                        <div>
                            <h2 className="text-xl font-mono font-bold text-slate-900 tracking-tight">
                                {isEdit ? t('edit_product') : t('add_product')}
                            </h2>
                            <p className="text-xs font-mono text-slate-500 mt-0.5">
                                {isEdit ? `Editing: ${product.name}` : 'Create a new inventory item'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isEdit && onOpenImport && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onOpenImport();
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-mono text-xs font-bold transition-all"
                                    title="นำเข้าสินค้าจากไฟล์ Excel หรือ CSV"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    <span>นำเข้า Excel / CSV</span>
                                </button>
                            )}
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Name & Category */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block">Product Name *</label>
                                <input 
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 transition-all"
                                    placeholder="e.g. iPhone 15 Pro"
                                />
                             </div>
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block">Category</label>
                                <div className="relative">
                                    <Tag className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                                    <input 
                                        list="product-category-options"
                                        value={formData.category}
                                        onChange={e => setFormData({...formData, category: e.target.value})}
                                        className="w-full pl-10 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 transition-all"
                                        placeholder={categories[0] || "FORMICA"}
                                    />
                                    <datalist id="product-category-options">
                                        {categories.map(category => (
                                            <option key={category} value={category} />
                                        ))}
                                    </datalist>
                                </div>
                             </div>
                        </div>

                        {/* Prices */}
                        <div className="grid grid-cols-2 gap-5 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block">Cost Price (฿)</label>
                                <input 
                                    type="number"
                                    value={formData.cost}
                                    onChange={e => setFormData({...formData, cost: e.target.value})}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500 transition-all"
                                    placeholder="0.00"
                                />
                             </div>
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-emerald-700 uppercase tracking-wider block">Selling Price (฿)</label>
                                <input 
                                    type="number"
                                    value={formData.price}
                                    onChange={e => setFormData({...formData, price: e.target.value})}
                                    className="w-full bg-white border border-emerald-300 rounded-xl px-4 py-2.5 font-mono font-bold text-sm text-emerald-700 outline-none focus:border-emerald-500 transition-all"
                                    placeholder="0.00"
                                />
                             </div>
                        </div>

                        {/* Logistics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block">Unit</label>
                                <input 
                                    value={formData.unit}
                                    onChange={e => setFormData({...formData, unit: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500 transition-all"
                                    placeholder="pcs"
                                />
                             </div>
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block">Min Stock</label>
                                <input 
                                    type="number"
                                    value={formData.minStock}
                                    onChange={e => setFormData({...formData, minStock: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500 transition-all"
                                    placeholder="10"
                                />
                             </div>
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({...formData, status: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500 transition-all"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">inActive</option>
                                </select>
                             </div>
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block">Location</label>
                                <input 
                                    list="empty-product-locations"
                                    value={formData.location}
                                    onChange={e => setFormData({...formData, location: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500 transition-all"
                                    placeholder={emptyLocations[0] || "A-001"}
                                />
                                <datalist id="empty-product-locations">
                                    {emptyLocations.map(location => (
                                        <option key={location} value={location} />
                                    ))}
                                </datalist>
                              </div>
                        </div>

                         {/* Image */}
                         <div className="space-y-1.5">
                                <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block">รูปสินค้า (อัปโหลด หรือใส่ URL)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <ImageIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                                        <input
                                            value={formData.image}
                                            onChange={e => setFormData({...formData, image: e.target.value})}
                                            className="w-full pl-10 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-900 outline-none focus:border-emerald-500 transition-all"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <label className={`shrink-0 px-4 py-2.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors ${uploading ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}>
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
                                        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                                    </label>
                                </div>
                                {formData.image && (
                                    <div className="mt-2 h-28 w-full rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center">
                                         <img src={formData.image} alt="Preview" className="h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                    </div>
                                )}
                        </div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                type="button" 
                                onClick={onClose}
                                className="px-5 py-2.5 font-mono font-bold text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={loading || !formData.name}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                                {isEdit ? 'Save Changes' : 'Create Product'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    );
}
