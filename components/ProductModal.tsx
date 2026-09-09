'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2, Image as ImageIcon, MapPin, Tag, DollarSign, Package, Upload } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product?: any; // If provided, Edit Mode
    onSuccess: () => void;
}

export function ProductModal({ isOpen, onClose, product, onSuccess }: ProductModalProps) {
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
        } catch (err: any) {
            alert('อัปโหลดรูปไม่สำเร็จ: ' + err.message);
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

        } catch (error: any) {
            alert('Error: ' + error.message);
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
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                {isEdit ? t('edit_product') : t('add_product')}
                            </h2>
                            <p className="text-slate-500 font-medium">
                                {isEdit ? `Editing: ${product.name}` : 'Create a new inventory item'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {/* Name & Category */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Product Name *</label>
                                <input 
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    placeholder="e.g. iPhone 15 Pro"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Category</label>
                                <div className="relative">
                                    <Tag className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                    <input 
                                        list="product-category-options"
                                        value={formData.category}
                                        onChange={e => setFormData({...formData, category: e.target.value})}
                                        className="w-full pl-12 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
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
                        <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Cost Price (฿)</label>
                                <input 
                                    type="number"
                                    value={formData.cost}
                                    onChange={e => setFormData({...formData, cost: e.target.value})}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-mono text-slate-600 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="0.00"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Selling Price (฿)</label>
                                <input 
                                    type="number"
                                    value={formData.price}
                                    onChange={e => setFormData({...formData, price: e.target.value})}
                                    className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 font-mono font-bold text-emerald-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                    placeholder="0.00"
                                />
                             </div>
                        </div>

                        {/* Logistics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Unit</label>
                                <input 
                                    value={formData.unit}
                                    onChange={e => setFormData({...formData, unit: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="pcs"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Min Stock</label>
                                <input 
                                    type="number"
                                    value={formData.minStock}
                                    onChange={e => setFormData({...formData, minStock: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="10"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({...formData, status: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 outline-none focus:border-indigo-500 transition-all"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">inActive</option>
                                </select>
                             </div>
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Location</label>
                                <input 
                                    list="empty-product-locations"
                                    value={formData.location}
                                    onChange={e => setFormData({...formData, location: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 outline-none focus:border-indigo-500 transition-all"
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
                         <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">รูปสินค้า (อัปโหลด หรือใส่ URL)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <ImageIcon className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                        <input
                                            value={formData.image}
                                            onChange={e => setFormData({...formData, image: e.target.value})}
                                            className="w-full pl-12 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-blue-600 outline-none focus:border-indigo-500 transition-all"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <label className={`shrink-0 px-4 py-3 rounded-xl border font-bold text-sm flex items-center gap-2 cursor-pointer transition-colors ${uploading ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}>
                                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                        {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
                                        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                                    </label>
                                </div>
                                {formData.image && (
                                    <div className="mt-2 h-32 w-full rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center">
                                         <img src={formData.image} alt="Preview" className="h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                    </div>
                                )}
                        </div>

                        {/* Footer */}
                        <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                type="button" 
                                onClick={onClose}
                                className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={loading || !formData.name}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
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
