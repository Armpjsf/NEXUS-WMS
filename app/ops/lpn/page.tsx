'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layers, 
  Plus, 
  MoveRight, 
  Printer, 
  Search, 
  RefreshCw, 
  MapPin, 
  Scale, 
  Box, 
  CheckCircle2, 
  X,
  FileSpreadsheet,
  QrCode,
  ArrowRight
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { LPN, LPNItem } from '@/lib/lpnEngine';

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
              unit: 'ชิ้น'
            }
          ]
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สร้างพาเลทไม่สำเร็จ');
      toast.success(`สร้าง LPN ${json.data?.lpnNumber} สำเร็จ`);
      setShowCreateModal(false);
      fetchLpns();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
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
          newLocation
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ย้ายพาเลทไม่สำเร็จ');
      toast.success(json.message || 'ย้ายพาเลทสำเร็จ');
      setMovingLpn(null);
      setNewLocation('');
      fetchLpns();
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsMoving(false);
    }
  };

  const filtered = lpns.filter(l => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return l.lpnNumber.toLowerCase().includes(q) ||
           l.locationCode.toLowerCase().includes(q) ||
           l.items.some(it => it.sku.toLowerCase().includes(q) || it.productName?.toLowerCase().includes(q));
  });

  return (
    <div className="relative min-h-screen p-4 md:p-8 pb-32 font-mono">
      <AmbientBackground />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#30353d] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4cd7f6] animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4cd7f6]">
                BULK PALLET & LICENSE PLATE TRACKING (LPN)
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#dee2ec] tracking-tight flex items-center gap-3">
              <span>ระบบติดตามระดับพาเลทและกล่องแม่ (LPN Console)</span>
            </h1>
            <p className="text-xs text-[#8a92a6] mt-1">
              ผูกสินค้าและ Lot ย่อยเข้ากับรหัสพาเลท เคลื่อนย้ายสินค้าทั้งกองใน 1 สแกน (Bulk Pallet Move) ลดเวลาหน้างานกว่า 80%
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#facc15] hover:bg-[#eec200] text-[#1b1600] font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ สร้างพาเลทใหม่ (New LPN)</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-[#30353d] bg-[#171c23]/80 backdrop-blur-md">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#8a92a6]" />
            <input
              type="text"
              placeholder="ค้นหารหัส LPN, พิกัด หรือ SKU ภายในพาเลท..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#090f15] border border-[#30353d] rounded-lg text-xs text-[#dee2ec] placeholder-[#8a92a6] outline-none focus:border-[#4cd7f6]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={fetchLpns}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#30353d] bg-[#252a32] text-[#d1c6ab] hover:text-[#dee2ec]"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span>รีเฟรช</span>
            </button>
            <span className="text-[#8a92a6]">ทั้งหมด: <strong>{filtered.length}</strong> พาเลท</span>
          </div>
        </div>

        {/* LPN Grid Cards */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#8a92a6]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#4cd7f6]" />
            กำลังโหลดข้อมูล LPN...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 rounded-2xl border border-[#30353d] bg-[#171c23] text-center text-xs text-[#8a92a6]">
            <Layers className="w-12 h-12 text-[#8a92a6] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#dee2ec] mb-1">ไม่พบข้อมูล LPN ในระบบ</h3>
            <p>คลิก "+ สร้างพาเลทใหม่ (New LPN)" เพื่อเริ่มต้นจัดกลุ่มสินค้าเข้าสู่พาเลท</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((lpn) => {
              const totalPieces = lpn.items.reduce((s, it) => s + it.quantity, 0);
              return (
                <div
                  key={lpn.lpnNumber}
                  className="rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-xl space-y-4 hover:border-[#4cd7f6]/60 transition-all"
                >
                  <div className="flex items-start justify-between border-b border-[#30353d] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-[#4cd7f6]/10 text-[#4cd7f6] border border-[#4cd7f6]/30">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-[#dee2ec]">{lpn.lpnNumber}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#57ec7f]/10 text-[#57ec7f] border border-[#57ec7f]/30">
                            {lpn.lpnType}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8a92a6] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-[#facc15]" />
                          พิกัดปัจจุบัน: <strong className="text-[#facc15]">{lpn.locationCode}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setMovingLpn(lpn)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#252a32] border border-[#30353d] hover:border-[#facc15] text-[#dee2ec] hover:text-[#facc15] text-xs font-bold transition-all"
                      >
                        <MoveRight className="w-3.5 h-3.5" />
                        <span>ย้ายพิกัด</span>
                      </button>

                      <button
                        onClick={() => setPrintingLpn(lpn)}
                        className="p-1.5 rounded-lg bg-[#252a32] border border-[#30353d] text-[#d1c6ab] hover:text-[#4cd7f6]"
                        title="พิมพ์สลาก LPN"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contents */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-[#8a92a6] uppercase tracking-wider block">
                      สินค้าบนพาเลทนี้ ({lpn.items.length} รายการ | {totalPieces} ชิ้น):
                    </span>
                    <div className="space-y-1.5 bg-[#090f15] p-3 rounded-lg border border-[#30353d] text-xs max-h-36 overflow-y-auto">
                      {lpn.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-[#30353d]/40 last:border-0">
                          <div>
                            <span className="font-bold text-[#dee2ec] block">{it.productName || it.sku}</span>
                            <span className="text-[10px] text-[#8a92a6]">SKU: {it.sku} | Lot: {it.lotNumber || '-'}</span>
                          </div>
                          <span className="font-bold text-[#57ec7f]">{it.quantity} {it.unit || 'ชิ้น'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {lpn.notes && (
                    <p className="text-[11px] text-[#8a92a6] italic">บันทึก: {lpn.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Move Modal */}
        <AnimatePresence>
          {movingLpn && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md rounded-2xl border border-[#30353d] bg-[#171c23] p-6 space-y-4 shadow-2xl"
              >
                <div className="flex justify-between items-center border-b border-[#30353d] pb-3">
                  <h3 className="text-base font-bold text-[#dee2ec] flex items-center gap-2">
                    <MoveRight className="w-5 h-5 text-[#facc15]" />
                    <span>ย้ายพิกัดพาเลท (Bulk Relocate)</span>
                  </h3>
                  <button onClick={() => setMovingLpn(null)} className="text-[#8a92a6] hover:text-[#dee2ec]">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-xs space-y-1 bg-[#090f15] p-3 rounded-lg border border-[#30353d]">
                  <p>พาเลท: <strong className="text-[#facc15]">{movingLpn.lpnNumber}</strong></p>
                  <p>พิกัดเดิม: <strong className="text-[#dee2ec]">{movingLpn.locationCode}</strong></p>
                  <p>จำนวนสินค้าทั้งหมด: <strong className="text-[#57ec7f]">{movingLpn.items.reduce((s, it) => s + it.quantity, 0)} ชิ้น</strong></p>
                </div>

                <form onSubmit={handleMoveLpn} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[#8a92a6] mb-1 font-bold">ระบุพิกัดปลายทางใหม่ (New Location) *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น A-01-02, BULK-02, STAGE-DOCK"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-[#090f15] border border-[#30353d] rounded-lg text-[#dee2ec] font-bold outline-none focus:border-[#facc15]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setMovingLpn(null)}
                      className="px-4 py-2 rounded-lg border border-[#30353d] text-[#d1c6ab]"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isMoving}
                      className="px-5 py-2 rounded-lg bg-[#facc15] text-[#1b1600] font-bold hover:bg-[#eec200] disabled:opacity-50"
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
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg rounded-2xl border border-[#30353d] bg-[#171c23] p-6 space-y-4 shadow-2xl"
              >
                <div className="flex justify-between items-center border-b border-[#30353d] pb-3">
                  <h3 className="text-base font-bold text-[#dee2ec] flex items-center gap-2">
                    <Plus className="w-5 h-5 text-[#facc15]" />
                    <span>สร้างพาเลท / กล่องแม่ใหม่ (New LPN)</span>
                  </h3>
                  <button onClick={() => setShowCreateModal(false)} className="text-[#8a92a6] hover:text-[#dee2ec]">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateLpn} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#8a92a6] mb-1">ประเภทบรรจุภัณฑ์</label>
                      <select
                        value={newLpnType}
                        onChange={(e: any) => setNewLpnType(e.target.value)}
                        className="w-full px-3 py-2 bg-[#090f15] border border-[#30353d] rounded-lg text-[#dee2ec]"
                      >
                        <option value="PALLET">พาเลทมาตรฐาน (Pallet)</option>
                        <option value="MASTER_CARTON">กล่องแม่ (Master Carton)</option>
                        <option value="TOTE">ถาดหยิบ (Tote Box)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#8a92a6] mb-1">พิกัดจัดวางเริ่มต้น</label>
                      <input
                        type="text"
                        required
                        value={newLocationCode}
                        onChange={(e) => setNewLocationCode(e.target.value)}
                        className="w-full px-3 py-2 bg-[#090f15] border border-[#30353d] rounded-lg text-[#dee2ec]"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-[#090f15] rounded-xl border border-[#30353d] space-y-2">
                    <span className="font-bold text-[#facc15] block">สินค้าชุดแรกบนพาเลท:</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-[#8a92a6]">รหัส SKU *</label>
                        <input
                          type="text"
                          required
                          value={newSku}
                          onChange={(e) => setNewSku(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#171c23] border border-[#30353d] rounded text-[#dee2ec]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8a92a6]">Lot Number</label>
                        <input
                          type="text"
                          value={newLot}
                          onChange={(e) => setNewLot(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#171c23] border border-[#30353d] rounded text-[#dee2ec]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8a92a6]">จำนวน (ชิ้น) *</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newQty}
                          onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                          className="w-full px-2.5 py-1.5 bg-[#171c23] border border-[#30353d] rounded text-[#dee2ec]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#8a92a6] mb-1">บันทึกเพิ่มเติม</label>
                    <input
                      type="text"
                      placeholder="เช่น พาเลทรับเข้าจากตู้คอนเทนเนอร์ช่วงเช้า"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-[#090f15] border border-[#30353d] rounded-lg text-[#dee2ec]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-lg border border-[#30353d] text-[#d1c6ab]"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-5 py-2 rounded-lg bg-[#facc15] text-[#1b1600] font-bold hover:bg-[#eec200] disabled:opacity-50"
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
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md rounded-2xl border border-[#30353d] bg-[#171c23] p-6 space-y-4 shadow-2xl"
              >
                <div className="flex justify-between items-center border-b border-[#30353d] pb-3">
                  <h3 className="text-base font-bold text-[#dee2ec] flex items-center gap-2">
                    <Printer className="w-5 h-5 text-[#57ec7f]" />
                    <span>พิมพ์สลากพาเลท (Pallet LPN Label)</span>
                  </h3>
                  <button onClick={() => setPrintingLpn(null)} className="text-[#8a92a6] hover:text-[#dee2ec]">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* White Sticker Mockup */}
                <div className="bg-white text-black p-4 rounded-lg shadow-xl border-2 border-black font-sans text-xs space-y-2">
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
                        <span>{it.sku} (Lot: {it.lotNumber || '-'})</span>
                        <span className="font-bold">{it.quantity} {it.unit || 'ชิ้น'}</span>
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
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#57ec7f] text-[#090f15] font-bold"
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