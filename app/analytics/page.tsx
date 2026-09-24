'use client';

import Link from 'next/link';
import { TrendingUp, Clock, BarChart3, Sparkles, FileText, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

export default function AnalyticsLandingPage() {
  const { t } = useLanguage();

  const cards = [
    {
      title: t('demand_forecast'),
      desc: t('demand_forecast_desc'),
      href: '/analytics/forecast',
      icon: TrendingUp,
      color: 'from-blue-600 to-indigo-600',
      lightBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-600'
    },
    {
      title: t('inventory_aging'),
      desc: t('inventory_aging_desc'),
      href: '/analytics/aging',
      icon: Clock,
      color: 'from-orange-500 to-amber-600',
      lightBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600'
    },
    {
      title: t('transaction_summary'),
      desc: t('transaction_summary_desc'),
      href: '/analytics/summary',
      icon: BarChart3,
      color: 'from-emerald-500 to-teal-600',
      lightBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600'
    },
    {
      title: t('profit_title'),
      desc: t('profit_subtitle'),
      href: '/analytics/profit',
      icon: PieChart,
      color: 'from-purple-500 to-pink-600',
      lightBg: 'bg-purple-500/10',
      iconColor: 'text-purple-600'
    },
    {
        title: t('report_center'),
        desc: t('report_center_desc'),
        href: '/analytics/reports',
        icon: FileText,
        color: 'from-rose-500 to-red-600',
        lightBg: 'bg-rose-500/10',
        iconColor: 'text-rose-600'
    },
    {
        title: t('menu_smart_restock'),
        desc: "AI-powered reorder optimization and stockout prediction.",
        href: '/ai-reorder',
        icon: Sparkles,
        color: 'from-violet-600 to-purple-700',
        lightBg: 'bg-violet-500/10',
        iconColor: 'text-violet-600'
    }
  ];

  return (
    <div className="relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 overflow-hidden">
       <AmbientBackground />
       
       <div className="relative z-10 max-w-[1500px] mx-auto space-y-8">
          <motion.header 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[1.75rem] border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl"
          >
             <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-violet-600 to-emerald-500" />
             <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-700">Decision Intelligence</p>
             <h1 className="text-4xl font-black text-[#dee2ec] mb-3 tracking-tight">
                {t('analytics_center')}
             </h1>
             <p className="text-[#8a92a6] text-sm font-semibold max-w-3xl">{t('analytics_subtitle')}</p>
          </motion.header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
             {cards.map((card, idx) => (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                   <Link 
                     href={card.href} 
                     className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                   >
                      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.color}`} />

                      <div className="relative z-10">
                        <div className={`w-14 h-14 ${card.lightBg} rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-105 ring-1 ring-slate-100`}>
                           <card.icon className={`w-7 h-7 ${card.iconColor}`} />
                        </div>
                        
                        <h3 className="text-2xl font-black text-[#dee2ec] mb-3 tracking-tight">
                           {card.title}
                        </h3>
                        
                        <p className="text-[#8a92a6] leading-relaxed font-semibold">
                           {card.desc}
                        </p>
                      </div>

                      <div className="mt-8 flex items-center gap-2 text-[#d1c6ab] font-black text-sm uppercase tracking-widest relative z-10 group-hover:text-blue-700 transition-colors">
                         {t('go_to_section') || 'Open Module'}
                         <TrendingUp className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                   </Link>
                </motion.div>
             ))}
          </div>
       </div>
    </div>
  );
}
