'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Trash2, Plus, ArrowLeft, RefreshCw, Pencil, MapPin, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useNotification } from '@/components/providers/GlobalNotificationProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface BranchConfig {
    id: string;
    name: string;
    color: string;
    warehouseName?: string;
    pickupAddress?: string;
    status: 'Active' | 'Inactive';
}

export default function AdminBranchesPage() {
    const { t } = useLanguage();
    const { sendNotification } = useNotification();
    const [branches, setBranches] = useState<BranchConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<BranchConfig>>({
        id: '',
        name: '',
        color: 'slate',
        warehouseName: '',
        pickupAddress: '',
    });

    const colors = ['slate', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

    const fetchData = () => {
        setLoading(true);
        fetch(getApiUrl('/api/branches'))
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setBranches(data);
                else setBranches([]);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => { fetchData() }, []);

    const startEdit = (b: BranchConfig) => {
        setEditingId(b.id);
        setFormData({
            id: b.id,
            name: b.name,
            color: b.color || 'teal',
            warehouseName: b.warehouseName || b.name,
            pickupAddress: b.pickupAddress || '',
        });
        setIsAdding(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.id || !formData.name) {
            sendNotification('Error', { body: 'กรุณากรอกรหัสและชื่อสาขา' });
            return;
        }

        try {
            const res = await fetch(getApiUrl('/api/branches'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                sendNotification('Success', { body: 'บันทึกข้อมูลสาขาและชื่อคลังเรียบร้อย' });
                setIsAdding(false);
                setEditingId(null);
                setFormData({ id: '', name: '', color: 'slate', warehouseName: '', pickupAddress: '' });
                fetchData();
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            sendNotification('Error', { body: 'ไม่สามารถบันทึกข้อมูลสาขาได้' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('confirm_deactivate_branch'))) return;

        try {
            const res = await fetch(getApiUrl(`/api/branches?id=${id}`), {
                method: 'DELETE'
            });

            if (res.ok) {
                sendNotification('Success', { body: t('branch_deactivated') });
                fetchData();
            } else {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            sendNotification('Error', { body: 'Failed to delete branch.' });
        }
    };

    return (
        <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
             <div className="max-w-5xl mx-auto space-y-6">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
                >
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    {t('back_to_admin')}
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-1"
                >
                   <div>
                       <div className="flex items-center gap-2 mb-1.5">
                           <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                               <Building2 className="w-3 h-3 text-emerald-600" />
                               Multi-Branch &amp; Origin
                           </span>
                       </div>
                       <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                           {t('branch_management_title')}
                       </h1>
                       <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('branch_management_subtitle')}</p>
                   </div>

                   <div className="flex items-center gap-2.5">
                        <button
                            onClick={fetchData}
                            className="p-2.5 bg-white/80 hover:bg-white border border-white/90 rounded-full text-slate-700 hover:text-slate-900 shadow-xs transition-all active:scale-95"
                            title="รีเฟรช"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setIsAdding(!isAdding)}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-xs font-semibold transition-all active:scale-95 shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            {t('add_branch')}
                        </button>
                   </div>
                </motion.div>

                <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleSubmit} className="nx-glass-card p-6">
                            <h3 className="font-bold text-lg text-slate-900 mb-6">
                                {editingId ? '✏️ แก้ไขข้อมูลสาขา & คลังสินค้าต้นทาง' : t('new_branch_details')}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">{t('branch_id_label')}</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. URT"
                                        value={formData.id}
                                        disabled={!!editingId}
                                        onChange={e => setFormData({...formData, id: e.target.value.toUpperCase().replace(/\s+/g, '-')})}
                                        className="w-full px-4 py-2.5 bg-white/80 border border-slate-200/80 rounded-xl font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:opacity-60"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">{t('branch_id_desc')}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">{t('display_name')}</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. สาขาสุราษฎร์ธานี (URT)"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-white/80 border border-slate-200/80 rounded-xl font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-sky-700 uppercase tracking-wider mb-2">
                                        🏢 ชื่อคลังสินค้า / ต้นทางจัดส่ง (Warehouse Origin Name)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. คลังสินค้า สุราษฎร์ธานี หรือ คลังสินค้า URT"
                                        value={formData.warehouseName || ''}
                                        onChange={e => setFormData({...formData, warehouseName: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-sky-500/5 border border-sky-500/25 rounded-xl font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">ชื่อนี้จะถูกส่งไปเป็น "สถานที่ต้นทาง (Pickup Location)" ในงาน TMS</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                        📍 ที่อยู่คลังสินค้าต้นทาง (Pickup Address)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 123/45 ถ.กาญจนวิถี ต.บางกุ้ง อ.เมือง จ.สุราษฎร์ธานี 84000"
                                        value={formData.pickupAddress || ''}
                                        onChange={e => setFormData({...formData, pickupAddress: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-white/80 border border-slate-200/80 rounded-xl font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                     <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">{t('branch_color')}</label>
                                     <div className="flex flex-wrap gap-2">
                                        {colors.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData({...formData, color})}
                                                className={cn(
                                                    "w-8 h-8 rounded-full border-2 transition-all",
                                                    formData.color === color ? "border-slate-900 scale-110 ring-2 ring-slate-900/20" : "border-white hover:scale-105",
                                                    `bg-${color}-500`
                                                )}
                                            />
                                        ))}
                                     </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200/70">
                                <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-5 py-2 rounded-full font-semibold text-xs text-slate-600 hover:bg-slate-100 transition-colors">{t('cancel')}</button>
                                <button type="submit" className="px-6 py-2 rounded-full font-semibold text-xs bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm">{t('save_branch')}</button>
                            </div>
                        </form>
                    </motion.div>
                )}
                </AnimatePresence>

                {/* List */}
                <div className="space-y-3.5">
                    {loading ? (
                        <div className="text-center py-20 text-slate-500 text-sm">{t('loading')}</div>
                    ) : branches.length === 0 ? (
                        <div className="nx-glass-card p-10 text-center">
                            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-900">No Branches Configured</h3>
                            <p className="text-slate-600 text-sm mb-6">Start by adding your first branch configuration.</p>
                            <button onClick={() => setIsAdding(true)} className="px-5 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">{t('add_branch')}</button>
                        </div>
                    ) : (
                        branches.map((branch) => (
                            <motion.div
                                key={branch.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="nx-glass-card p-5 flex flex-col md:flex-row items-start md:items-center gap-5 group hover:-translate-y-0.5 transition-all"
                            >
                                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0", `bg-gradient-to-br from-${branch.color}-500 to-${branch.color}-700`)}>
                                    <Building2 className="w-7 h-7" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-lg text-slate-900 flex items-center gap-2.5 flex-wrap">
                                        {branch.name}
                                        <span className="text-[11px] bg-slate-100 border border-slate-200 text-slate-700 px-3 py-0.5 rounded-full font-mono font-bold tracking-wider">{branch.id}</span>
                                    </h4>

                                    <div className="flex items-center gap-2.5 mt-2 flex-wrap text-xs text-slate-600">
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-500/12 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ใช้งาน
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-sky-700 bg-sky-500/12 border border-sky-500/20 px-3 py-0.5 rounded-full">
                                            <Warehouse className="w-3.5 h-3.5 text-sky-600" />
                                            <span>คลังต้นทาง TMS: <strong>{branch.warehouseName || branch.name}</strong></span>
                                        </span>
                                        {branch.pickupAddress && (
                                            <span className="inline-flex items-center gap-1 text-slate-600 truncate max-w-md">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{branch.pickupAddress}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => startEdit(branch)}
                                        className="px-3.5 py-2 text-slate-700 hover:text-slate-900 bg-white/80 hover:bg-white rounded-full transition-colors font-semibold text-xs flex items-center gap-1.5 border border-slate-200/80 shadow-xs"
                                        title="แก้ไขข้อมูลสาขา & คลังสินค้า"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        <span>แก้ไข</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(branch.id)}
                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-full transition-colors border border-transparent hover:border-rose-500/20"
                                        title="Deactivate Branch"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
             </div>
        </div>
    );
}
