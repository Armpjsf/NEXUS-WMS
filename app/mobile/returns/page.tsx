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
    <div className="theme-nexus-hybrid min-h-screen text-slate-900 pb-28 font-sans select-none">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl px-4 py-3 border-b border-white/85 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <Link
            href="/mobile"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold tracking-wide flex items-center gap-2 text-slate-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-700">
              <RotateCcw className="w-4 h-4" />
            </span>
            <span>รับคืนสินค้า (RMA Returns)</span>
          </h1>
          <button
            type="button"
            onClick={loadData}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-600 hover:text-slate-900 shadow-xs active:scale-95 transition-all"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-4 max-w-md mx-auto">
        {success ? (
          <div className="nx-glass-card mt-6 p-6 border-2 border-emerald-200 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="font-bold text-base text-slate-900 tabular-nums">
              รับคืนสินค้าเรียบร้อย! ({createdRmaNo})
            </div>
            <p className="text-xs text-slate-600 leading-relaxed tabular-nums">
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
              className="mt-4 min-h-[44px] px-6 py-3 bg-slate-900 hover:bg-slate-800 rounded-full text-xs font-bold text-white transition-all shadow-sm active:scale-95"
            >
              รับคืนรายการถัดไป
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="nx-glass-card p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                เลขที่ใบส่งสินค้า / ออเดอร์ที่รับคืน *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="เช่น ORD-20260910-001"
                  value={returnNo}
                  onChange={e => handleOrderChange(e.target.value)}
                  className="flex-1 min-h-[44px] px-4 py-3 bg-white/90 border border-slate-200/80 rounded-2xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCameraTarget('ORDER')}
                  className="min-h-[44px] min-w-[48px] px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-xs"
                  aria-label="สแกนเลขใบส่งสินค้า"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ชื่อลูกค้า (Customer)
              </label>
              <input
                type="text"
                placeholder="ชื่อลูกค้า หรือร้านค้า"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full min-h-[44px] px-4 py-3 bg-white/90 border border-slate-200/80 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                SKU / บาร์โค้ดสินค้าที่รับคืน *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="SKU-001 หรือสแกนบาร์โค้ด"
                  value={sku}
                  onChange={e => handleSkuChange(e.target.value)}
                  className="flex-1 min-h-[44px] px-4 py-3 bg-white/90 border border-slate-200/80 rounded-2xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCameraTarget('SKU')}
                  className="min-h-[44px] min-w-[48px] px-4 py-3 bg-white/90 border border-slate-200 hover:border-emerald-500 text-slate-700 rounded-full flex items-center justify-center active:scale-95 shadow-xs"
                  aria-label="สแกน SKU"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>
              {productName && (
                <div className="mt-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-xs text-sky-800 inline-block">
                  สินค้า: <strong className="font-bold">{productName}</strong>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                จำนวนชิ้นที่รับคืน *
              </label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                className="w-full min-h-[48px] px-4 py-3 bg-white/90 border border-slate-200/80 rounded-2xl text-base font-bold font-mono text-slate-900 text-center tabular-nums focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ผลการตรวจสภาพสินค้า (Disposition) *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCondition('RESTOCK')}
                  className={`min-h-[44px] p-2.5 rounded-full border text-xs font-bold transition-all ${
                    condition === 'RESTOCK'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-xs'
                      : 'bg-white/90 border-slate-200 text-slate-600'
                  }`}
                >
                  สภาพดี (เติมสต็อก)
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('QUARANTINE')}
                  className={`min-h-[44px] p-2.5 rounded-full border text-xs font-bold transition-all ${
                    condition === 'QUARANTINE'
                      ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-xs'
                      : 'bg-white/90 border-slate-200 text-slate-600'
                  }`}
                >
                  มีตำหนิ (กักกัน)
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('SCRAP')}
                  className={`min-h-[44px] p-2.5 rounded-full border text-xs font-bold transition-all ${
                    condition === 'SCRAP'
                      ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-xs'
                      : 'bg-white/90 border-slate-200 text-slate-600'
                  }`}
                >
                  ชำรุด (ทิ้ง/เคลม)
                </button>
              </div>
            </div>

            {condition === 'RESTOCK' && (
              <div className="p-3.5 rounded-2xl bg-white/90 border border-slate-200/80 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900">การจัดการสต็อกเมื่อรับคืน</div>
                  <div className="text-[11px] text-slate-600">
                    {immediateRestock
                      ? 'เติมกลับเข้าสต็อกพร้อมขายทันที (RESTOCKED)'
                      : 'พักไว้สถานะรับของคืนเพื่อรอตรวจสอบ (RECEIVED)'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImmediateRestock(v => !v)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 ${
                    immediateRestock
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {immediateRestock ? 'เติมสต็อกทันที' : 'รอตรวจ QC ก่อน'}
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                เหตุผลการคืน / หมายเหตุ
              </label>
              <input
                type="text"
                placeholder="เช่น ลูกค้าสั่งผิดไซส์, เปลี่ยนใจ"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full min-h-[44px] px-4 py-3 bg-white/90 border border-slate-200/80 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={!returnNo.trim() || !sku.trim() || submitting}
              className="w-full min-h-[48px] py-3.5 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50 transition-all mt-2"
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
