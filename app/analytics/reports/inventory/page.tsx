'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Filter, Search, Calendar } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface Transaction {
    transaction_id: string;
    date: string;
    product_name: string;
    type: 'IN' | 'OUT';
    quantity: number;
    location: string;
    user: string;
    reason?: string;
    product?: string;
    qty?: number;
    docRef?: string;
    owner?: string;
}

export default function InventoryReportPage() {
    const { t } = useLanguage();

    // State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        type: 'ALL',
        search: ''
    });

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.type !== 'ALL') params.append('type', filters.type);
            if (filters.search) params.append('search', filters.search);

            const res = await fetch(`/api/reports/inventory?${params.toString()}`);
            const json = await res.json();
            if (json.data) {
                setTransactions(json.data);
            }
        } catch (error) {
            console.error("Failed to fetch report:", error);
        } finally {
            setLoading(false);
        }
    };

    // Initial Load & Filter Change
    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchData();
        }, 500); // 500ms debounce for search
        return () => clearTimeout(timeout);
    }, [filters]);

    // Export CSV
    const handleExport = () => {
        const headers = ['Date', 'Transaction ID', 'Type', 'Product', 'Quantity', 'Location', 'User', 'Reason'];
        const rows = transactions.map(t => [
            t.date,
            t.transaction_id || t.docRef || '-',
            t.type,
            `"${(t.product_name || t.product || '').replace(/"/g, '""')}"`, // Escape quotes
            t.quantity ?? t.qty ?? 0,
            t.location,
            t.user || t.owner || '-',
            `"${(t.reason || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `inventory_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8">
            <AmbientBackground />
            
            <div className="relative z-10 max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="relative overflow-hidden rounded-[1.75rem] border border-blue-500/30 bg-[#171c23] p-6 shadow-xl shadow-blue-900/10 backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-cyan-500 to-emerald-500" />
                    <div>
                        <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Inventory Movement</p>
                        <h1 className="text-3xl font-black text-[#dee2ec]">
                            {t('inventory_report_title')}
                        </h1>
                        <p className="text-[#8a92a6] text-sm mt-1 font-semibold">
                            {t('inventory_report_subtitle')}
                        </p>
                    </div>
                    <button 
                        onClick={handleExport}
                        className="relative z-10 flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-xl transition-colors text-sm font-bold text-white shadow-lg shadow-blue-500/20"
                    >
                        <Download className="w-4 h-4" /> {t('export_csv')}
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-[#171c23] backdrop-blur-xl border border-[#30353d] rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-end shadow-sm">
                    
                    {/* Date Range */}
                    <div className="flex gap-2">
                        <div className="space-y-1">
                            <label className="text-xs text-[#8a92a6] font-bold ml-1">{t('date_start')}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 text-[#8a92a6] w-4 h-4" />
                                <input 
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="pl-9 pr-4 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-40 text-[#d1c6ab]"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-[#8a92a6] font-bold ml-1">{t('date_end')}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 text-[#8a92a6] w-4 h-4" />
                                <input 
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="pl-9 pr-4 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-40 text-[#d1c6ab]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Type Filter */}
                    <div className="space-y-1">
                        <label className="text-xs text-[#8a92a6] font-bold ml-1">{t('col_type')}</label>
                        <select 
                            value={filters.type}
                            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                            className="px-4 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-32 text-[#d1c6ab]"
                        >
                            <option value="ALL">{t('all_types')}</option>
                            <option value="IN">{t('inbound_receive')}</option>
                            <option value="OUT">{t('outbound_issue')}</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="flex-1 space-y-1 w-full">
                         <label className="text-xs text-[#8a92a6] font-bold ml-1">{t('search')}</label>
                         <div className="relative">
                            <Search className="absolute left-3 top-3 text-[#8a92a6] w-4 h-4" />
                            <input 
                                type="text"
                                placeholder={t('search_placeholder')}
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full pl-9 pr-4 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[#d1c6ab] placeholder-[#8a92a6]"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-[#171c23] backdrop-blur-xl border border-[#30353d] rounded-2xl overflow-hidden shadow-xl shadow-slate-900/5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1b2027] text-[#8a92a6] text-xs uppercase tracking-wider">
                                    <th className="p-4 font-medium">{t('col_date')}</th>
                                    <th className="p-4 font-medium">{t('col_id')}</th>
                                    <th className="p-4 font-medium">{t('col_type')}</th>
                                    <th className="p-4 font-medium">{t('product')}</th>
                                    <th className="p-4 font-medium text-right">{t('col_qty')}</th>
                                    <th className="p-4 font-medium">{t('delivery_location')}</th>
                                    <th className="p-4 font-medium">{t('col_user')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#30353d]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-[#8a92a6]">
                                            <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                            <p>{t('loading_transactions')}</p>
                                        </td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-[#8a92a6]">
                                            {t('no_transactions_found')}
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((transaction, i) => (
                                        <motion.tr 
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="hover:bg-blue-500/10/60 transition-colors text-sm text-[#d1c6ab]"
                                        >
                                            <td className="p-4 whitespace-nowrap">{transaction.date}</td>
                                            <td className="p-4 font-mono text-xs text-[#8a92a6]">{transaction.transaction_id || transaction.docRef || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                                    transaction.type === 'IN' 
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                }`}>
                                                    {transaction.type === 'IN' ? t('inbound_receive') : t('outbound_issue')}
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold text-[#dee2ec]">{transaction.product_name || transaction.product}</td>
                                            <td className="p-4 text-right font-mono text-blue-700 font-bold">{(transaction.quantity ?? transaction.qty ?? 0).toLocaleString()}</td>
                                            <td className="p-4">{transaction.location}</td>
                                            <td className="p-4 text-[#8a92a6] text-xs">{transaction.user || transaction.owner || '-'}</td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
