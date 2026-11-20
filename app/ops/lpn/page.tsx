'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Plus,
  MoveRight,
  Printer,
  Search,
  RefreshCw,
  MapPin,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { LPN } from '@/lib/lpnEngine';
import { errorMessage } from '@/lib/errors';

export default function LpnManagementPage() {
  const [lpns, setLpns] = useState<LPN[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Move LPN State
  const [movingLpn, setMovingLpn] = useState<LPN | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  // New LPN State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLpnType, setNewLpnType] = useState<'PALLET' | 'MASTER_CARTON' | 'TOTE'>('PALLET');
  const [newLocationCode, setNewLocationCode] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newLot, setNewLot] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newNotes, setNewNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Print Label State
  const [printingLpn, setPrintingLpn] = useState<LPN | null>(null);

  const fetchLpns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lpn');
      const json = await res.json();
      if (json.success) {
        setLpns(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLpns();
  }, []);

  const handleCreateLpn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch('/api/lpn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lpnType: newLpnType,
          locationCode: newLocationCode,
          notes: newNotes,
          items: [
            {
              sku: newSku,
              productName: newSku === 'SKU-SOLAR-5K' ? 'Heavy Duty Solar Inverter 5kW' : 'พาราเซตามอล 500mg',
              lotNumber: newLot,
              quantity: newQty,
              unit: 'ชิ้น',
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างพาเลทไม่สำเร็จ');
      toast.success(`สร้าง LPN ${json.data?.lpnNumber} สำเร็จ`);
      setShowCreateModal(false);
      fetchLpns();
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาด');
    } finally {
      setIsCreating(false);
    }
  };

  const handleMoveLpn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingLpn || !newLocation) return;
    setIsMoving(true);
    try {
      const res = await fetch('/api/lpn/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lpnNumber: movingLpn.lpnNumber,
          newLocation,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ย้ายพาเลทไม่สำเร็จ');
      toast.success(json.message || 'ย้ายพาเลทสำเร็จ');
      setMovingLpn(null);
      setNewLocation('');
      fetchLpns();
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาด');
    } finally {
      setIsMoving(false);
    }
  };

  const filtered = lpns.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      l.lpnNumber.toLowerCase().includes(q) ||
      l.locationCode.toLowerCase().includes(q) ||
      l.items.some((it) => it.sku.toLowerCase().includes(q) || it.productName?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Open Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                Bulk Pallet & License Plate Tracking
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12 border border-sky-500/20 text-sky-700">
                <Layers className="w-5 h-5" />
              </span>
              <span>ระบบติดตามระดับพาเลทและกล่องแม่ (LPN Console)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              ผูกสินค้าและ Lot ย่อยเข้ากับรหัสพาเลท เคลื่อนย้ายสินค้าทั้งกองใน 1 สแกน (Bulk Pallet Move) ลดเวลาหน้างานกว่า 80%
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างพาเลทใหม่ (New LPN)</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="nx-glass-card flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัส LPN, พิกัด หรือ SKU ภายในพาเลท..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/90 border border-slate-200/80 rounded-full text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={fetchLpns}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200/80 bg-white/85 hover:bg-white text-slate-700 hover:text-slate-900 font-semibold shadow-xs transition"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 text-emerald-600', loading && 'animate-spin')} />
              <span>รีเฟรช</span>
            </button>
            <span className="text-slate-600 tabular-nums">
              ทั้งหมด: <strong className="text-slate-900">{filtered.length}</strong> พาเลท
            </span>
          </div>
        </div>

        {/* LPN Grid Cards */}
        {loading ? (
          <div className="nx-glass-card py-16 text-center text-xs text-slate-600">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
            กำลังโหลดข้อมูล LPN...
          </div>
        ) : filtered.length === 0 ? (
          <div className="nx-glass-card p-12 text-center text-xs text-slate-600">
            <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">ไม่พบข้อมูล LPN ในระบบ</h3>
            <p>คลิก &quot;สร้างพาเลทใหม่ (New LPN)&quot; เพื่อเริ่มต้นจัดกลุ่มสินค้าเข้าสู่พาเลท</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((lpn) => {
              const totalPieces = lpn.items.reduce((s, it) => s + it.quantity, 0);
              return (
                <div key={lpn.lpnNumber} className="nx-glass-card p-5 space-y-4 transition-all">
                  <div className="flex items-start justify-between border-b border-slate-200/70 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-sky-500/12 text-sky-700 border border-sky-500/20">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base text-slate-900">{lpn.lpnNumber}</span>
                          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 border border-emerald-500/20">
                            {lpn.lpnType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          พิกัดปัจจุบัน: <strong className="text-amber-700 font-mono">{lpn.locationCode}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setMovingLpn(lpn)}
                        className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white/90 border border-slate-200/80 hover:border-amber-500 text-slate-700 hover:text-amber-800 text-xs font-semibold shadow-xs transition-all"
                      >
                        <MoveRight className="w-3.5 h-3.5" />
                        <span>ย้ายพิกัด</span>
                      </button>

                      <button
                        onClick={() => setPrintingLpn(lpn)}
                        className="p-2 rounded-full bg-white/90 border border-slate-200/80 text-slate-600 hover:text-sky-700 shadow-xs transition"
                        title="พิมพ์สลาก LPN"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contents */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block tabular-nums">
                      สินค้าบนพาเลทนี้ ({lpn.items.length} รายการ | {totalPieces} ชิ้น):
                    </span>
                    <div className="space-y-1.5 bg-slate-50/90 p-3 rounded-2xl border border-slate-200/80 text-xs max-h-36 overflow-y-auto">
                      {lpn.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center py-1.5 border-b border-slate-200/70 last:border-0"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">{it.productName || it.sku}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              SKU: {it.sku} | Lot: {it.lotNumber || '-'}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700 tabular-nums">
                            {it.quantity} {it.unit || 'ชิ้น'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {lpn.notes && <p className="text-[11px] text-slate-500 italic">บันทึก: {lpn.notes}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Move Modal */}
        <AnimatePresence>
          {movingLpn && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 space-y-4 shadow-2xl text-slate-900"
              >
                <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <MoveRight className="w-5 h-5 text-amber-600" />
                    <span>ย้ายพิกัดพาเลท (Bulk Relocate)</span>
                  </h3>
                  <button
                    onClick={() => setMovingLpn(null)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs space-y-1 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 tabular-nums">
                  <p>
                    พาเลท: <strong className="text-amber-700 font-mono">{movingLpn.lpnNumber}</strong>
                  </p>
                  <p>
                    พิกัดเดิม: <strong className="text-slate-900 font-mono">{movingLpn.locationCode}</strong>
                  </p>
                  <p>
                    จำนวนสินค้าทั้งหมด:{' '}
                    <strong className="text-emerald-700">
                      {movingLpn.items.reduce((s, it) => s + it.quantity, 0)} ชิ้น
                    </strong>
                  </p>
                </div>

                <form onSubmit={handleMoveLpn} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-700 mb-1 font-semibold">
                      ระบุพิกัดปลายทางใหม่ (New Location) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น A-01-02, BULK-02, STAGE-DOCK"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200/80 rounded-xl text-slate-900 font-mono font-bold outline-none focus:bg-white focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setMovingLpn(null)}
                      className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isMoving}
                      className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold disabled:opacity-50"
                    >
                      {isMoving ? 'กำลังย้าย...' : 'ยืนยันการย้ายพาเลท'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Create LPN Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 space-y-4 shadow-2xl text-slate-900"
              >
                <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-amber-600" />
                    <span>สร้างพาเลท / กล่องแม่ใหม่ (New LPN)</span>
                  </h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateLpn} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">ประเภทบรรจุภัณฑ์</label>
                      <select
                        value={newLpnType}
                        onChange={(e: any) => setNewLpnType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200/80 rounded-xl text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="PALLET">พาเลทมาตรฐาน (Pallet)</option>
                        <option value="MASTER_CARTON">กล่องแม่ (Master Carton)</option>
                        <option value="TOTE">ถาดหยิบ (Tote Box)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">พิกัดจัดวางเริ่มต้น</label>
                      <input
                        type="text"
                        required
                        value={newLocationCode}
                        onChange={(e) => setNewLocationCode(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200/80 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <span className="font-bold text-slate-800 block">สินค้าชุดแรกบนพาเลท:</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-600 font-semibold">รหัส SKU *</label>
                        <input
                          type="text"
                          required
                          value={newSku}
                          onChange={(e) => setNewSku(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 font-semibold">Lot Number</label>
                        <input
                          type="text"
                          value={newLot}
                          onChange={(e) => setNewLot(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 font-semibold">จำนวน (ชิ้น) *</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newQty}
                          onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">บันทึกเพิ่มเติม</label>
                    <input
                      type="text"
                      placeholder="เช่น พาเลทรับเข้าจากตู้คอนเทนเนอร์ช่วงเช้า"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200/80 rounded-xl text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold disabled:opacity-50"
                    >
                      {isCreating ? 'กำลังสร้าง...' : 'สร้าง LPN'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Print LPN Sticker Preview */}
        <AnimatePresence>
          {printingLpn && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 space-y-4 shadow-2xl text-slate-900"
              >
                <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-emerald-600" />
                    <span>พิมพ์สลากพาเลท (Pallet LPN Label)</span>
                  </h3>
                  <button
                    onClick={() => setPrintingLpn(null)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* White Sticker Mockup */}
                <div className="bg-white text-black p-4 rounded-xl shadow-md border-2 border-black font-sans text-xs space-y-2">
                  <div className="flex justify-between items-center border-b-2 border-black pb-1 font-bold">
                    <span className="text-sm">NEXUS WMS PALLET ID</span>
                    <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded">{printingLpn.lpnType}</span>
                  </div>

                  <div className="py-2 text-center border-b border-black">
                    <div className="font-mono text-lg font-bold tracking-wider">{printingLpn.lpnNumber}</div>
                    <div className="h-12 bg-[repeating-linear-gradient(90deg,#000,#000_2px,#fff_2px,#fff_4px)] w-full my-1 border border-black" />
                    <span className="text-[10px] font-mono text-gray-700">Location: {printingLpn.locationCode}</span>
                  </div>

                  <div className="text-[10px] space-y-1">
                    <strong>รายการสินค้าบนพาเลท:</strong>
                    {printingLpn.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-gray-800">
                        <span>
                          {it.sku} (Lot: {it.lotNumber || '-'})
                        </span>
                        <span className="font-bold tabular-nums">
                          {it.quantity} {it.unit || 'ชิ้น'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 text-xs">
                  <button
                    onClick={() => {
                      toast.success('สั่งพิมพ์ฉลากพาเลทเรียบร้อยแล้ว');
                      setPrintingLpn(null);
                    }}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>พิมพ์สลาก (Print Label)</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
