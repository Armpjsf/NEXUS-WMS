'use client';

import { useState, useEffect } from 'react';
import { Download, Search, ArrowDownLeft, ArrowUpRight, History, AlertTriangle, Calendar } from 'lucide-react';

import { AmbientBackground } from '@/components/ui/AmbientBackground';
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
    <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:p-8">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-[1500px] space-y-6">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" />
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
           <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#8a92a6]">Inventory Ledger</p>
           <h1 className="text-3xl font-black text-[#dee2ec] mb-2 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-blue-700 text-white shadow-lg shadow-blue-900/20">
                <History className="w-6 h-6" />
              </span>
              {t('logs_title')}
           </h1>
           <p className="text-[#8a92a6] font-semibold">{t('logs_subtitle')}</p>
        </div>
        
        <div className="flex bg-[#1b2027] border border-[#30353d] p-1.5 rounded-2xl w-fit overflow-x-auto shadow-inner shadow-slate-200/70">
            <button
                onClick={() => setActiveTab('IN')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'IN' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-700/20' : 'text-[#d1c6ab] hover:text-emerald-700 hover:bg-emerald-500/10'
                }`}
            >
                <ArrowDownLeft className="w-4 h-4" /> {t('tab_inbound')}
            </button>
            <button
                onClick={() => setActiveTab('OUT')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'OUT' ? 'bg-rose-600 text-white shadow-lg shadow-rose-700/20' : 'text-[#d1c6ab] hover:text-rose-700 hover:bg-rose-500/10'
                }`}
            >
                <ArrowUpRight className="w-4 h-4" /> {t('tab_outbound')}
            </button>
            <button
                onClick={() => setActiveTab('DAMAGE')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'DAMAGE' ? 'bg-amber-600 text-white shadow-lg shadow-amber-700/20' : 'text-[#d1c6ab] hover:text-amber-700 hover:bg-amber-500/10'
                }`}
            >
                <AlertTriangle className="w-4 h-4" /> {t('tab_damage')}
            </button>
        </div>
        </div>
      </header>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-lg shadow-slate-900/5 backdrop-blur-xl items-stretch lg:items-center">
          <div className="flex flex-col md:flex-row flex-1 gap-3 items-stretch md:items-center w-full max-w-5xl">
             <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8a92a6]" />
                 <input 
                    type="text" 
                    placeholder={t('search_logs_placeholder')} 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#171c23] border border-[#30353d] rounded-xl text-[#dee2ec] font-semibold focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 outline-none"
                 />
             </div>
             
             {/* Date Range Inputs */}
             <div className="flex items-center gap-2 bg-[#171c23] border border-[#30353d] px-3 py-2 rounded-xl shadow-inner shadow-slate-100">
                <Calendar className="w-4 h-4 text-[#8a92a6] shrink-0" />
                <input 
                   type="date" 
                   value={startDate}
                   onChange={(e) => setStartDate(e.target.value)}
                   className="bg-transparent border-none text-xs font-semibold text-[#d1c6ab] outline-none cursor-pointer"
                   placeholder="Start Date"
                />
                <span className="text-slate-300 text-xs font-bold">→</span>
                <input 
                   type="date" 
                   value={endDate}
                   onChange={(e) => setEndDate(e.target.value)}
                   className="bg-transparent border-none text-xs font-semibold text-[#d1c6ab] outline-none cursor-pointer"
                   placeholder="End Date"
                />
                {(startDate || endDate) && (
                   <button 
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="text-[#8a92a6] hover:text-[#d1c6ab] ml-1 text-xs font-bold"
                   >
                      ✕
                   </button>
                )}
             </div>

             <span className="px-3 py-2 bg-[#252a32] border border-[#30353d] rounded-lg text-[#8a92a6] text-xs font-bold whitespace-nowrap shadow-sm text-center">
                 {search || startDate || endDate ? `ค้นพบ ${filtered.length.toLocaleString()} รายการ` : `ทั้งหมด ${filtered.length.toLocaleString()} รายการ`}
             </span>
          </div>
          <button 
                 onClick={exportCSV}
                 className="px-4 py-2.5 bg-slate-900 hover:bg-blue-900 text-white rounded-xl flex items-center gap-2 transition-colors border border-slate-900 font-bold w-full lg:w-auto justify-center shadow-lg shadow-slate-900/10"
             >
                 <Download className="w-4 h-4" /> {t('export_current_view')}
          </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-xl shadow-slate-900/5">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#d1c6ab]">
              <thead className="bg-slate-900 text-white uppercase tracking-wider font-black text-[11px]">
                  <tr>
                      <th className="p-4">{t('date')}</th>
                      <th className="p-4">{t('col_product_name')}</th>
                      <th className="p-4">Location</th>
                      <th className="p-4 text-right">{t('qty')}</th>
                      <th className="p-4">{t('col_type')}</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-[#30353d]">
                  {loading ? (
                      <tr><td colSpan={5} className="p-8 text-center">{t('processing')}</td></tr>
                  ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center">{t('no_logs')}</td></tr>
                  ) : (
                      currentItems.map((item, i) => (
                          <tr key={i} className="hover:bg-[#1b2027] transition-colors">
                              <td className="p-4 font-mono text-[#8a92a6]">{item.date}</td>
                              <td className="p-4 font-medium text-[#dee2ec]">{item.product}</td>
                              <td className="p-4 text-[#8a92a6]">
                                  {item.location || '-'}
                              </td>
                              <td className={`p-4 text-right font-bold text-lg ${
                                  activeTab === 'IN' ? 'text-emerald-600' : 
                                  activeTab === 'OUT' ? 'text-rose-600' : 'text-amber-600'
                              }`}>
                                  {activeTab === 'IN' ? '+' : '-'}{item.qty.toLocaleString()}
                              </td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                                      activeTab === 'IN' ? 'bg-emerald-500/20 text-emerald-600' : 
                                      activeTab === 'OUT' ? 'bg-rose-500/20 text-rose-600' : 
                                      'bg-amber-500/20 text-amber-600'
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
          <div className="flex flex-col gap-4 justify-between items-center bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-lg shadow-slate-900/5 sm:flex-row">
              <div className="text-sm text-[#8a92a6]">
                  Showing <span className="font-bold text-[#dee2ec]">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-[#dee2ec]">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of <span className="font-bold text-[#dee2ec]">{filtered.length}</span> results
              </div>
              <div className="flex gap-2">
                  <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-[#30353d] rounded-lg text-sm font-bold hover:bg-[#1b2027] disabled:opacity-50 transition-colors"
                  >
                      Previous
                  </button>
                  <div className="flex gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          // Simple pagination logic: show first few pages
                          const pageNum = i + 1;
                          return (
                              <button
                                  key={pageNum}
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={`w-10 h-10 rounded-lg text-sm font-bold border transition-all ${
                                      currentPage === pageNum 
                                          ? 'bg-blue-700 border-blue-700 text-white shadow-md' 
                                          : 'bg-[#171c23] border-[#30353d] text-[#d1c6ab] hover:border-blue-300'
                                  }`}
                              >
                                  {pageNum}
                              </button>
                          );
                      })}
                      {totalPages > 5 && <span className="flex items-center px-2 text-[#8a92a6]">...</span>}
                      {totalPages > 5 && (
                          <button
                              onClick={() => setCurrentPage(totalPages)}
                              className={`w-10 h-10 rounded-lg text-sm font-bold border transition-all ${
                                  currentPage === totalPages 
                                      ? 'bg-blue-700 border-blue-700 text-white shadow-md' 
                                      : 'bg-[#171c23] border-[#30353d] text-[#d1c6ab] hover:border-blue-300'
                              }`}
                          >
                              {totalPages}
                          </button>
                      )}
                  </div>
                  <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-[#30353d] rounded-lg text-sm font-bold hover:bg-[#1b2027] disabled:opacity-50 transition-colors"
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
