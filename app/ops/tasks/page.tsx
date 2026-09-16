'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Boxes, 
  Truck, 
  RefreshCw, 
  Play, 
  Check, 
  Zap, 
  MapPin, 
  AlertTriangle,
  Flame,
  UserCheck
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { motion, AnimatePresence } from 'framer-motion';

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

  return (
    <div className="relative min-h-screen p-4 md:p-8 pb-32">
      <AmbientBackground />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10 font-mono">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#30353d] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#57ec7f] animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#57ec7f]">
                SMART DISPATCH & INTERLEAVING ENGINE
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#dee2ec] tracking-tight">
              คิวงานคลังสินค้าอัจฉริยะ (Operator Terminal)
            </h1>
            <p className="text-xs text-[#8a92a6] mt-1">
              ลดการวิ่งรถเปล่า (Task Interleaving) และเติมสต็อกจุดหยิบอัตโนมัติ (Active Replenishment)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={triggerAutoReplenish}
              disabled={autoReplenishLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#facc15]/50 bg-[#facc15]/10 text-[#facc15] font-bold text-xs hover:bg-[#facc15]/20 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              <Flame className="w-4 h-4 text-[#facc15]" />
              {autoReplenishLoading ? 'กำลังคำนวณ...' : 'คำนวณเติมสต็อก (Auto-Replenish)'}
            </button>

            <button
              onClick={fetchTasks}
              className="p-2.5 rounded-xl border border-[#30353d] bg-[#171c23] text-[#d1c6ab] hover:text-[#dee2ec] transition-colors"
              title="รีเฟรชงาน"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {message && (
          <div className="p-3 bg-[#57ec7f]/10 border border-[#57ec7f]/30 rounded-xl text-[#57ec7f] text-xs flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-[#8a92a6] hover:text-[#dee2ec]">✕</button>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 text-xs">
          {['ALL', 'PUTAWAY', 'PICKING', 'REPLENISHMENT', 'CYCLE_COUNT'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                filterType === type
                  ? 'bg-[#facc15] text-[#1b1600] border-[#facc15] font-bold'
                  : 'bg-[#171c23] text-[#d1c6ab] border-[#30353d] hover:bg-[#252a32]'
              }`}
            >
              {type === 'ALL' ? 'ทั้งหมด (All)' : type}
            </button>
          ))}
        </div>

        {/* Task List / Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs text-[#8a92a6]">กำลังโหลดคิวงาน...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-16 text-center border border-[#30353d] rounded-2xl bg-[#171c23]/40 p-8">
            <CheckCircle2 className="w-12 h-12 text-[#57ec7f] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#dee2ec]">ไม่มีคิวงานค้างในขณะนี้</h3>
            <p className="text-xs text-[#8a92a6] mt-1">งานจัดเก็บ หยิบสินค้า และเติมสต็อกอยู่ในสถานะปกติทั้งหมด</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => {
              const isUrgent = task.priority <= 2;
              return (
                <div
                  key={task.id}
                  className={`p-5 rounded-xl border bg-[#171c23] shadow-lg flex flex-col justify-between transition-all hover:border-[#facc15]/50 ${
                    isUrgent ? 'border-[#ffb4ab]/40 ring-1 ring-[#ffb4ab]/20' : 'border-[#30353d]'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        task.task_type === 'REPLENISHMENT' ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border-[#ffb4ab]/30' :
                        task.task_type === 'PUTAWAY' ? 'bg-[#4cd7f6]/20 text-[#4cd7f6] border-[#4cd7f6]/30' :
                        'bg-[#57ec7f]/20 text-[#57ec7f] border-[#57ec7f]/30'
                      }`}>
                        {task.task_type}
                      </span>
                      <span className="text-[10px] text-[#8a92a6] font-mono">
                        P{task.priority} {isUrgent ? '🔥 ด่วน' : ''}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#dee2ec] line-clamp-1">{task.product_name || task.sku}</h4>
                    <p className="text-[11px] text-[#8a92a6] mb-3">SKU: {task.sku}</p>

                    {/* Routing */}
                    <div className="bg-[#090f15] p-3 rounded-lg border border-[#30353d] mb-4 text-xs space-y-1">
                      <div className="flex justify-between text-[#8a92a6]">
                        <span>ต้นทาง (Source):</span>
                        <span className="text-[#dee2ec] font-bold">{task.source_location || 'Receiving Dock'}</span>
                      </div>
                      <div className="flex justify-between text-[#8a92a6]">
                        <span>ปลายทาง (Target):</span>
                        <span className="text-[#facc15] font-bold">{task.target_location || 'Unassigned'}</span>
                      </div>
                      <div className="flex justify-between text-[#8a92a6] pt-1 border-t border-[#30353d]">
                        <span>จำนวน (Qty):</span>
                        <span className="text-[#57ec7f] font-bold">{task.requested_qty} ชิ้น</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[#30353d]">
                    <button
                      onClick={() => handleCompleteTask(task.id, task.requested_qty)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#57ec7f]/20 border border-[#57ec7f]/40 text-[#57ec7f] hover:bg-[#57ec7f]/30 rounded-lg text-xs font-bold transition-all"
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
