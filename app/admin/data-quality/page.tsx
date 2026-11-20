'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface Issue {
    type: string;
    source: string;
    row: number;
    description: string;
}

interface AnomalyIssue {
    id: string;
    type: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    description: string;
    entityId?: string;
    entityName?: string;
    value?: string | number;
    action?: 'FIX_STOCK' | 'REVIEW';
}

export default function DataQualityPage() {
  const { t } = useLanguage();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkQuality() {
        try {
            const [paramsRes, aiRes] = await Promise.all([
                fetch('/api/admin/data-quality'),
                fetch('/api/ai/anomaly')
            ]);

            const paramsData = await paramsRes.json();
            if (paramsData.issues) setIssues(paramsData.issues);

            const aiData = await aiRes.json();
            if (aiData.issues) setAnomalies(aiData.issues);

        } catch (error) {
            console.error("DQ Check Failed", error);
        } finally {
            setLoading(false);
        }
    }
    checkQuality();
  }, []);

  const unknownSkuCount = issues.filter(i => i.type === 'Unknown SKU').length;
  const invalidQtyCount = issues.filter(i => i.type === 'Invalid Qty').length;

  const dateErrorCount = issues.filter(i => i.type === 'Date Error').length;
  const reconcileErrorCount = issues.filter(i => i.type === 'Stock Mismatch').length;

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
       <Link
         href="/admin"
         className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
       >
         <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> {t('back_to_admin')}
       </Link>

       <header className="pt-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-700 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              Data Integrity Diagnostics
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
             {t('dq_title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('dq_subtitle')}</p>
       </header>

       {/* Summary Cards (1 Hero Dark Accent Card for Unknown SKU Priority) */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="nx-dark-accent-card p-6 relative overflow-hidden">
               <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-2">
                   <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                   Critical Check
               </div>
               <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1">{t('dq_unknown_sku')}</h3>
               <div className={`text-3xl font-bold tabular-nums ${unknownSkuCount > 0 ? 'text-rose-300' : 'text-white'}`}>
                   {loading ? '...' : unknownSkuCount.toLocaleString()}
               </div>
               <p className="text-xs text-slate-400 mt-2">{t('dq_unknown_sku_desc')}</p>
           </div>

           <div className={`nx-glass-card p-6 ${invalidQtyCount > 0 ? 'ring-1 ring-amber-500/30' : ''}`}>
               <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">{t('dq_invalid_qty')}</h3>
               <div className={`text-3xl font-bold tabular-nums ${invalidQtyCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                   {loading ? '...' : invalidQtyCount.toLocaleString()}
               </div>
               <p className="text-xs text-slate-500 mt-2">{t('dq_invalid_qty_desc')}</p>
           </div>

           <div className={`nx-glass-card p-6 ${dateErrorCount > 0 ? 'ring-1 ring-sky-500/30' : ''}`}>
               <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">{t('dq_date_error')}</h3>
               <div className={`text-3xl font-bold tabular-nums ${dateErrorCount > 0 ? 'text-sky-600' : 'text-slate-900'}`}>
                   {loading ? '...' : dateErrorCount.toLocaleString()}
               </div>
               <p className="text-xs text-slate-500 mt-2">{t('dq_date_error_desc')}</p>
           </div>

           <div className={`nx-glass-card p-6 ${reconcileErrorCount > 0 ? 'ring-1 ring-amber-500/30' : ''}`}>
               <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">{t('dq_stock_mismatch')}</h3>
               <div className={`text-3xl font-bold tabular-nums ${reconcileErrorCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                   {loading ? '...' : reconcileErrorCount.toLocaleString()}
               </div>
               <p className="text-xs text-slate-500 mt-2">{t('dq_stock_mismatch_desc')}</p>
           </div>
       </div>

       {/* AI Watchdog Section */}
       <div className="nx-glass-card overflow-hidden">
           <div className="p-5 border-b border-slate-200/80 flex justify-between items-center bg-white/60">
               <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-sky-500/12 border border-sky-500/20 rounded-xl text-sky-700">
                       <ShieldAlert className="w-5 h-5" />
                   </div>
                   <div>
                       <h3 className="text-base font-bold text-slate-900">AI Watchdog</h3>
                       <p className="text-xs text-slate-500">Automated Integrity Checks</p>
                   </div>
               </div>
               <div className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold tabular-nums">
                   {anomalies.length.toLocaleString()} Issues Detected
               </div>
           </div>

           {loading ? (
             <div className="p-8 text-center text-slate-500 animate-pulse text-sm">Running diagnostics...</div>
           ) : anomalies.length === 0 ? (
             <div className="p-10 flex flex-col items-center gap-2">
                 <CheckCircle className="w-10 h-10 text-emerald-500" />
                 <p className="font-semibold text-emerald-700 text-sm">All Systems Healthy</p>
             </div>
           ) : (
             <div className="divide-y divide-slate-200/70 max-h-[400px] overflow-y-auto">
                 {anomalies.map((a) => (
                     <div key={a.id} className="p-4 hover:bg-white/80 transition-colors flex gap-4">
                         <div className="mt-0.5">
                             {a.type === 'CRITICAL' && <AlertTriangle className="w-5 h-5 text-rose-500" />}
                             {a.type === 'WARNING' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                             {a.type === 'INFO' && <AlertTriangle className="w-5 h-5 text-sky-500" />}
                         </div>
                         <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-1">
                                 <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                                     a.type === 'CRITICAL' ? 'bg-rose-500/12 text-rose-700 border-rose-500/20' :
                                     a.type === 'WARNING' ? 'bg-amber-500/15 text-amber-800 border-amber-500/25' :
                                     'bg-sky-500/12 text-sky-700 border-sky-500/20'
                                 }`}>
                                     {a.type}
                                 </span>
                                 <span className="text-xs text-slate-500 font-mono truncate">{a.entityName}</span>
                             </div>
                             <h4 className="font-bold text-sm text-slate-900">{a.title}</h4>
                             <p className="text-xs text-slate-600 mt-0.5">{a.description}</p>
                         </div>
                         {a.action === 'FIX_STOCK' && (
                             <button className="self-center px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-full transition-colors">
                                 Fix
                             </button>
                         )}
                     </div>
                 ))}
             </div>
           )}
       </div>

       {/* Issues List */}
       <div className="nx-glass-card overflow-hidden">
           <div className="p-5 border-b border-slate-200/80 flex justify-between items-center bg-white/60">
               <h3 className="text-slate-900 font-bold text-base">{t('dq_issues_found')}</h3>
               <div className="text-xs font-semibold text-slate-600 tabular-nums">
                   Total: {issues.length.toLocaleString()} Checkpoints
               </div>
           </div>

           {loading ? (
               <div className="p-12 text-center text-slate-500 text-sm">{t('ai_analyzing')}</div>
           ) : issues.length === 0 ? (
               <div className="p-12 text-center flex flex-col items-center gap-3">
                   <div className="w-14 h-14 bg-emerald-500/12 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                       <CheckCircle className="w-7 h-7 text-emerald-600" />
                   </div>
                   <div className="text-emerald-700 font-bold">{t('dq_all_good')}</div>
                   <p className="text-slate-500 text-sm">No data quality issues found.</p>
               </div>
           ) : (
               <div className="divide-y divide-slate-200/70 max-h-[500px] overflow-y-auto">
                   {issues.map((issue, idx) => (
                       <div key={idx} className="p-4 hover:bg-white/80 flex items-start gap-4 transition-colors">
                           <div className="mt-0.5">
                               {issue.type === 'Unknown SKU' && <AlertTriangle className="w-5 h-5 text-rose-500" />}
                               {issue.type === 'Invalid Qty' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                               {issue.type === 'Date Error' && <AlertTriangle className="w-5 h-5 text-sky-500" />}
                               {issue.type === 'Stock Mismatch' && <ShieldAlert className="w-5 h-5 text-amber-600" />}
                           </div>
                           <div className="flex-1">
                               <div className="flex items-center gap-2 mb-1">
                                   <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border
                                       ${issue.type === 'Unknown SKU' ? 'bg-rose-500/12 text-rose-700 border-rose-500/20' :
                                         issue.type === 'Invalid Qty' ? 'bg-amber-500/15 text-amber-800 border-amber-500/25' :
                                         issue.type === 'Stock Mismatch' ? 'bg-amber-500/15 text-amber-800 border-amber-500/25' :
                                         'bg-sky-500/12 text-sky-700 border-sky-500/20'}`}>
                                       {issue.type}
                                   </span>
                                   <span className="text-slate-500 text-xs tabular-nums">Source: {issue.source} (Row ~{issue.row})</span>
                               </div>
                               <p className="text-slate-700 text-sm">{issue.description}</p>
                           </div>
                       </div>
                   ))}
               </div>
           )}
       </div>
      </div>
    </div>
  );
}
