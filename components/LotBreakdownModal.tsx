'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Layers, Plus, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/errors';

interface LotItem {
  id?: string;
  sku: string;
  productName?: string;
  lotNumber?: string;
  batchNumber?: string;
  lotNo?: string;
  quantity?: number;
  currentQty?: number;
  receivedQty?: number;
  expDate?: string;
  expiryDate?: string;
  mfgDate?: string;
  daysToExpiry?: number;
  expiryRisk?: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'HEALTHY';
  fefo?: {
    daysToExpiry: number;
    risk: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'HEALTHY';
  };
}

interface LotBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: any;
  allProducts?: any[];
  onRefresh?: () => void;
}

export function LotBreakdownModal({ isOpen, onClose, product, allProducts = [], onRefresh }: LotBreakdownModalProps) {
  const [lots, setLots] = useState<LotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  
  // Add Lot Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newQuantity, setNewQuantity] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setNewSku(product.id || product.sku || '');
      }
      fetchLots();
    }
  }, [isOpen, product]);

  const fetchLots = async () => {
    setLoading(true);
    try {
      const url = product 
        ? `/api/lots?sku=${encodeURIComponent(product.id || product.sku)}` 
        : `/api/lots`;
      
      const res = await fetch(url);
      let fetchedLots: LotItem[] = [];
      if (res.ok) {
        const json = await res.json();
        fetchedLots = Array.isArray(json) ? json : (json.data || []);
      }

      // If specific product has lot in products table but not in product_lots yet, synth one
      if (product && fetchedLots.length === 0 && (product.lotNo || product.expiryDate)) {
        const exp = product.expiryDate;
        const now = Date.now();
        const expTime = exp ? new Date(exp).getTime() : null;
        const days = expTime ? Math.ceil((expTime - now) / 86400000) : 0;
        let risk: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
        if (days < 0) risk = 'EXPIRED';
        else if (days <= 15) risk = 'CRITICAL';
        else if (days <= 45) risk = 'WARNING';

        fetchedLots = [{
          id: 'primary-lot',
          sku: product.id,
          productName: product.name,
          lotNumber: product.lotNo || 'LOT-PRIMARY',
          expDate: product.expiryDate,
          currentQty: product.stock,
          quantity: product.stock,
          daysToExpiry: days,
          expiryRisk: risk
        }];
      }

      // If global view and lots table is empty, collect lots from allProducts
      if (!product && fetchedLots.length === 0 && allProducts.length > 0) {
        const synths: LotItem[] = [];
        allProducts.forEach(p => {
          if (p.lotNo || p.expiryDate) {
            const exp = p.expiryDate;
            const now = Date.now();
            const expTime = exp ? new Date(exp).getTime() : null;
            const days = expTime ? Math.ceil((expTime - now) / 86400000) : 0;
            let risk: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
            if (days < 0) risk = 'EXPIRED';
            else if (days <= 15) risk = 'CRITICAL';
            else if (days <= 45) risk = 'WARNING';

            synths.push({
              id: `lot-${p.id}`,
              sku: p.id,
              productName: p.name,
              lotNumber: p.lotNo || 'LOT-DEFAULT',
              expDate: p.expiryDate,
              currentQty: p.stock,
              quantity: p.stock,
              daysToExpiry: days,
              expiryRisk: risk
            });
          }
        });
        fetchedLots = synths;
      }

      setLots(fetchedLots);
    } catch (err) {
      console.error('Failed to fetch lots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLot = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSku = product ? (product.id || product.sku) : newSku;
    if (!targetSku || !newLotNumber || !newExpiryDate || newQuantity <= 0) {
      toast.error('กรุณากรอกข้อมูล SKU, Lot, วันหมดอายุ และจำนวนให้ครบถ้วน');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: targetSku,
          lotNumber: newLotNumber,
          receivedQty: newQuantity,
          currentQty: newQuantity,
          expDate: newExpiryDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'บันทึก Lot ล้มเหลว');
      }

      toast.success(`บันทึก Lot ${newLotNumber} สำเร็จ`);
      setNewLotNumber('');
      setNewExpiryDate('');
      setNewQuantity(0);
      setShowAddForm(false);
      fetchLots();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    let expired = 0, critical = 0, warning = 0, healthy = 0;
    lots.forEach(l => {
      const risk = l.expiryRisk || l.fefo?.risk;
      if (risk === 'EXPIRED') expired++;
      else if (risk === 'CRITICAL') critical++;
      else if (risk === 'WARNING') warning++;
      else healthy++;
    });
    return { total: lots.length, expired, critical, warning, healthy };
  }, [lots]);

  // Filtered
  const filteredLots = useMemo(() => {
    return lots.filter(l => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || 
        (l.sku && l.sku.toLowerCase().includes(q)) || 
        (l.lotNumber && l.lotNumber.toLowerCase().includes(q)) ||
        (l.productName && l.productName.toLowerCase().includes(q));

      const risk = l.expiryRisk || l.fefo?.risk || 'HEALTHY';
      const matchRisk = filterRisk === 'ALL' || risk === filterRisk;

      return matchSearch && matchRisk;
    });
  }, [lots, search, filterRisk]);

  const getRiskBadge = (risk?: string, days?: number) => {
    switch (risk) {
      case 'EXPIRED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/40">
            หมดอายุแล้ว ({days ?? 0} วัน)
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#eec200]/20 text-[#facc15] border border-[#facc15]/40 animate-pulse">
            วิกฤต (เหลือ {days} วัน)
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/40">
            เตือน (เหลือ {days} วัน)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#57ec7f]/20 text-[#57ec7f] border border-[#57ec7f]/40">
            ปกติ (เหลือ {days ?? 0} วัน)
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#30353d] bg-[#090f15] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#4cd7f6]/10 p-2.5 text-[#4cd7f6] border border-[#4cd7f6]/20">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-headline text-base sm:text-lg font-bold text-[#dee2ec] flex items-center gap-2">
                  <span>{product ? 'FEFO Lot Detail — รายการ Lot ของสินค้า' : 'ภาพรวมระบบ FEFO & Lot Control'}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#4cd7f6]/10 text-[#4cd7f6] border border-[#4cd7f6]/30">
                    First-Expired, First-Out
                  </span>
                </h3>
                <p className="font-mono text-xs text-[#d1c6ab]">
                  {product ? (
                    <>SKU: <span className="font-bold text-[#facc15]">{product.id}</span> | {product.name}</>
                  ) : (
                    'จัดการและตรวจสอบอายุการเก็บรักษาสินค้าทุก Lot ในคลังสินค้า'
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-[#d1c6ab] hover:bg-[#252a32] hover:text-[#dee2ec] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Metric Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-[#090f15]/60 border-b border-[#30353d] font-mono text-xs">
            <div 
              onClick={() => setFilterRisk('ALL')}
              className={cn("p-2.5 rounded-xl border cursor-pointer transition-all", filterRisk === 'ALL' ? "bg-[#252a32] border-[#facc15]" : "bg-[#171c23] border-[#30353d] hover:border-[#8a92a6]")}
            >
              <span className="text-[#8a92a6] block text-[10px]">Lots ทั้งหมด</span>
              <span className="text-lg font-bold text-[#dee2ec]">{metrics.total}</span>
            </div>
            <div 
              onClick={() => setFilterRisk('CRITICAL')}
              className={cn("p-2.5 rounded-xl border cursor-pointer transition-all", filterRisk === 'CRITICAL' ? "bg-[#eec200]/10 border-[#facc15]" : "bg-[#171c23] border-[#30353d] hover:border-[#facc15]/50")}
            >
              <span className="text-[#facc15] block text-[10px]">⏰ วิกฤต (≤15 วัน)</span>
              <span className="text-lg font-bold text-[#facc15]">{metrics.critical}</span>
            </div>
            <div 
              onClick={() => setFilterRisk('EXPIRED')}
              className={cn("p-2.5 rounded-xl border cursor-pointer transition-all", filterRisk === 'EXPIRED' ? "bg-[#93000a]/20 border-[#ffb4ab]" : "bg-[#171c23] border-[#30353d] hover:border-[#ffb4ab]/50")}
            >
              <span className="text-[#ffdad6] block text-[10px]">❌ หมดอายุแล้ว</span>
              <span className="text-lg font-bold text-[#ffdad6]">{metrics.expired}</span>
            </div>
            <div 
              onClick={() => setFilterRisk('HEALTHY')}
              className={cn("p-2.5 rounded-xl border cursor-pointer transition-all", filterRisk === 'HEALTHY' ? "bg-[#57ec7f]/10 border-[#57ec7f]" : "bg-[#171c23] border-[#30353d] hover:border-[#57ec7f]/50")}
            >
              <span className="text-[#57ec7f] block text-[10px]">✅ ปกติ (ปลอดภัย)</span>
              <span className="text-lg font-bold text-[#57ec7f]">{metrics.healthy}</span>
            </div>
          </div>

          {/* Filter / Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-4 border-b border-[#30353d] bg-[#171c23]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8a92a6]" />
              <input
                type="text"
                placeholder="ค้นหา SKU หรือหมายเลข Lot..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#090f15] border border-[#30353d] rounded-lg font-mono text-xs text-[#dee2ec] placeholder-[#8a92a6] outline-none focus:border-[#4cd7f6]"
              />
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={fetchLots}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#30353d] bg-[#252a32] text-[#d1c6ab] hover:text-[#dee2ec]"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                <span>รีเฟรช</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#facc15] font-bold text-[#1b1600] hover:bg-[#eec200] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{showAddForm ? 'ปิดฟอร์ม' : '+ เพิ่ม Lot'}</span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
            {/* Add Lot Form */}
            {showAddForm && (
              <form
                onSubmit={handleAddLot}
                className="rounded-xl border border-[#facc15]/40 bg-[#090f15] p-4 space-y-3 font-mono text-xs mb-4 shadow-lg"
              >
                <div className="font-bold text-[#facc15] flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>ลงทะเบียน Lot ใหม่เข้าสู่ระบบ FEFO</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {!product && (
                    <div>
                      <label className="block text-[#8a92a6] mb-1">เลือก SKU สินค้า *</label>
                      {allProducts.length > 0 ? (
                        <select
                          required
                          value={newSku}
                          onChange={(e) => setNewSku(e.target.value)}
                          className="w-full rounded-lg border border-[#30353d] bg-[#171c23] px-3 py-1.5 text-[#dee2ec] outline-none focus:border-[#facc15]"
                        >
                          <option value="">-- เลือก SKU --</option>
                          {allProducts.map(p => (
                            <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          placeholder="รหัส SKU เช่น SKU-001"
                          value={newSku}
                          onChange={(e) => setNewSku(e.target.value)}
                          className="w-full rounded-lg border border-[#30353d] bg-[#171c23] px-3 py-1.5 text-[#dee2ec] outline-none focus:border-[#facc15]"
                        />
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-[#8a92a6] mb-1">หมายเลข Lot / Batch *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น LOT-2026-09A"
                      value={newLotNumber}
                      onChange={(e) => setNewLotNumber(e.target.value)}
                      className="w-full rounded-lg border border-[#30353d] bg-[#171c23] px-3 py-1.5 text-[#dee2ec] outline-none focus:border-[#facc15]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] mb-1">วันหมดอายุ (Expiry) *</label>
                    <input
                      type="date"
                      required
                      value={newExpiryDate}
                      onChange={(e) => setNewExpiryDate(e.target.value)}
                      className="w-full rounded-lg border border-[#30353d] bg-[#171c23] px-3 py-1.5 text-[#dee2ec] outline-none focus:border-[#facc15]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] mb-1">จำนวนสินค้าใน Lot *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newQuantity || ''}
                      onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-[#30353d] bg-[#171c23] px-3 py-1.5 text-[#dee2ec] outline-none focus:border-[#facc15]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="rounded-lg border border-[#30353d] px-3 py-1 text-[#d1c6ab] hover:text-[#dee2ec]"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-[#facc15] px-4 py-1 font-bold text-[#1b1600] disabled:opacity-50 hover:bg-[#eec200]"
                  >
                    {submitting ? 'กำลังบันทึก...' : 'บันทึก Lot เข้าสู่ระบบ'}
                  </button>
                </div>
              </form>
            )}

            {/* Lot Table / Cards */}
            {loading ? (
              <div className="py-12 text-center font-mono text-xs text-[#8a92a6]">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-[#4cd7f6]" />
                กำลังโหลดข้อมูล FEFO Lots...
              </div>
            ) : filteredLots.length === 0 ? (
              <div className="rounded-xl border border-[#30353d] bg-[#090f15] p-8 text-center font-mono text-xs text-[#8a92a6]">
                <Layers className="mx-auto mb-3 h-10 w-10 text-[#8a92a6]" />
                <p className="text-sm font-bold text-[#dee2ec] mb-1">
                  {search ? 'ไม่พบรายการ Lot ที่ตรงกับคำค้นหา' : 'ยังไม่มีข้อมูล Lots ในระบบ'}
                </p>
                <p className="text-[11px] max-w-md mx-auto mb-4">
                  คลิกปุ่ม "+ เพิ่ม Lot" ด้านบน เพื่อระบุ Lot Number และวันหมดอายุสำหรับให้อัลกอริทึมจัดลำดับการเบิกจ่ายสินค้าแบบ First-Expired, First-Out (FEFO)
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 rounded-lg bg-[#facc15] text-[#1b1600] font-bold text-xs hover:bg-[#eec200] transition-colors"
                >
                  + เพิ่ม Lot แรกเลย
                </button>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-xs">
                {filteredLots.map((lot, idx) => {
                  const lotNum = lot.lotNumber || lot.lotNo || `LOT-${idx + 1}`;
                  const expDate = lot.expDate || lot.expiryDate || '-';
                  const risk = lot.expiryRisk || lot.fefo?.risk || 'HEALTHY';
                  const days = lot.daysToExpiry !== undefined ? lot.daysToExpiry : (lot.fefo?.daysToExpiry);
                  const qty = lot.currentQty !== undefined ? lot.currentQty : (lot.quantity || 0);

                  return (
                    <div
                      key={lot.id || idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-[#30353d] bg-[#090f15] p-3.5 gap-2 hover:border-[#4cd7f6]/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#252a32] font-mono text-xs font-bold text-[#4cd7f6]">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#dee2ec] text-sm">
                              {lotNum}
                            </span>
                            {getRiskBadge(risk, days)}
                            <span className="text-[10px] text-[#8a92a6] bg-[#171c23] px-2 py-0.5 rounded border border-[#30353d]">
                              SKU: <strong className="text-[#facc15]">{lot.sku}</strong>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8a92a6] mt-1">
                            {lot.productName && (
                              <span className="text-[#dee2ec] font-sans font-medium">
                                {lot.productName}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-[#4cd7f6]" />
                              วันหมดอายุ: <strong className="text-[#dee2ec]">{expDate}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#30353d]/50">
                        <div className="text-right">
                          <span className="text-[10px] text-[#8a92a6] block">จำนวนคงเหลือ</span>
                          <span className="text-base font-bold text-[#57ec7f]">
                            {qty.toLocaleString()} ชิ้น
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#30353d] bg-[#090f15] px-6 py-3 flex items-center justify-between font-mono text-xs text-[#8a92a6]">
            <span>Algorithm: FEFO (First-Expired, First-Out) ISO 9001 / 21 CFR Part 11</span>
            <button
              onClick={onClose}
              className="rounded-lg border border-[#30353d] bg-[#252a32] px-4 py-1.5 text-[#dee2ec] hover:text-[#facc15] transition-colors"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
