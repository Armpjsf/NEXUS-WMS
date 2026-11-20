'use client';

import Link from 'next/link';
import { TrendingUp, Clock, BarChart3, Sparkles, FileText, PieChart, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function AnalyticsLandingPage() {
  const { t } = useLanguage();

  const cards = [
    {
      title: t('demand_forecast'),
      desc: t('demand_forecast_desc'),
      href: '/analytics/forecast',
      icon: TrendingUp,
      iconTone: 'bg-sky-500/12 border-sky-500/20 text-sky-700',
      badge: 'Forecasting',
      badgeTone: 'bg-sky-500/12 text-sky-700 border-sky-500/20',
    },
    {
      title: t('inventory_aging'),
      desc: t('inventory_aging_desc'),
      href: '/analytics/aging',
      icon: Clock,
      iconTone: 'bg-amber-500/15 border-amber-500/25 text-amber-700',
      badge: 'FIFO Tiers',
      badgeTone: 'bg-amber-500/15 text-amber-800 border-amber-500/25',
    },
    {
      title: t('transaction_summary'),
      desc: t('transaction_summary_desc'),
      href: '/analytics/summary',
      icon: BarChart3,
      iconTone: 'bg-emerald-500/12 border-emerald-500/20 text-emerald-700',
      badge: 'Throughput',
      badgeTone: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20',
    },
    {
      title: t('profit_title'),
      desc: t('profit_subtitle'),
      href: '/analytics/profit',
      icon: PieChart,
      iconTone: 'bg-emerald-500/12 border-emerald-500/20 text-emerald-700',
      badge: 'Margin',
      badgeTone: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20',
    },
    {
      title: t('report_center'),
      desc: t('report_center_desc'),
      href: '/analytics/reports',
      icon: FileText,
      iconTone: 'bg-rose-500/12 border-rose-500/20 text-rose-700',
      badge: 'Exports',
      badgeTone: 'bg-rose-500/12 text-rose-700 border-rose-500/20',
    },
    {
      title: t('menu_smart_restock'),
      desc: "AI-powered reorder optimization and stockout prediction.",
      href: '/ai-reorder',
      icon: Sparkles,
      iconTone: 'bg-amber-500/15 border-amber-500/25 text-amber-700',
      badge: 'AI Engine',
      badgeTone: 'bg-slate-900 text-white border-slate-900',
    }
  ];

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
       <div className="max-w-[1500px] mx-auto space-y-6">
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-1"
          >
             <div className="flex items-center gap-2 mb-1.5">
               <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 Decision Intelligence
               </span>
             </div>
             <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                {t('analytics_center')}
             </h1>
             <p className="text-xs sm:text-sm text-slate-600 mt-0.5 max-w-3xl">{t('analytics_subtitle')}</p>
          </motion.header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
             {cards.map((card, idx) => (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                   <Link
                     href={card.href}
                     className="nx-glass-card group flex h-full flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1"
                   >
                      <div>
                        <div className="flex items-center justify-between mb-5">
                          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${card.iconTone}`}>
                             <card.icon className="w-6 h-6" />
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${card.badgeTone}`}>
                            {card.badge}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight group-hover:text-emerald-700 transition-colors">
                           {card.title}
                        </h3>

                        <p className="text-slate-600 text-sm leading-relaxed">
                           {card.desc}
                        </p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-200/70 flex items-center justify-between text-slate-700 font-semibold text-xs group-hover:text-emerald-700 transition-colors">
                         <span>{t('go_to_section') || 'Open Module'}</span>
                         <span className="w-8 h-8 rounded-full bg-white/80 border border-slate-200 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all">
                           <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                         </span>
                      </div>
                   </Link>
                </motion.div>
             ))}
          </div>
       </div>
    </div>
  );
}
