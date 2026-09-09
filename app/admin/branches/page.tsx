'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Save, Trash2, Plus, ArrowLeft, RefreshCw, AlertCircle, Link as LinkIcon, Palette } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { useNotification } from '@/components/providers/GlobalNotificationProvider';

interface BranchConfig {
    id: string;
    name: string;
    color: string;
    status: 'Active' | 'Inactive';
}

import { useLanguage } from '@/components/providers/LanguageProvider';

export default function AdminBranchesPage() {
    const { t } = useLanguage();
    const { sendNotification } = useNotification();
    const [branches, setBranches] = useState<BranchConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState<Partial<BranchConfig>>({
        id: '',
        name: '',
        color: 'slate'
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.id || !formData.name) {
            sendNotification('Error', { body: 'Please fill in all required fields.' });
            return;
        }

        try {
            const res = await fetch(getApiUrl('/api/branches'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                sendNotification('Success', { body: t('branch_saved_success') });
                setIsAdding(false);
                setFormData({ id: '', name: '', color: 'slate' });
                fetchData();
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            sendNotification('Error', { body: 'Failed to save branch.' });
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
        <div className="min-h-screen p-8 relative overflow-hidden">
             <AmbientBackground />
             
             <div className="max-w-5xl mx-auto relative z-10">
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-xl shadow-indigo-500/5 relative overflow-hidden"
                >
                   <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-600 via-blue-600 to-amber-500" />
                   
                   <div className="relative z-10 flex items-center gap-6">
                       <Link href="/admin" className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:shadow-lg hover:-translate-x-1 transition-all">
                           <ArrowLeft className="w-6 h-6" />
                       </Link>
                       <div>
                           <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                               <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-3 rounded-2xl shadow-lg shadow-indigo-200">
                                 <Building2 className="w-8 h-8" />
                               </div>
                               {t('branch_management_title')}
                           </h1>
                           <p className="text-slate-500 font-medium text-lg ml-2 mt-1">{t('branch_management_subtitle')}</p>
                       </div>
                   </div>
                   
                   <div className="flex gap-3 relative z-10">
                        <button onClick={fetchData} className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:shadow-lg transition-all active:scale-95">
                            <RefreshCw className="w-6 h-6" />
                        </button>
                        <button 
                            onClick={() => setIsAdding(!isAdding)}
                            className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-4 rounded-2xl font-bold hover:shadow-2xl hover:shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95"
                        >
                            <Plus className="w-6 h-6" />
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
                        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl border border-indigo-100">
                            <h3 className="font-bold text-lg text-slate-800 mb-6">{t('new_branch_details')}</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('branch_id_label')}</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. branch-2"
                                        value={formData.id}
                                        onChange={e => setFormData({...formData, id: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">{t('branch_id_desc')}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('display_name')}</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Chiang Mai Branch"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('branch_color')}</label>
                                     <div className="flex flex-wrap gap-2">
                                        {colors.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData({...formData, color})}
                                                className={cn(
                                                    "w-8 h-8 rounded-full border-2 transition-all",
                                                    formData.color === color ? "border-slate-800 scale-110" : "border-transparent hover:scale-105",
                                                    `bg-${color}-500`
                                                )}
                                            />
                                        ))}
                                     </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">{t('cancel')}</button>
                                <button type="submit" className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">{t('save_branch')}</button>
                            </div>
                        </form>
                    </motion.div>
                )}
                </AnimatePresence>

                {/* List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20 text-slate-400">{t('loading')}</div>
                    ) : branches.length === 0 ? (
                        <div className="bg-white rounded-2xl p-10 text-center border dashed border-slate-200">
                            <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-800">No Branches Configured</h3>
                            <p className="text-slate-500 mb-6">Start by adding your first branch configuration.</p>
                            <button onClick={() => setIsAdding(true)} className="text-indigo-600 font-bold hover:underline">{t('add_branch')}</button>
                        </div>
                    ) : (
                        branches.map((branch) => (
                            <motion.div 
                                key={branch.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center gap-5 group hover:border-indigo-100 transition-colors"
                            >
                                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg", `bg-gradient-to-br from-${branch.color}-500 to-${branch.color}-700 shadow-${branch.color}-200`)}>
                                    <Building2 className="w-8 h-8" />
                                </div>
                                
                                <div className="flex-1">
                                    <h4 className="font-black text-xl text-slate-800 flex items-center gap-3">
                                        {branch.name}
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-mono font-bold tracking-wider">{branch.id}</span>
                                    </h4>
                                    <div className="flex items-center gap-2 mt-2">
                                         <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ใช้งาน
                                         </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleDelete(branch.id)}
                                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Deactivate Branch"
                                    >
                                        <Trash2 className="w-5 h-5" />
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
