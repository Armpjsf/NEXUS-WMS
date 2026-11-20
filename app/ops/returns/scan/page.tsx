'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ScanBarcode,
  ArrowLeft,
  ShieldAlert,
  PackageCheck,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  AlertTriangle,
  Boxes,
} from 'lucide-react';
import { errorMessage } from '@/lib/errors';

interface RmaLine {
  sku: string;
  name: string;
  qty: number;
}

interface ReturnRecord {
  id: string;
  rmaNo: string;
  orderNo: string;
  customerName: string;
  reason: string;
  status: string;
  disposition: string;
  items: RmaLine[];
  createdBy: string;
  notes: string;
  createdAt: string;
}

export default function ReturnsScanPage() {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundRma, setFoundRma] = useState<ReturnRecord | null>(null);
  const [processing, setProcessing] = useState(false);
  const [targetBin, setTargetBin] = useState('QUARANTINE-01');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (codeToSearch?: string) => {
    const query = (codeToSearch || barcode).trim();
    if (!query) {
      toast.error('กรุณาสแกนหรือกรอกเลขที่บาร์โค้ด');
      return;
    }

    setLoading(true);
    setFoundRma(null);
    try {
      const res = await fetch('/api/returns', { cache: 'no-store' });
      const json = await res.json();
      const returns: ReturnRecord[] = json.returns || [];

      // Match by RMA No, Order No, or Notes
      const qUpper = query.toUpperCase();
      let match = returns.find(
        r =>
          r.rmaNo.toUpperCase() === qUpper ||
          r.orderNo.toUpperCase() === qUpper ||
          r.rmaNo.toUpperCase().includes(qUpper) ||
          r.orderNo.toUpperCase().includes(qUpper)
      );

      // If not in returns, check if it's an outbound order with damage to auto-create RMA
      if (!match) {
        const ordRes = await fetch(`/api/orders?status=ALL`, { cache: 'no-store' });
        const ordJson = await ordRes.json();
        const orders = ordJson.orders || [];
        const ordMatch = orders.find(
          (o: any) =>
            o.orderNo.toUpperCase() === qUpper ||
            (o.trackingNo && o.trackingNo.toUpperCase() === qUpper) ||
            (o.tmsJobId && o.tmsJobId.toUpperCase() === qUpper)
        );

        if (ordMatch) {
          // Auto create return draft for this damaged order
          const createRes = await fetch('/api/returns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderNo: ordMatch.orderNo,
              customerName: ordMatch.customerName,
              reason: ordMatch.podNote || 'รับคืนสินค้าจากจุดส่ง (สแกนรับหน้า Dock)',
              items: ordMatch.items?.map((it: any) => ({ sku: it.sku, name: it.name, qty: it.qty })) || [],
              notes: `ตรวจรับที่หน้าคลัง (คนขับ: ${ordMatch.driverName || '-'}, ทะเบียน: ${ordMatch.vehiclePlate || '-'})`,
            }),
          });
          const createdJson = await createRes.json();
          if (createdJson.rma) {
            match = createdJson.rma;
            toast.success(`พบออเดอร์ ${ordMatch.orderNo} สร้างใบรับคืน ${match?.rmaNo} อัตโนมัติ`);
          }
        }
      }

      if (!match) {
        toast.error(`ไม่พบข้อมูลใบคืนสำหรับรหัส "${query}"`);
      } else {
        setFoundRma(match);
        toast.success(`พบใบคืนสินค้า: ${match.rmaNo}`);
      }
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setLoading(false);
      setBarcode('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const executeDisposition = async (disposition: 'QUARANTINE' | 'RESTOCK' | 'SCRAP') => {
    if (!foundRma) return;
    setProcessing(true);
    const t = toast.loading('กำลังบันทึกและปรับปรุงสถานะคลังสินค้า...');
    try {
      const patchBody: any = { id: foundRma.id };

      if (disposition === 'QUARANTINE') {
        patchBody.status = 'RECEIVED';
        patchBody.disposition = 'QUARANTINE';
        patchBody.notes = `${foundRma.notes || ''} [เข้าพิกัดกักกัน: ${targetBin}]`.trim();
      } else if (disposition === 'RESTOCK') {
        patchBody.status = 'RESTOCKED';
        patchBody.disposition = 'RESTOCK';
      } else if (disposition === 'SCRAP') {
        patchBody.status = 'SCRAPPED';
        patchBody.disposition = 'SCRAP';
      }

      const res = await fetch('/api/returns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');

      toast.success(
        disposition === 'QUARANTINE'
          ? `รับสินค้าเข้าพื้นที่กักกัน (${targetBin}) สำเร็จ`
          : disposition === 'RESTOCK'
          ? 'คืนสินค้าเข้าสต็อกพร้อมขายเรียบร้อย'
          : 'บันทึกตัดทิ้งทำลายสินค้าชำรุดเรียบร้อย',
        { id: t }
      );

      setFoundRma(null);
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาด', { id: t });
    } finally {
      setProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative overflow-hidden text-slate-900">
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        <Link
          href="/ops/returns"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> กลับไปจัดการของคืน (Returns / RMA)
        </Link>

        {/* Open Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Quarantine Receiving
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <ScanBarcode className="w-7 h-7 text-amber-600 shrink-0" />
              <span>สแกนตรวจรับของคืนหน้าคลัง (Quarantine Receiving)</span>
            </h1>
            <p className="text-slate-600 font-medium text-xs sm:text-sm mt-0.5">
              สแกนบาร์โค้ด RMA / Order / พัสดุ เพื่อตรวจนับและแยกเข้าพื้นที่กักกัน หรือคืนสต็อก
            </p>
          </div>
          <span className="px-3.5 py-1.5 rounded-full bg-white/80 border border-white/90 text-xs font-semibold text-slate-700 shadow-xs w-fit">
            ระบบทำงานแยกอิสระ (Standalone) รองรับทุกช่องทางคืน
          </span>
        </div>

        {/* Scan Barcode Form */}
        <div className="nx-dark-accent-card p-6 space-y-4">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleScan();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="สแกนบาร์โค้ด หรือพิมพ์เลข RMA / เลขออเดอร์..."
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-white/10 border border-amber-400/40 text-white placeholder:text-slate-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-400 focus:bg-white/15"
              />
              <ScanBarcode className="w-5 h-5 text-amber-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3.5 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>ค้นหา</span>
            </button>
          </form>

          <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
            <span className="font-semibold text-slate-400">ตัวอย่าง:</span>
            <button
              onClick={() => handleScan('RMA-261028-001')}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 font-mono text-amber-300 transition-colors"
            >
              RMA-261028-001
            </button>
            <button
              onClick={() => handleScan('ORD-261027-001')}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 font-mono text-amber-300 transition-colors"
            >
              ORD-261027-001
            </button>
          </div>
        </div>

        {/* Found Return Details & Actions */}
        <AnimatePresence mode="wait">
          {foundRma && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="nx-glass-card p-6 sm:p-8 space-y-6"
            >
              {/* Header Info */}
              <div className="flex justify-between items-start flex-wrap gap-4 border-b border-slate-200/80 pb-5">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                      {foundRma.rmaNo}
                    </span>
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/25">
                      สถานะ: {foundRma.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1.5">
                    อ้างอิงออเดอร์: <b className="font-mono text-slate-900">{foundRma.orderNo || '-'}</b> · ลูกค้า: <b className="text-slate-900">{foundRma.customerName || '-'}</b>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500 tabular-nums">
                  <div>บันทึกเมื่อ: {new Date(foundRma.createdAt).toLocaleString('th-TH')}</div>
                  <div>ผู้บันทึก: {foundRma.createdBy}</div>
                </div>
              </div>

              {/* Reason / Incident Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/12 border border-amber-500/25 text-amber-900 text-xs sm:text-sm space-y-1">
                <div className="font-bold flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>สาเหตุการส่งคืน / รายงานความเสียหาย:</span>
                </div>
                <div className="pl-6">{foundRma.reason || 'ไม่มีระบุสาเหตุ'}</div>
                {foundRma.notes && <div className="pl-6 text-xs text-amber-800"><b>หมายเหตุเพิ่มเติม:</b> {foundRma.notes}</div>}
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-amber-600" />
                  <span className="tabular-nums">รายการสินค้าที่ต้องตรวจนับ ({foundRma.items?.length || 0} รายการ)</span>
                </div>
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white/80">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50/90 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200/80">
                      <tr>
                        <th className="py-3 px-4">รหัสสินค้า (SKU)</th>
                        <th className="py-3 px-4">ชื่อสินค้า</th>
                        <th className="py-3 px-4 text-right">จำนวนที่ส่งคืน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {foundRma.items?.map((it, idx) => (
                        <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{it.sku}</td>
                          <td className="py-3 px-4 text-slate-800 font-medium">{it.name || '-'}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 text-sm tabular-nums">
                            {it.qty} ชิ้น
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Target Quarantine Location Selection */}
              <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs">
                  <b className="text-slate-900">พิกัดจัดเก็บกักกัน (Quarantine Bin):</b>
                  <p className="text-slate-500 text-[11px]">สินค้าที่มีปัญหานี้จะถูกแยกออกจากสต็อกขายได้ทันที</p>
                </div>
                <select
                  value={targetBin}
                  onChange={e => setTargetBin(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-amber-800 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="QUARANTINE-01">QUARANTINE-01 (โซนกักกันหลัก)</option>
                  <option value="QUARANTINE-02">QUARANTINE-02 (โซนสินค้าแตกหัก)</option>
                  <option value="RETURNS-DOCK">RETURNS-DOCK (ท่ารับรอคัดแยก)</option>
                  <option value="SCRAP-HOLD">SCRAP-HOLD (รอตัดจำหน่าย)</option>
                </select>
              </div>

              {/* Disposition Action Buttons */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-600 uppercase">
                  เลือกผลการตรวจรับทางกายภาพหน้าคลัง (Physical Disposition):
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Action 1: Receive into Quarantine */}
                  <button
                    onClick={() => executeDisposition('QUARANTINE')}
                    disabled={processing}
                    className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-left space-y-1 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <ShieldAlert className="w-5 h-5" />
                      <span>รับเข้าพื้นที่กักกัน</span>
                    </div>
                    <p className="text-[11px] text-amber-50 opacity-95 leading-tight">
                      ชำรุด/มีปัญหา แยกเข้าพิกัด {targetBin} เพื่อรอเคลม
                    </p>
                  </button>

                  {/* Action 2: Restock sellable */}
                  <button
                    onClick={() => executeDisposition('RESTOCK')}
                    disabled={processing}
                    className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-left space-y-1 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <PackageCheck className="w-5 h-5" />
                      <span>คืนสต็อกพร้อมขาย</span>
                    </div>
                    <p className="text-[11px] text-emerald-50 opacity-95 leading-tight">
                      สินค้าสภาพสมบูรณ์ เพิ่มยอดสต็อกและปิดใบคืน
                    </p>
                  </button>

                  {/* Action 3: Scrap */}
                  <button
                    onClick={() => executeDisposition('SCRAP')}
                    disabled={processing}
                    className="p-4 rounded-2xl bg-white hover:bg-rose-50 border border-rose-200 hover:border-rose-400 text-rose-700 text-left space-y-1 shadow-xs active:scale-95 transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Trash2 className="w-5 h-5 text-rose-600" />
                      <span>ตัดทำลาย / ทิ้ง</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      เสียหายสิ้นเชิง ตัดจำหน่ายเป็น Scrap ทันที
                    </p>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
