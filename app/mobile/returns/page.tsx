'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Scan,
  RotateCcw,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface ProductLookup {
  id?: string;
  sku?: string;
  name: string;
  barcode?: string;
  unit?: string;
}

interface OrderLookup {
  id: string;
  orderNo: string;
  customerName?: string;
  items?: { sku: string; name: string; qty: number }[];
}

export default function MobileReturnsPage() {
  const [products, setProducts] = useState<ProductLookup[]>([]);
  const [orders, setOrders] = useState<OrderLookup[]>([]);
  const [returnNo, setReturnNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState(1);
  const [condition, setCondition] = useState<'RESTOCK' | 'QUARANTINE' | 'SCRAP'>('RESTOCK');
  const [immediateRestock, setImmediateRestock] = useState(true);
  const [notes, setNotes] = useState('');
  const [cameraTarget, setCameraTarget] = useState<'ORDER' | 'SKU' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdRmaNo, setCreatedRmaNo] = useState('');
  const [finalStatus, setFinalStatus] = useState<'RESTOCKED' | 'RECEIVED'>('RESTOCKED');
  const [success, setSuccess] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [prodRes, ordRes] = await Promise.all([
        fetch(getApiUrl('/api/products'), { cache: 'no-store' }),
        fetch(getApiUrl('/api/orders'), { cache: 'no-store' }),
      ]);
      if (prodRes.ok) {
        const pData = await prodRes.json();
        if (Array.isArray(pData)) setProducts(pData);
      }
      if (ordRes.ok) {
        const oData = await ordRes.json();
        if (Array.isArray(oData.orders)) setOrders(oData.orders);
      }
    } catch (err) {
      console.warn('Failed to load returns lookup data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOrderChange = (val: string) => {
    setReturnNo(val);
    const q = val.trim().toLowerCase();
    const matchedOrder = orders.find(o => o.orderNo?.toLowerCase() === q);
    if (matchedOrder) {
      if (matchedOrder.customerName) setCustomerName(matchedOrder.customerName);
      if (matchedOrder.items && matchedOrder.items.length > 0 && !sku) {
        setSku(matchedOrder.items[0].sku);
        setProductName(matchedOrder.items[0].name || matchedOrder.items[0].sku);
      }
    }
  };

  const handleSkuChange = (val: string) => {
    setSku(val);
    const q = val.trim().toLowerCase();
    const matchedProd = products.find(
      p =>
        (p.sku || '').toLowerCase() === q ||
        (p.id || '').toLowerCase() === q ||
        (p.barcode || '').toLowerCase() === q ||
        (p.name || '').toLowerCase() === q
    );
    if (matchedProd) {
      setSku(matchedProd.sku || matchedProd.id || matchedProd.name);
      setProductName(matchedProd.name);
    } else {
      setProductName(val.trim());
    }
  };

  const handleScan = (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    playScannerAudio('success');
    if (cameraTarget === 'ORDER' || (!returnNo && !cameraTarget)) {
      handleOrderChange(clean);
    } else {
      handleSkuChange(clean);
    }
    setCameraTarget(null);
  };

  usePdaScanner({
    onScan: handleScan,
    enabled: !cameraTarget && !success,
    playSound: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnNo.trim()) {
      toast.error('กรุณาระบุเลขที่ใบส่งสินค้า / ออเดอร์ที่รับคืน');
      return;
    }
    const itemSku = sku.trim() || 'RETURN-ITEM';
    const itemName = productName.trim() || itemSku;
    const itemReason =
      notes.trim() ||
      (condition === 'RESTOCK'
        ? 'สภาพดี รับคืนเข้าสต็อก'
        : condition === 'QUARANTINE'
          ? 'มีตำหนิ รอตรวจสอบกักกัน'
          : 'ชำรุด รอเคลม/ทำลาย');

    setSubmitting(true);
    try {
      const createRes = await fetch(getApiUrl('/api/returns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: returnNo.trim(),
          orderNo: returnNo.trim(),
          customerName: customerName.trim() || 'ลูกค้าทั่วไป',
          reason: itemReason,
          disposition: condition,
          notes: notes.trim(),
          items: [
            {
              sku: itemSku,
              name: itemName,
              qty: Number(qty) || 1,
              reason: itemReason,
            },
          ],
        }),
      });

      const createJson = await createRes.json();
      if (!createRes.ok || !createJson.rma) {
        throw new Error(createJson.error || 'สร้างใบรับคืน RMA ไม่สำเร็จ');
      }

      const rma = createJson.rma;
      const targetStatus: 'RESTOCKED' | 'RECEIVED' =
        condition === 'RESTOCK' && immediateRestock ? 'RESTOCKED' : 'RECEIVED';

      const patchRes = await fetch(getApiUrl('/api/returns'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rma.id,
          status: targetStatus,
          disposition: condition,
          notes: notes.trim(),
        }),
      });

      if (!patchRes.ok) {
        const patchErr = await patchRes.json().catch(() => ({}));
        throw new Error(patchErr.error || 'อัปเดตสถานะใบรับคืนไม่สำเร็จ');
      }

      setCreatedRmaNo(rma.rmaNo || rma.id);
      setFinalStatus(targetStatus);
      toast.success(`บันทึกใบรับคืน ${rma.rmaNo || ''} สำเร็จ!`);
      setSuccess(true);
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการบันทึกรับคืน');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-28 max-w-md mx-auto font-sans select-none">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#171c23] px-4 py-3 border-b border-slate-800 shadow-lg flex items-center justify-between">
        <Link
          href="/mobile"
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-bold tracking-wide flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4 text-purple-400" />
          <span>รับคืนสินค้า (RMA Returns)</span>
        </h1>
        <button
          type="button"
          onClick={loadData}
          className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white active:scale-95"
          title="รีเฟรชข้อมูล"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <div className="p-4">
        {success ? (
          <div className="mt-8 p-6 bg-purple-500/10 border border-purple-500/30 rounded-3xl text-center space-y-3 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="w-12 h-12 text-purple-400 mx-auto" />
            <div className="font-bold text-base text-purple-300">
              รับคืนสินค้าเรียบร้อย! ({createdRmaNo})
            </div>
            <p className="text-xs text-slate-300">
              {finalStatus === 'RESTOCKED'
                ? `สินค้า ${productName || sku || 'ตามใบรับคืน'} จำนวน ${qty} ชิ้น ถูกนำกลับเข้าสต็อกพร้อมจำหน่าย (RESTOCKED) แล้ว`
                : `บันทึกสถานะรับของคืนเข้าคลัง (RECEIVED - ${condition}) เพื่อรอตรวจสอบคุณภาพเรียบร้อยแล้ว`}
            </p>
            <button
              onClick={() => {
                setSuccess(false);
                setReturnNo('');
                setCustomerName('');
                setSku('');
                setProductName('');
                setQty(1);
                setNotes('');
                setCreatedRmaNo('');
              }}
              className="mt-4 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold text-white transition-colors"
            >
              รับคืนรายการถัดไป
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                เลขที่ใบส่งสินค้า / ออเดอร์ที่รับคืน *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="เช่น ORD-20260910-001"
                  value={returnNo}
                  onChange={e => handleOrderChange(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-mono text-white focus:outline-none focus:border-purple-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCameraTarget('ORDER')}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                ชื่อลูกค้า (Customer)
              </label>
              <input
                type="text"
                placeholder="ชื่อลูกค้า หรือร้านค้า"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                SKU / บาร์โค้ดสินค้าที่รับคืน *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="SKU-001 หรือสแกนบาร์โค้ด"
                  value={sku}
                  onChange={e => handleSkuChange(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-mono text-white focus:outline-none focus:border-purple-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCameraTarget('SKU')}
                  className="px-4 py-3 bg-slate-800 border border-slate-700 hover:border-purple-400 text-purple-300 rounded-2xl flex items-center justify-center active:scale-95"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>
              {productName && (
                <p className="text-xs text-purple-300 mt-1.5 px-1">
                  สินค้า: <strong>{productName}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                จำนวนชิ้นที่รับคืน *
              </label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-base font-bold text-white text-center focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                ผลการตรวจสภาพสินค้า (Disposition) *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCondition('RESTOCK')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                    condition === 'RESTOCK'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  สภาพดี (เติมสต็อก)
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('QUARANTINE')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                    condition === 'QUARANTINE'
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  มีตำหนิ (กักกัน)
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('SCRAP')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                    condition === 'SCRAP'
                      ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  ชำรุด (ทิ้ง/เคลม)
                </button>
              </div>
            </div>

            {condition === 'RESTOCK' && (
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">การจัดการสต็อกเมื่อรับคืน</div>
                  <div className="text-[11px] text-slate-400">
                    {immediateRestock
                      ? 'เติมกลับเข้าสต็อกพร้อมขายทันที (RESTOCKED)'
                      : 'พักไว้สถานะรับของคืนเพื่อรอตรวจสอบ (RECEIVED)'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImmediateRestock(v => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                    immediateRestock
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-700 text-slate-300 border-slate-600'
                  }`}
                >
                  {immediateRestock ? 'เติมสต็อกทันที' : 'รอตรวจ QC ก่อน'}
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                เหตุผลการคืน / หมายเหตุ
              </label>
              <input
                type="text"
                placeholder="เช่น ลูกค้าสั่งผิดไซส์, เปลี่ยนใจ"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!returnNo.trim() || !sku.trim() || submitting}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-purple-600/25 active:scale-98 disabled:opacity-50 transition-all mt-4"
            >
              {submitting ? 'กำลังบันทึก...' : 'ยืนยันการรับคืนสินค้า'}
            </button>
          </form>
        )}
      </div>

      {cameraTarget && (
        <CameraScannerModal
          isOpen={!!cameraTarget}
          onClose={() => setCameraTarget(null)}
          onScan={handleScan}
          title={cameraTarget === 'ORDER' ? 'สแกนเลขใบส่งของ / Order' : 'สแกนบาร์โค้ดสินค้า (SKU)'}
        />
      )}

      <MobileNav />
    </div>
  );
}
