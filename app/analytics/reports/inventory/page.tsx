'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Search, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
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

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        type: 'ALL',
        search: ''
    });

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

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchData();
        }, 500);
        return () => clearTimeout(timeout);
    }, [filters]);

    const handleExport = () => {
        const headers = ['Date', 'Transaction ID', 'Type', 'Product', 'Quantity', 'Location', 'User', 'Reason'];
        const rows = transactions.map(t => [
            t.date,
            t.transaction_id || t.docRef || '-',
            t.type,
            `"${(t.product_name || t.product || '').replace(/"/g, '""')}"`,
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
        <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
            <div className="max-w-[1500px] mx-auto space-y-6">
                <Link
                    href="/analytics/reports"
                    className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all w-fit"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {t('back_to_analytics')}
                </Link>

                {/* Open Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-1">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                Inventory Movement
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                            {t('inventory_report_title')}
                        </h1>
                        <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
                            {t('inventory_report_subtitle')}
                        </p>
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full transition-colors text-xs font-semibold shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" /> {t('export_csv')}
                    </button>
                </div>

                {/* Filters */}
                <div className="nx-glass-card p-5 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex flex-wrap gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-600 font-semibold ml-1 block">{t('date_start')}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="pl-10 pr-4 py-2 bg-white/85 border border-slate-200 rounded-full text-xs font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none w-44 text-slate-900"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-600 font-semibold ml-1 block">{t('date_end')}</label>
                            <div className="relative">
                                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="pl-10 pr-4 py-2 bg-white/85 border border-slate-200 rounded-full text-xs font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none w-44 text-slate-900"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Type Filter */}
                    <div className="space-y-1.5">
                        <label className="text-xs text-slate-600 font-semibold ml-1 block">{t('col_type')}</label>
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                            className="px-4 py-2 bg-white/85 border border-slate-200 rounded-full text-xs font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none w-36 text-slate-900 cursor-pointer"
                        >
                            <option value="ALL">{t('all_types')}</option>
                            <option value="IN">{t('inbound_receive')}</option>
                            <option value="OUT">{t('outbound_issue')}</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="flex-1 space-y-1.5 w-full">
                         <label className="text-xs text-slate-600 font-semibold ml-1 block">{t('search')}</label>
                         <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder={t('search_placeholder')}
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full pl-10 pr-4 py-2 bg-white/85 border border-slate-200 rounded-full text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none text-slate-900 placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="nx-glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-slate-700">
                            <thead>
                                <tr className="bg-slate-50/80 sticky top-0 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200/80">
                                    <th className="p-4">{t('col_date')}</th>
                                    <th className="p-4">{t('col_id')}</th>
                                    <th className="p-4">{t('col_type')}</th>
                                    <th className="p-4">{t('product')}</th>
                                    <th className="p-4 text-right">{t('col_qty')}</th>
                                    <th className="p-4">{t('delivery_location')}</th>
                                    <th className="p-4">{t('col_user')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-10 text-center text-slate-500">
                                            <div className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                                            <p className="text-xs">{t('loading_transactions')}</p>
                                        </td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-10 text-center text-slate-500 text-sm">
                                            {t('no_transactions_found')}
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((transaction, i) => (
                                        <motion.tr
                                            key={i}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(i * 0.02, 0.2) }}
                                            className="hover:bg-emerald-50/40 transition-colors text-sm"
                                        >
                                            <td className="p-4 whitespace-nowrap font-mono text-xs text-slate-500">{transaction.date}</td>
                                            <td className="p-4 font-mono text-xs text-slate-500">{transaction.transaction_id || transaction.docRef || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                                    transaction.type === 'IN'
                                                    ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20'
                                                    : 'bg-sky-500/12 text-sky-700 border-sky-500/20'
                                                }`}>
                                                    {transaction.type === 'IN' ? t('inbound_receive') : t('outbound_issue')}
                                                </span>
                                            </td>
                                            <td className="p-4 font-semibold text-slate-900">{transaction.product_name || transaction.product}</td>
                                            <td className="p-4 text-right font-bold text-slate-900 tabular-nums">{(transaction.quantity ?? transaction.qty ?? 0).toLocaleString()}</td>
                                            <td className="p-4 font-mono text-xs text-slate-600">{transaction.location}</td>
                                            <td className="p-4 text-slate-500 text-xs">{transaction.user || transaction.owner || '-'}</td>
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
