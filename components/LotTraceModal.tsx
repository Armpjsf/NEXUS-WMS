'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, GitBranch, RefreshCw, AlertTriangle, PackageCheck, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/errors';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product?: any; // .id/.sku, .name
}

interface Lot { lotNumber: string; expDate?: string; currentQty?: number }
interface Recipient { docRef: string; party: string; qty: number }

export function LotTraceModal({ isOpen, onClose, product }: Props) {
  const sku: string = product?.id || product?.sku || '';
  const [lots, setLots] = useState<Lot[]>([]);
  const [activeLot, setActiveLot] = useState<string | null>(null);
  const [trace, setTrace] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadLots = useCallback(async () => {
    if (!sku) return;
    try {
      const d = await (await fetch(`/api/lots?sku=${encodeURIComponent(sku)}`, { cache: 'no-store' })).json();
      setLots(Array.isArray(d.data) ? d.data : []);
    } catch { toast.error('โหลดล็อตไม่สำเร็จ'); }
  }, [sku]);

  useEffect(() => { if (isOpen) { loadLots(); setActiveLot(null); setTrace(null); } }, [isOpen, loadLots]);

  const openTrace = async (lot: string) => {
    setActiveLot(lot); setTrace(null); setLoading(true);
    try {
      const d = await (await fetch(`/api/lots/trace?sku=${encodeURIComponent(sku)}&lot=${encodeURIComponent(lot)}`, { cache: 'no-store' })).json();
      setTrace(d);
    } catch { toast.error('สืบค้นไม่สำเร็จ'); } finally { setLoading(false); }
  };

  const doRecall = async (recall: boolean) => {
    if (!activeLot) return;
    if (recall && !confirm(`ยืนยันเรียกคืนล็อต ${activeLot}? ระบบจะ flag ล็อตและแสดงรายชื่อผู้รับที่กระทบ`)) return;
    setBusy(true);
    try {
      const d = await (await fetch('/api/lots/recall', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, lot: activeLot, action: recall ? 'RECALL' : 'CLEAR' }),
      })).json();
      if (d.error) throw new Error(d.error);
      toast.success(d.message || 'สำเร็จ');
      await openTrace(activeLot); await loadLots();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const recipients: Recipient[] = trace?.recipients || [];
  const recalled = !!trace?.lotInfo?.recalled;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
            className="w-full max-w-xl bg-[#171c23] border border-[#30353d] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#30353d]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center justify-center"><GitBranch className="w-4 h-4" /></div>
                <div>
                  <h3 className="font-bold text-[#dee2ec] text-sm leading-tight">สืบค้นย้อนกลับ & เรียกคืนล็อต</h3>
                  <p className="text-[11px] text-[#8a92a6] font-mono">{product?.name || sku}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-[#8a92a6] hover:text-[#dee2ec]"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
              {/* lot picker */}
              <div>
                <div className="text-[11px] font-bold text-[#8a92a6] uppercase mb-2">เลือกล็อต</div>
                {lots.length === 0 ? <div className="text-xs text-[#8a92a6]">สินค้านี้ยังไม่มีล็อต (product_lots)</div> : (
                  <div className="flex flex-wrap gap-2">
                    {lots.map(l => (
                      <button key={l.lotNumber} onClick={() => openTrace(l.lotNumber)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${activeLot === l.lotNumber ? 'bg-rose-500/20 text-rose-200 border-rose-500/40' : 'bg-[#1b2027] text-[#dee2ec] border-[#30353d] hover:border-rose-500/30'}`}>
                        {l.lotNumber}{l.expDate ? <span className="text-[10px] text-[#8a92a6] ml-1">EXP {l.expDate}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {loading && <div className="text-xs text-[#8a92a6] py-4 text-center"><RefreshCw className="w-4 h-4 animate-spin inline" /> กำลังสืบค้น...</div>}

              {trace && !loading && (
                <>
                  {recalled && (
                    <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-rose-300 text-xs font-bold">
                      <ShieldAlert className="w-4 h-4" /> ล็อตนี้ถูกเรียกคืนแล้ว (RECALLED)
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#1b2027] rounded-xl p-3 border border-[#30353d]">
                      <div className="text-[10px] uppercase text-[#8a92a6] font-bold flex items-center gap-1"><PackageCheck className="w-3 h-3" /> รับเข้า</div>
                      <div className="text-xl font-black text-[#57ec7f] font-mono">{trace.totals?.received ?? 0}</div>
                    </div>
                    <div className="bg-[#1b2027] rounded-xl p-3 border border-[#30353d]">
                      <div className="text-[10px] uppercase text-[#8a92a6] font-bold flex items-center gap-1"><GitBranch className="w-3 h-3" /> ส่งออก</div>
                      <div className="text-xl font-black text-[#facc15] font-mono">{trace.totals?.shipped ?? 0}</div>
                    </div>
                  </div>

                  {trace.source === 'ledger-fifo' && (
                    <p className="text-[11px] text-[#8a92a6] -mt-1">
                      ล็อตย้อนหลัง (ก่อนเปิดระบบติดตามล็อต) — คำนวณจากประวัติรับ-จ่ายแบบเข้าก่อนออกก่อน (FIFO){trace.totals?.damaged ? ` · ตัดชำรุด ${trace.totals.damaged}` : ''}
                    </p>
                  )}

                  {/* recipients / recall list */}
                  <div>
                    <div className="text-[11px] font-bold text-[#8a92a6] uppercase mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> ผู้รับที่กระทบ (Recall List)</div>
                    {recipients.length === 0 ? <div className="text-xs text-[#8a92a6]">ยังไม่มีการส่งออกล็อตนี้</div> : (
                      <div className="space-y-1.5">
                        {recipients.map((r, i) => (
                          <div key={i} className="flex items-center justify-between bg-[#1b2027] border border-[#30353d] rounded-xl px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#dee2ec] truncate">
                                {r.party || (/^HIST-/.test(r.docRef || '') ? 'ข้อมูลย้อนหลัง (ไม่มีชื่อลูกค้า)' : '(ไม่ระบุลูกค้า)')}
                              </div>
                              <div className="text-[11px] text-[#8a92a6] font-mono">
                                {/^HIST-/.test(r.docRef || '') ? 'นำเข้าจากประวัติ ไม่มีเลขเอกสาร' : (r.docRef || '-')}
                              </div>
                            </div>
                            <span className="text-sm font-black text-[#facc15] font-mono shrink-0">{r.qty}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* recall action */}
                  <div className="pt-1">
                    {recalled ? (
                      <button onClick={() => doRecall(false)} disabled={busy} className="w-full py-2.5 rounded-xl bg-[#252a32] border border-[#30353d] text-[#dee2ec] text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                        <Undo2 className="w-4 h-4" /> ยกเลิกการเรียกคืน
                      </button>
                    ) : (
                      <button onClick={() => doRecall(true)} disabled={busy} className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} เรียกคืนล็อตนี้ (Recall)
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
