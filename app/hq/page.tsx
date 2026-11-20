'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, TrendingUp, AlertTriangle, Package, RefreshCw, DollarSign } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface BranchStat {
    id: string;
    name: string;
    color: string;
    totalStock: number;
    totalValue: number;
    lowStockCount: number;
    activeCount: number;
    status: 'Online' | 'Offline';
}

export default function HQDashboard() {
    const { t } = useLanguage();
    const [stats, setStats] = useState<{ branches: BranchStat[], global: any } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = () => {
        setLoading(true);
        fetch(getApiUrl('/api/hq/stats'))
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => { fetchData() }, []);

    if (loading) return (
        <div className="theme-nexus-hybrid min-h-screen flex items-center justify-center">
            <div className="nx-glass-card p-6 flex items-center gap-3">
                <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                <span className="text-sm font-semibold text-slate-700">Loading HQ telemetry...</span>
            </div>
        </div>
    );

    if (!stats) return null;

    return (
        <div className="theme-nexus-hybrid min-h-screen relative px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
            <div className="max-w-[1500px] mx-auto space-y-6">
                {/* Open Page Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-1">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Multi-Branch Command
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
                            <Building2 className="w-7 h-7 text-emerald-600 shrink-0" />
                            <span>{t('hq_title')}</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('hq_subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/75 border border-white/90 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs tabular-nums">
                            {stats.branches.length} branches monitored
                        </span>
                        <button
                            onClick={fetchData}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Global Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <MetricCard
                        title={t('global_valuation')}
                        value={`฿${stats.global.totalValue.toLocaleString()}`}
                        icon={DollarSign}
                        variant="emerald"
                    />
                    <MetricCard
                        title={t('total_inventory_all')}
                        value={stats.global.totalStock.toLocaleString()}
                        subtitle={t('units_across_branches')}
                        icon={Package}
                        variant="sky"
                    />
                    {/* 1 Hero Dark Accent Alert Card */}
                    <motion.div
                        whileHover={{ y: -3 }}
                        className="nx-dark-accent-card p-6 relative overflow-hidden flex flex-col justify-between"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                    Global Alert
                                </div>
                                <p className="text-slate-300 font-semibold text-xs uppercase tracking-wider">{t('critical_alerts_all')}</p>
                            </div>
                            <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold tracking-tight text-white tabular-nums">
                                {Number(stats.global.lowStockCount || 0).toLocaleString()}
                            </h3>
                            <p className="text-slate-400 text-xs mt-1">{t('items_needing_restock')}</p>
                        </div>
                    </motion.div>
                </div>

                {/* Branch Breakdown */}
                <div className="flex items-center justify-between pt-2">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/25">
                            <TrendingUp className="w-4 h-4" />
                        </span>
                        {t('branch_performance')}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {stats.branches.map((branch) => (
                        <motion.div
                            key={branch.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="nx-glass-card p-6 transition-all hover:-translate-y-0.5"
                        >
                            <div className="flex justify-between items-start mb-5">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "flex h-2.5 w-2.5 rounded-full ring-4",
                                        branch.status === 'Online' ? "bg-emerald-500 ring-emerald-500/20" : "bg-rose-500 ring-rose-500/20"
                                    )} />
                                    <div>
                                        <h3 className="font-bold text-base text-slate-900">{branch.name}</h3>
                                        <span className={cn(
                                            "inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                            branch.status === 'Online'
                                                ? "bg-emerald-500/12 text-emerald-700 border-emerald-500/20"
                                                : "bg-rose-500/12 text-rose-700 border-rose-500/25"
                                        )}>
                                            {branch.status === 'Online' ? t('online') : t('offline')}
                                        </span>
                                    </div>
                                </div>
                                <div className={cn(
                                    "p-2.5 rounded-2xl border",
                                    branch.status === 'Online'
                                        ? "bg-emerald-500/12 text-emerald-700 border-emerald-500/20"
                                        : "bg-rose-500/12 text-rose-700 border-rose-500/20"
                                )}>
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <Row label={t('stock_value')} value={`฿${branch.totalValue.toLocaleString()}`} />
                                <Row label={t('active_items')} value={branch.activeCount} />
                                <Row label={t('critical_stock')} value={branch.lowStockCount} highlight={branch.lowStockCount > 0} />
                            </div>

                            <div className="mt-5 pt-4 border-t border-slate-200/70">
                                <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full", branch.status === "Online" ? "bg-emerald-500" : "bg-rose-500")}
                                        style={{ width: '70%' }}
                                    />
                                </div>
                                <p className="text-[11px] font-medium text-slate-500 mt-2 text-right">{t('capacity_used')}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, value, subtitle, icon: Icon, variant }: { title: string; value: any; subtitle?: string; icon: any; variant: 'emerald' | 'sky' }) {
    const iconTone = variant === 'emerald'
        ? "bg-emerald-500/12 text-emerald-700 border-emerald-500/20"
        : "bg-sky-500/12 text-sky-700 border-sky-500/20";

    return (
        <motion.div
            whileHover={{ y: -3 }}
            className="nx-glass-card p-6 flex flex-col justify-between"
        >
            <div className="flex justify-between items-start mb-3">
                <div>
                    <p className="text-slate-600 font-semibold text-xs uppercase tracking-wider mb-1.5">{title}</p>
                    <h3 className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</h3>
                </div>
                <div className={cn("p-2.5 rounded-2xl border", iconTone)}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            {subtitle && <p className="text-slate-500 text-xs font-medium">{subtitle}</p>}
        </motion.div>
    );
}

function Row({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
    return (
        <div className="flex justify-between items-center rounded-xl bg-white/70 border border-slate-200/70 px-3.5 py-2 text-sm">
            <span className="text-slate-600 font-medium text-xs">{label}</span>
            <span className={cn("font-bold tabular-nums", highlight ? "text-rose-600" : "text-slate-900")}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
        </div>
    );
}
