'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Check,
  Flame,
  Layers,
} from 'lucide-react';

export default function SmartTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [activeTask, setActiveTask] = useState<any | null>(null);
  const [autoReplenishLoading, setAutoReplenishLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success) {
        setTasks(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCompleteTask = async (taskId: string, qty: number) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'COMPLETE', taskId, completedQty: qty })
      });
      const result = await res.json();
      if (result.success) {
        setMessage('✅ ทำงานเสร็จสมบูรณ์เรียบร้อยแล้ว (Task Completed)');
        setActiveTask(null);
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerAutoReplenish = async () => {
    try {
      setAutoReplenishLoading(true);
      const res = await fetch('/api/tasks/replenish', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage(`🚀 ${data.message}`);
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAutoReplenishLoading(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filterType === 'ALL') return true;
    return t.task_type === filterType;
  });

  const urgentCount = tasks.filter(t => t.priority <= 2).length;
  const replenishmentCount = tasks.filter(t => t.task_type === 'REPLENISHMENT').length;

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Open Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Smart Dispatch &amp; Interleaving Engine
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              คิวงานคลังสินค้าอัจฉริยะ (Operator Terminal)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              ลดการวิ่งรถเปล่า (Task Interleaving) และเติมสต็อกจุดหยิบอัตโนมัติ (Active Replenishment)
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={triggerAutoReplenish}
              disabled={autoReplenishLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Flame className="w-4 h-4" />
              {autoReplenishLoading ? 'กำลังคำนวณ...' : 'คำนวณเติมสต็อก (Auto-Replenish)'}
            </button>

            <button
              onClick={fetchTasks}
              className="p-2.5 rounded-full border border-white/90 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 shadow-xs transition-colors"
              title="รีเฟรชงาน"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary Strip with 1 Hero Dark Accent Alert Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="nx-dark-accent-card p-5 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Priority Queue
              </div>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">งานด่วน (P1-P2)</p>
              <div className="text-3xl font-bold text-white tabular-nums mt-1">{urgentCount.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
          </div>

          <div className="nx-glass-card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">งานค้างทั้งหมด</p>
              <div className="text-3xl font-bold text-slate-900 tabular-nums">{tasks.length.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">คิวงานที่รอดำเนินการ</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-sky-500/12 border border-sky-500/20 text-sky-700">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="nx-glass-card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">งานเติมสต็อก</p>
              <div className="text-3xl font-bold text-rose-600 tabular-nums">{replenishmentCount.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">Active Replenishment</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-rose-500/12 border border-rose-500/20 text-rose-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {message && (
          <div className="p-3.5 bg-emerald-500/12 border border-emerald-500/25 rounded-2xl text-emerald-800 text-xs font-semibold flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-bold px-2">✕</button>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 text-xs">
          {['ALL', 'PUTAWAY', 'PICKING', 'REPLENISHMENT', 'CYCLE_COUNT'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-1.5 rounded-full border transition-all font-semibold ${
                filterType === type
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white/80 text-slate-700 border-white/90 hover:bg-white'
              }`}
            >
              {type === 'ALL' ? 'ทั้งหมด (All)' : type}
            </button>
          ))}
        </div>

        {/* Task List / Grid */}
        {loading ? (
          <div className="nx-glass-card py-20 text-center text-sm text-slate-500">กำลังโหลดคิวงาน...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="nx-glass-card py-16 text-center p-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">ไม่มีคิวงานค้างในขณะนี้</h3>
            <p className="text-xs text-slate-600 mt-1">งานจัดเก็บ หยิบสินค้า และเติมสต็อกอยู่ในสถานะปกติทั้งหมด</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => {
              const isUrgent = task.priority <= 2;
              return (
                <div
                  key={task.id}
                  className={`nx-glass-card p-5 flex flex-col justify-between transition-all ${
                    isUrgent ? 'ring-2 ring-rose-500/35' : ''
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        task.task_type === 'REPLENISHMENT'
                          ? 'bg-rose-500/12 text-rose-700 border-rose-500/25'
                          : task.task_type === 'PUTAWAY'
                          ? 'bg-sky-500/12 text-sky-700 border-sky-500/25'
                          : 'bg-emerald-500/12 text-emerald-700 border-emerald-500/25'
                      }`}>
                        {task.task_type}
                      </span>
                      <span className={`text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-full ${
                        isUrgent ? 'bg-amber-500/15 text-amber-800 border border-amber-500/25' : 'text-slate-500'
                      }`}>
                        P{task.priority} {isUrgent ? '🔥 ด่วน' : ''}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{task.product_name || task.sku}</h4>
                    <p className="text-[11px] text-slate-500 font-mono mb-3">SKU: {task.sku}</p>

                    {/* Routing */}
                    <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80 mb-4 text-xs space-y-1.5">
                      <div className="flex justify-between text-slate-600">
                        <span>ต้นทาง (Source):</span>
                        <span className="text-slate-900 font-bold font-mono">{task.source_location || 'Receiving Dock'}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>ปลายทาง (Target):</span>
                        <span className="text-amber-700 font-bold font-mono">{task.target_location || 'Unassigned'}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 pt-1.5 border-t border-slate-200/80">
                        <span>จำนวน (Qty):</span>
                        <span className="text-emerald-700 font-bold tabular-nums">{task.requested_qty} ชิ้น</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleCompleteTask(task.id, task.requested_qty)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-semibold transition-all shadow-xs active:scale-95"
                    >
                      <Check className="w-4 h-4" /> เสร็จสิ้นงาน (Complete)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
