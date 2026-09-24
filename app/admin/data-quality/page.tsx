'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

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
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
       <Link href="/admin" className="text-[#8a92a6] hover:text-rose-600 flex items-center gap-2 mb-4 transition-colors font-medium">
         <ArrowLeft className="w-4 h-4" /> {t('back_to_admin')}
       </Link>
       <header className="overflow-hidden rounded-[1.75rem] border border-rose-500/30 bg-[#171c23] p-6 shadow-xl shadow-rose-900/10 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-rose-600 via-amber-500 to-blue-600 -mx-6 -mt-6 mb-6" />
          <h1 className="text-3xl font-bold text-[#dee2ec] flex items-center gap-3">
             <div className="p-2 bg-rose-500/10 rounded-lg">
                <ShieldAlert className="w-8 h-8 text-rose-500" />
             </div>
             {t('dq_title')}
          </h1>
          <p className="text-[#8a92a6] mt-2">{t('dq_subtitle')}</p>
       </header>

       {/* Summary Cards */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className={`p-6 rounded-xl border ${unknownSkuCount > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-[#171c23] border-[#30353d]'}`}>
               <h3 className="text-[#8a92a6] text-sm mb-2">{t('dq_unknown_sku')}</h3>
               <div className={`text-3xl font-bold ${unknownSkuCount > 0 ? 'text-rose-600' : 'text-[#dee2ec]'}`}>
                   {loading ? '...' : unknownSkuCount}
               </div>
               <p className="text-xs text-[#8a92a6] mt-2">{t('dq_unknown_sku_desc')}</p>
           </div>
           
           <div className={`p-6 rounded-xl border ${invalidQtyCount > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-[#171c23] border-[#30353d]'}`}>
               <h3 className="text-[#8a92a6] text-sm mb-2">{t('dq_invalid_qty')}</h3>
               <div className={`text-3xl font-bold ${invalidQtyCount > 0 ? 'text-amber-600' : 'text-[#dee2ec]'}`}>
                   {loading ? '...' : invalidQtyCount}
               </div>
               <p className="text-xs text-[#8a92a6] mt-2">{t('dq_invalid_qty_desc')}</p>
           </div>

           <div className={`p-6 rounded-xl border ${dateErrorCount > 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-[#171c23] border-[#30353d]'}`}>
               <h3 className="text-[#8a92a6] text-sm mb-2">{t('dq_date_error')}</h3>
               <div className={`text-3xl font-bold ${dateErrorCount > 0 ? 'text-blue-600' : 'text-[#dee2ec]'}`}>
                   {loading ? '...' : dateErrorCount}
               </div>
               <p className="text-xs text-[#8a92a6] mt-2">{t('dq_date_error_desc')}</p>
           </div>

           <div className={`p-6 rounded-xl border ${reconcileErrorCount > 0 ? 'bg-purple-500/10 border-purple-500/20' : 'bg-[#171c23] border-[#30353d]'}`}>
               <h3 className="text-[#8a92a6] text-sm mb-2">{t('dq_stock_mismatch')}</h3>
               <div className={`text-3xl font-bold ${reconcileErrorCount > 0 ? 'text-purple-600' : 'text-[#dee2ec]'}`}>
                   {loading ? '...' : reconcileErrorCount}
               </div>
               <p className="text-xs text-[#8a92a6] mt-2">{t('dq_stock_mismatch_desc')}</p>
           </div>
       </div>

       {/* AI Watchdog Section */}
       <div className="bg-[#171c23] rounded-2xl overflow-hidden shadow-xl shadow-slate-900/5 border border-[#30353d] text-[#d1c6ab] relative">
           
           <div className="p-6 border-b border-[#30353d] flex justify-between items-center bg-[#1b2027]/80">
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-500/20 rounded-lg">
                       <ShieldAlert className="w-6 h-6 text-indigo-400" />
                   </div>
                   <div>
                       <h3 className="text-lg font-bold text-[#dee2ec]">AI Watchdog</h3>
                       <p className="text-sm text-[#8a92a6]">Automated Integrity Checks</p>
                   </div>
               </div>
               <div className="text-sm text-[#8a92a6] font-mono">
                   {anomalies.length} Issues Detected
               </div>
           </div>

           {loading ? (
             <div className="p-8 text-center text-[#8a92a6] animate-pulse">Running diagnostics...</div>
           ) : anomalies.length === 0 ? (
             <div className="p-8 flex flex-col items-center gap-2">
                 <CheckCircle className="w-10 h-10 text-emerald-400" />
                 <p className="font-medium text-emerald-700">All Systems Healthy</p>
             </div>
           ) : (
             <div className="divide-y divide-[#30353d] max-h-[400px] overflow-y-auto">
                 {anomalies.map((a) => (
                     <div key={a.id} className="p-4 hover:bg-[#1b2027] transition-colors flex gap-4">
                         <div className="mt-1">
                             {a.type === 'CRITICAL' && <AlertTriangle className="w-5 h-5 text-rose-500" />}
                             {a.type === 'WARNING' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                             {a.type === 'INFO' && <AlertTriangle className="w-5 h-5 text-blue-500" />}
                         </div>
                         <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-1">
                                 <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                     a.type === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                                     a.type === 'WARNING' ? 'bg-amber-500/20 text-amber-300' :
                                     'bg-blue-500/20 text-blue-300'
                                 }`}>
                                     {a.type}
                                 </span>
                                     <span className="text-xs text-[#8a92a6] font-mono truncate">{a.entityName}</span>
                             </div>
                             <h4 className="font-bold text-sm text-[#dee2ec]">{a.title}</h4>
                             <p className="text-xs text-[#8a92a6] mt-0.5">{a.description}</p>
                         </div>
                         {a.action === 'FIX_STOCK' && (
                             <button className="self-center px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors">
                                 Fix
                             </button>
                         )}
                     </div>
                 ))}
             </div>
           )}
       </div>

       {/* Issues List */}
       <div className="bg-[#171c23] border border-[#30353d] rounded-xl overflow-hidden shadow-sm">
           <div className="p-6 border-b border-[#30353d] flex justify-between items-center bg-[#1b2027]">
               <h3 className="text-[#dee2ec] font-medium">{t('dq_issues_found')}</h3>
               <div className="text-sm text-[#8a92a6]">
                   Total: {issues.length} Checkpoints
               </div>
           </div>
           
           {loading ? (
               <div className="p-12 text-center text-[#8a92a6]">{t('ai_analyzing')}</div>
           ) : issues.length === 0 ? (
               <div className="p-12 text-center flex flex-col items-center gap-4">
                   <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                       <CheckCircle className="w-8 h-8 text-green-500" />
                   </div>
                   <div className="text-green-400 font-medium">{t('dq_all_good')}</div>
                   <p className="text-[#8a92a6] text-sm">No data quality issues found.</p>
               </div>
           ) : (
               <div className="divide-y divide-[#30353d] max-h-[500px] overflow-y-auto">
                   {issues.map((issue, idx) => (
                       <div key={idx} className="p-4 hover:bg-[#1b2027] flex items-start gap-4 transition-colors">
                           <div className="mt-1">
                               {issue.type === 'Unknown SKU' && <AlertTriangle className="w-5 h-5 text-rose-500" />}
                               {issue.type === 'Invalid Qty' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                               {issue.type === 'Date Error' && <AlertTriangle className="w-5 h-5 text-blue-500" />}
                               {issue.type === 'Stock Mismatch' && <ShieldAlert className="w-5 h-5 text-purple-500" />}
                           </div>
                           <div className="flex-1">
                               <div className="flex items-center gap-2 mb-1">
                                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full 
                                       ${issue.type === 'Unknown SKU' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30' : 
                                         issue.type === 'Invalid Qty' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30' : 
                                         issue.type === 'Stock Mismatch' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/30' :
                                         'bg-blue-500/10 text-blue-600 border border-blue-500/30'}`}>
                                       {issue.type}
                                   </span>
                                   <span className="text-[#8a92a6] text-xs">Source: {issue.source} (Row ~{issue.row})</span>
                               </div>
                               <p className="text-[#d1c6ab] text-sm">{issue.description}</p>
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
