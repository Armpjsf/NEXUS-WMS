'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, TrendingUp, AlertTriangle, Package, RefreshCw, DollarSign } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
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
        <div className="min-h-screen flex items-center justify-center bg-[#0f141b]">
            <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-xl">
                <RefreshCw className="w-8 h-8 text-[#57ec7f] animate-spin" />
            </div>
        </div>
    );

    if (!stats) return null;

    return (
        <div className="min-h-screen px-4 py-6 sm:px-6 lg:p-8 relative overflow-hidden">
             <AmbientBackground />
             
             <div className="max-w-[1500px] mx-auto relative z-10 space-y-8">
                {/* Header */}
                <div className="relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-black/20 backdrop-blur-xl">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#4cd7f6]/15 border border-[#4cd7f6]/30 text-[#4cd7f6] shadow-md">
                                <Building2 className="w-7 h-7" />
                            </div>
                            <div>
                                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#4cd7f6]">Multi-Branch Command</p>
                                <h1 className="text-3xl font-black tracking-tight text-[#dee2ec]">{t('hq_title')}</h1>
                                <p className="text-sm font-semibold text-[#8a92a6]">{t('hq_subtitle')}</p>
                            </div>
                        </div>
                        <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-xl border border-[#30353d] bg-[#1b2027] px-4 py-2.5 text-sm font-mono font-bold text-[#d1c6ab] shadow-sm transition-colors hover:border-[#4cd7f6]/30 hover:bg-[#252a32] hover:text-[#4cd7f6]">
                            <RefreshCw className="w-4 h-4 text-[#facc15]" />
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
                        color="indigo"
                     />
                     <MetricCard 
                        title={t('total_inventory_all')}
                        value={stats.global.totalStock.toLocaleString()}
                        subtitle={t('units_across_branches')}
                        icon={Package}
                        color="blue"
                     />
                     <MetricCard 
                        title={t('critical_alerts_all')}
                        value={stats.global.lowStockCount}
                        subtitle={t('items_needing_restock')}
                        icon={AlertTriangle}
                        color="rose"
                     />
                </div>

                {/* Branch Breakdown */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-[#dee2ec] flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#57ec7f]/15 text-[#57ec7f] border border-[#57ec7f]/30">
                            <TrendingUp className="w-5 h-5" />
                        </span>
                        {t('branch_performance')}
                    </h2>
                    <div className="hidden rounded-lg border border-[#30353d] bg-[#171c23] px-3 py-1 text-xs font-mono font-bold text-[#8a92a6] sm:block">
                        {stats.branches.length} branches monitored
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {stats.branches.map((branch) => (
                        <motion.div 
                            key={branch.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-[#facc15]/50"
                        >
                            <div className={cn("absolute inset-x-0 top-0 h-1", branch.status === 'Online' ? "bg-gradient-to-r from-[#57ec7f] to-[#4cd7f6]" : "bg-gradient-to-r from-[#ff5449] to-[#facc15]")} />
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "flex h-3 w-3 rounded-full ring-4",
                                        branch.status === 'Online' ? "bg-[#57ec7f] ring-[#57ec7f]/20" : "bg-[#ff5449] ring-[#ff5449]/20"
                                    )} />
                                    <div>
                                        <h3 className="font-bold text-lg text-[#dee2ec]">{branch.name}</h3>
                                        <p className="text-xs font-mono font-bold text-[#8a92a6] uppercase tracking-wider">{branch.status === 'Online' ? t('online') : t('offline')}</p>
                                    </div>
                                </div>
                                <div className={cn("p-2 rounded-lg border", branch.status === 'Online' ? "bg-[#57ec7f]/15 text-[#57ec7f] border-[#57ec7f]/30" : "bg-[#ff5449]/15 text-[#ffb4ab] border-[#ff5449]/30")}>
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Row label={t('stock_value')} value={`฿${branch.totalValue.toLocaleString()}`} />
                                <Row label={t('active_items')} value={branch.activeCount} />
                                <Row label={t('critical_stock')} value={branch.lowStockCount} highlight={branch.lowStockCount > 0} />
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-[#30353d]">
                                <div className="w-full bg-[#090f15] border border-[#30353d] h-2 rounded-full overflow-hidden">
                                    <div className={cn("h-full", branch.status === "Online" ? "bg-[#57ec7f]" : "bg-[#ff5449]")} style={{ width: '70%' }} />
                                </div>
                                <p className="text-[10px] font-mono text-[#8a92a6] mt-2 text-right">{t('capacity_used')}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
             </div>
        </div>
    );
}

function MetricCard({ title, value, subtitle, icon: Icon, color }: any) {
    const colors = {
        indigo: "text-[#facc15] border-[#facc15]/30",
        blue: "text-[#4cd7f6] border-[#4cd7f6]/30",
        rose: "text-[#ffb4ab] border-[#ff5449]/30",
    };
    const rail = { indigo: "bg-[#facc15]", blue: "bg-[#4cd7f6]", rose: "bg-[#ff5449]" };

    return (
       <motion.div
         whileHover={{ y: -4 }}
         className={cn("relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-sm text-[#dee2ec]")}
       >
           <div className={cn("absolute inset-x-0 top-0 h-1", rail[color as keyof typeof rail])} />

           <div className="flex justify-between items-start mb-4 relative z-10">
               <div>
                   <p className="text-[#8a92a6] font-mono font-bold text-xs uppercase tracking-wider mb-2">{title}</p>
                   <h3 className="text-3xl font-mono font-black tracking-tight text-[#dee2ec]">{value}</h3>
               </div>
               <div className={cn("p-3 rounded-xl border bg-[#090f15]", colors[color as keyof typeof colors])}>
                   <Icon className="w-6 h-6" />
               </div>
           </div>
           {subtitle && <p className="text-[#8a92a6] text-xs font-medium relative z-10">{subtitle}</p>}
       </motion.div>
    );
}

function Row({ label, value, highlight }: any) {
    return (
        <div className="flex justify-between items-center rounded-xl bg-[#1b2027] border border-[#30353d]/50 px-3 py-2 text-sm">
            <span className="text-[#8a92a6] font-medium">{label}</span>
            <span className={cn("font-mono font-bold tabular-nums", highlight ? "text-[#ff5449]" : "text-[#dee2ec]")}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
        </div>
    );
}
