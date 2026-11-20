'use client';

import { useState, useEffect } from 'react';
import { History, ArrowLeft, Filter, Search, Clock, User, Package, FileText, Trash2, Download, Eye, X } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT';
  module: string;
  recordId?: string;
  description: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

const modules = ['All', 'inventory', 'inbound', 'outbound', 'damage', 'users', 'po-log'];
const actions = ['All', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT'];

const getActionColor = (action: string) => {
  switch (action) {
    case 'CREATE': return 'bg-emerald-500/12 text-emerald-700 border-emerald-500/25';
    case 'UPDATE': return 'bg-amber-500/15 text-amber-800 border-amber-500/25';
    case 'DELETE': return 'bg-rose-500/12 text-rose-700 border-rose-500/25';
    case 'EXPORT': return 'bg-sky-500/12 text-sky-700 border-sky-500/25';
    case 'VIEW': return 'bg-slate-100 text-slate-700 border-slate-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getActionIcon = (action: string) => {
  switch (action) {
    case 'CREATE': return <Package className="w-3 h-3" />;
    case 'UPDATE': return <FileText className="w-3 h-3" />;
    case 'DELETE': return <Trash2 className="w-3 h-3" />;
    case 'EXPORT': return <Download className="w-3 h-3" />;
    case 'VIEW': return <Eye className="w-3 h-3" />;
    default: return <FileText className="w-3 h-3" />;
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('th-TH');
};

export default function AuditTrailPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (moduleFilter !== 'All') params.set('module', moduleFilter);
      if (actionFilter !== 'All') params.set('action', actionFilter);
      params.set('limit', '200');

      const res = await fetch(getApiUrl(`/api/audit?${params.toString()}`));
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.userName.toLowerCase().includes(search.toLowerCase()) ||
                          log.description.toLowerCase().includes(search.toLowerCase()) ||
                          log.module.toLowerCase().includes(search.toLowerCase());
    const matchesModule = moduleFilter === 'All' || log.module === moduleFilter;
    const matchesAction = actionFilter === 'All' || log.action === actionFilter;
    return matchesSearch && matchesModule && matchesAction;
  });

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          {t('back_to_admin')}
        </Link>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-1"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
              <History className="w-3 h-3 text-amber-600" />
              Security &amp; Compliance
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            {t('audit_trail_title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('audit_trail_subtitle')}</p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="nx-glass-card p-4"
        >
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
                className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-slate-200/80 rounded-full text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none"
              />
            </div>

            {/* Module Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="px-4 py-2.5 bg-white/80 border border-slate-200/80 rounded-full text-xs font-semibold text-slate-700 focus:border-emerald-500 outline-none"
              >
                {modules.map(m => (
                  <option key={m} value={m}>{m === 'All' ? t('filter_all_modules') : m}</option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2.5 bg-white/80 border border-slate-200/80 rounded-full text-xs font-semibold text-slate-700 focus:border-emerald-500 outline-none"
            >
              {actions.map(a => (
                <option key={a} value={a}>{a === 'All' ? t('filter_all_actions') : a}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Logs List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="nx-glass-card overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-200/80 bg-white/60 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Activity Log
              <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-full text-xs font-bold tabular-nums">{filteredLogs.length}</span>
            </span>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-sm">Loading...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">No activity logs found</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200/70">
                {filteredLogs.map((log) => (
                  <li
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="p-4 hover:bg-white/80 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 border shrink-0",
                        getActionColor(log.action)
                      )}>
                        {getActionIcon(log.action)}
                        {log.action}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{log.description}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <User className="w-3 h-3 text-slate-400" />
                            {log.userName}
                          </span>
                          <span className="flex items-center gap-1 tabular-nums">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDate(log.timestamp)}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-bold uppercase text-slate-600">
                            {log.module}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>

        {/* Detail Modal */}
        {selectedLog && (
          <div
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedLog(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto text-slate-900"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">{t('log_details')}</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('col_status')}</p>
                  <span className={cn("inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border", getActionColor(selectedLog.action))}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('col_description')}</p>
                  <p className="text-slate-800 text-sm font-medium">{selectedLog.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('col_user')}</p>
                    <p className="text-slate-800 text-sm font-semibold">{selectedLog.userName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('col_module')}</p>
                    <p className="text-slate-800 text-sm font-semibold">{selectedLog.module}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('col_timestamp')}</p>
                  <p className="text-slate-700 text-sm tabular-nums">{formatDate(selectedLog.timestamp)}</p>
                </div>
                {selectedLog.oldValues && (
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('old_value')}</p>
                    <pre className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl text-xs text-slate-800 overflow-x-auto">
                      {JSON.stringify(selectedLog.oldValues, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.newValues && (
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('new_value')}</p>
                    <pre className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl text-xs text-slate-800 overflow-x-auto">
                      {JSON.stringify(selectedLog.newValues, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
