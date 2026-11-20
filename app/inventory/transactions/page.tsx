'use client';

import { useState, useEffect } from 'react';
import { Download, Search, ArrowDownLeft, ArrowUpRight, History, AlertTriangle, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { useLanguage } from '@/components/providers/LanguageProvider';

interface Log {
  date: string;
  product: string;
  location: string;
  qty: number;
  reason?: string;
  status?: string; // For Damage
}

export default function TransactionsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'IN' | 'OUT' | 'DAMAGE'>('IN');
  const [data, setData] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search, startDate, endDate]);

  useEffect(() => {
    fetchLogs(activeTab);
  }, [activeTab]);

  async function fetchLogs(type: 'IN' | 'OUT' | 'DAMAGE') {
    setLoading(true);
    try {
        const res = await fetch(`/api/logs/transaction?type=${type}`);
        const json = await res.json();
        if (Array.isArray(json)) setData(json);
        else setData([]);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  }

  // Helper: Normalize for flexible search (remove special chars, lower case)
  const normalize = (val: string) => val ? val.toLowerCase().replace(/[\s\-_./\\()'"[\]{}|+,;:?<>`~!@#$%^&*]/g, '') : '';

  // Filter Logic: Includes Date Range and Location Search with Normalization
  const filtered = data.filter(item => {
      // 1. Date Range Filtering
      if (startDate) {
          const itemTime = new Date(item.date).getTime();
          const startLimit = new Date(startDate).getTime(); // 00:00:00 of start date
          if (isNaN(itemTime) || itemTime < startLimit) return false;
      }
      if (endDate) {
          const itemTime = new Date(item.date).getTime();
          const endLimit = new Date(endDate).getTime() + (24 * 60 * 60 * 1000) - 1; // 23:59:59 of end date
          if (isNaN(itemTime) || itemTime > endLimit) return false;
      }

      // 2. Search Text Filtering
      const term = normalize(search);
      if (!term) return true;

      const matchProduct = normalize(item.product).includes(term);
      const matchDate = normalize(item.date).includes(term);
      const matchLocation = normalize(item.location).includes(term);
      
      return matchProduct || matchDate || matchLocation;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalQty = filtered.reduce((acc, item) => acc + (Number(item.qty) || 0), 0);

  const exportCSV = () => {
    const BOM = "\uFEFF";
    const headers = ['Date,Product,Location,Quantity,Type,Status'];
    const rows = filtered.map(item => 
        `"${item.date}","${item.product}","${item.location}",${item.qty},"${activeTab}","${item.status || '-'}"`
    );
    const csvContent = BOM + headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transaction_${activeTab.toLowerCase()}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="relative z-10 mx-auto max-w-[1500px] space-y-6">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          {t('back_to_inventory')}
        </Link>

        {/* Open Page Header */}
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Inventory Ledger
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <History className="w-7 h-7 text-emerald-600 shrink-0" />
              <span>{t('logs_title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('logs_subtitle')}</p>
          </div>
        
          <div className="flex bg-white/70 backdrop-blur-md border border-white/85 p-1 rounded-full w-fit overflow-x-auto shadow-xs">
            <button
                onClick={() => setActiveTab('IN')}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'IN' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-500/10'
                }`}
            >
                <ArrowDownLeft className="w-4 h-4" /> {t('tab_inbound')}
            </button>
            <button
                onClick={() => setActiveTab('OUT')}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'OUT' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-rose-700 hover:bg-rose-500/10'
                }`}
            >
                <ArrowUpRight className="w-4 h-4" /> {t('tab_outbound')}
            </button>
            <button
                onClick={() => setActiveTab('DAMAGE')}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'DAMAGE' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-amber-700 hover:bg-amber-500/10'
                }`}
            >
                <AlertTriangle className="w-4 h-4" /> {t('tab_damage')}
            </button>
          </div>
        </header>

        {/* Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="nx-dark-accent-card p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Active Mode</p>
              <p className="text-2xl font-bold text-white mt-0.5 tabular-nums">
                {activeTab === 'IN' ? t('tab_inbound') : activeTab === 'OUT' ? t('tab_outbound') : t('tab_damage')}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              activeTab === 'IN'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/25'
                : activeTab === 'OUT'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-400/25'
                : 'bg-amber-500/20 text-amber-300 border border-amber-400/25'
            }`}>
              {activeTab}
            </span>
          </div>

          <div className="nx-glass-card p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Filtered Entries</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">{filtered.length.toLocaleString()}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/12 text-sky-800 border border-sky-500/20 tabular-nums">
              Page {currentPage}/{Math.max(1, totalPages)}
            </span>
          </div>

          <div className="nx-glass-card p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Units</p>
              <p className={`text-2xl font-bold mt-0.5 tabular-nums ${
                activeTab === 'IN' ? 'text-emerald-700' : activeTab === 'OUT' ? 'text-rose-600' : 'text-amber-700'
              }`}>
                {activeTab === 'IN' ? '+' : '-'}{totalQty.toLocaleString()}
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">รายการที่กรอง</span>
          </div>
        </div>

        {/* Controls */}
        <div className="nx-glass-card flex flex-col lg:flex-row gap-3 justify-between p-4 items-stretch lg:items-center">
          <div className="flex flex-col md:flex-row flex-1 gap-3 items-stretch md:items-center w-full max-w-5xl">
             <div className="relative flex-1">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                    type="text" 
                    placeholder={t('search_logs_placeholder')} 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/85 border border-slate-200 rounded-full text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all"
                 />
             </div>
             
             {/* Date Range Inputs */}
             <div className="flex items-center gap-2 bg-white/85 border border-slate-200 px-3.5 py-2 rounded-full">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <input 
                   type="date" 
                   value={startDate}
                   onChange={(e) => setStartDate(e.target.value)}
                   className="bg-transparent border-none text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                   placeholder="Start Date"
                />
                <span className="text-slate-400 text-xs font-bold">→</span>
                <input 
                   type="date" 
                   value={endDate}
                   onChange={(e) => setEndDate(e.target.value)}
                   className="bg-transparent border-none text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                   placeholder="End Date"
                />
                {(startDate || endDate) && (
                   <button 
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="text-slate-400 hover:text-slate-700 ml-1 text-xs font-bold"
                   >
                      ✕
                   </button>
                )}
             </div>

             <span className="px-3.5 py-2 bg-white/80 border border-slate-200 rounded-full text-slate-700 text-xs font-semibold whitespace-nowrap text-center tabular-nums">
                 {search || startDate || endDate ? `ค้นพบ ${filtered.length.toLocaleString()} รายการ` : `ทั้งหมด ${filtered.length.toLocaleString()} รายการ`}
             </span>
          </div>
          <button 
                 onClick={exportCSV}
                 className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full flex items-center gap-2 transition-colors font-semibold text-xs w-full lg:w-auto justify-center shadow-sm"
             >
                 <Download className="w-3.5 h-3.5" /> {t('export_current_view')}
          </button>
        </div>

        {/* High-Legibility Light Table */}
        <div className="nx-glass-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-900/5 border-b border-slate-200/70 text-slate-600 uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                      <th className="py-3.5 px-5">{t('date')}</th>
                      <th className="py-3.5 px-4">{t('col_product_name')}</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4 text-right">{t('qty')}</th>
                      <th className="py-3.5 px-5">{t('col_type')}</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                  {loading ? (
                      <tr><td colSpan={5} className="p-10 text-center text-slate-500">{t('processing')}</td></tr>
                  ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="p-10 text-center text-slate-500">{t('no_logs')}</td></tr>
                  ) : (
                      currentItems.map((item, i) => (
                          <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                              <td className="py-3.5 px-5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">{item.date}</td>
                              <td className="py-3.5 px-4 font-semibold text-slate-900">{item.product}</td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                                  {item.location || '-'}
                              </td>
                              <td className={`py-3.5 px-4 text-right font-bold text-base tabular-nums ${
                                  activeTab === 'IN' ? 'text-emerald-700' : 
                                  activeTab === 'OUT' ? 'text-rose-600' : 'text-amber-700'
                              }`}>
                                  {activeTab === 'IN' ? '+' : '-'}{item.qty.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-5">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase border ${
                                      activeTab === 'IN' ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' : 
                                      activeTab === 'OUT' ? 'bg-rose-500/12 text-rose-700 border-rose-500/25' : 
                                      'bg-amber-500/15 text-amber-800 border-amber-500/25'
                                  }`}>
                                      {(activeTab === 'IN' || activeTab === 'OUT') && t(`legend_${activeTab.toLowerCase()}` as any) || t('tab_damage')}
                                  </span>
                              </td>
                          </tr>
                      ))
                  )}
              </tbody>
          </table>
          </div>
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="nx-glass-card flex flex-col gap-4 justify-between items-center p-4 sm:flex-row">
              <div className="text-xs sm:text-sm text-slate-600 tabular-nums">
                  Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of <span className="font-bold text-slate-900">{filtered.length}</span> results
              </div>
              <div className="flex items-center gap-2">
                  <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white/85 border border-slate-200 rounded-full text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50 transition-colors"
                  >
                      Previous
                  </button>
                  <div className="flex gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          const pageNum = i + 1;
                          return (
                              <button
                                  key={pageNum}
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={`w-9 h-9 rounded-full text-xs font-bold border transition-all tabular-nums ${
                                      currentPage === pageNum 
                                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs' 
                                          : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                                  }`}
                              >
                                  {pageNum}
                              </button>
                          );
                      })}
                      {totalPages > 5 && <span className="flex items-center px-2 text-slate-400">...</span>}
                      {totalPages > 5 && (
                          <button
                              onClick={() => setCurrentPage(totalPages)}
                              className={`w-9 h-9 rounded-full text-xs font-bold border transition-all tabular-nums ${
                                  currentPage === totalPages 
                                      ? 'bg-slate-900 border-slate-900 text-white shadow-xs' 
                                      : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                              }`}
                          >
                              {totalPages}
                          </button>
                      )}
                  </div>
                  <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white/85 border border-slate-200 rounded-full text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50 transition-colors"
                  >
                      Next
                  </button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
