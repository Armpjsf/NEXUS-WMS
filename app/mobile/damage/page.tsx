'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Scan,
  ShieldAlert,
  Camera,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface ProductItem {
  id?: string;
  sku?: string;
  name: string;
  barcode?: string;
  stock?: number;
  unit?: string;
  location?: string;
}

export default function MobileDamagePage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [productUnit, setProductUnit] = useState('ชิ้น');
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('กล่องบุบ / ฉีกขาดระหว่างขนถ่าย');
  const [notes, setNotes] = useState('');
  const [cameraScanOpen, setCameraScanOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/products'), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProducts(data);
      }
    } catch (err) {
      console.warn('Failed to load products for damage report:', err);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const matchProduct = useCallback(
    (code: string) => {
      const clean = code.trim();
      setSku(clean);
      if (!clean) {
        setProductName('');
        setCurrentStock(null);
        return;
      }
      const q = clean.toLowerCase();
      const found = products.find(
        p =>
          (p.sku || '').toLowerCase() === q ||
          (p.id || '').toLowerCase() === q ||
          (p.barcode || '').toLowerCase() === q ||
          (p.name || '').toLowerCase() === q
      );
      if (found) {
        setSku(found.sku || found.id || found.name);
        setProductName(found.name);
        setProductUnit(found.unit || 'ชิ้น');
        setCurrentStock(typeof found.stock === 'number' ? found.stock : null);
        playScannerAudio('success');
      } else {
        setProductName(clean);
        setCurrentStock(null);
      }
    },
    [products]
  );

  const handleScan = (code: string) => {
    matchProduct(code);
    setCameraScanOpen(false);
  };

  usePdaScanner({
    onScan: handleScan,
    enabled: !cameraScanOpen && !success,
    playSound: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      toast.error('กรุณาระบุ SKU หรือสแกนบาร์โค้ด');
      return;
    }

    setSubmitting(true);
    try {
      const reporter = session?.user?.name || 'Mobile Staff';
      const resolvedName = productName.trim() || sku.trim();

      const res = await fetch(getApiUrl('/api/damage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: sku.trim(),
          product_name: resolvedName,
          quantity: Number(qty),
          unit: productUnit || 'ชิ้น',
          reason,
          notes: notes.trim(),
          reporter,
          reported_by: reporter,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'บันทึกแจ้งสินค้าชำรุดไม่สำเร็จ');
      }

      toast.success('บันทึกแจ้งสินค้าชำรุดเรียบร้อย');
      setSuccess(true);
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  const suggestions = sku.trim()
    ? products
        .filter(p => {
          const q = sku.toLowerCase();
          return (
            ((p.name || '').toLowerCase().includes(q) ||
              (p.sku || '').toLowerCase().includes(q) ||
              (p.id || '').toLowerCase().includes(q)) &&
            (p.sku || p.id || p.name) !== sku
          );
        })
        .slice(0, 5)
    : [];

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
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>แจ้งสินค้าชำรุด (Damage)</span>
        </h1>
        <button
          type="button"
          onClick={loadProducts}
          className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white active:scale-95"
          title="รีเฟรชรายการสินค้า"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <div className="p-4">
        {success ? (
          <div className="mt-8 p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl text-center space-y-3 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="w-12 h-12 text-rose-400 mx-auto" />
            <div className="font-bold text-base text-rose-300">บันทึกสินค้าชำรุดเรียบร้อย</div>
            <p className="text-xs text-slate-300">
              บันทึก <strong className="text-white">{productName || sku}</strong> จำนวน{' '}
              <strong className="text-rose-300">{qty} {productUnit}</strong> เข้าสู่ระบบรายการของเสีย (Damage Records) เพื่อรอหัวหน้าคลังอนุมัติแล้ว
            </p>
            <button
              onClick={() => {
                setSuccess(false);
                setSku('');
                setProductName('');
                setCurrentStock(null);
                setQty(1);
                setNotes('');
              }}
              className="mt-4 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white transition-colors"
            >
              แจ้งชำรุดรายการอื่นต่อ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* SKU / Barcode */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                สแกนบาร์โค้ด หรือ ระบุ SKU / ชื่อสินค้า *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="เช่น SKU-001 หรือพิมพ์ชื่อสินค้า"
                  value={sku}
                  onChange={e => matchProduct(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-mono text-white focus:outline-none focus:border-rose-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCameraScanOpen(true)}
                  className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="mt-1.5 bg-slate-800 border border-slate-700 rounded-2xl divide-y divide-slate-700/60 overflow-hidden">
                  {suggestions.map(item => (
                    <button
                      key={item.id || item.sku || item.name}
                      type="button"
                      onClick={() => {
                        setSku(item.sku || item.id || item.name);
                        setProductName(item.name);
                        setProductUnit(item.unit || 'ชิ้น');
                        setCurrentStock(typeof item.stock === 'number' ? item.stock : null);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-700/60 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-white truncate">{item.name}</span>
                      <span className="font-mono text-slate-400 shrink-0 ml-2">
                        {item.sku || item.id} ({item.stock ?? 0} {item.unit || 'ชิ้น'})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {productName && (
              <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px]">ชื่อสินค้าในระบบ:</span>
                  <span className="font-bold text-white text-sm">{productName}</span>
                </div>
                {currentStock !== null && (
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">คงเหลือ:</span>
                    <span className="font-mono font-bold text-rose-300">
                      {currentStock} {productUnit}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                จำนวนชิ้นที่ชำรุด ({productUnit}) *
              </label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-base font-bold text-white text-center focus:outline-none focus:border-rose-400"
                required
              />
            </div>

            {/* Damage Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                ประเภทความเสียหาย / สาเหตุ *
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-semibold text-white focus:outline-none"
              >
                <option value="กล่องบุบ / ฉีกขาดระหว่างขนถ่าย">กล่องบุบ / ฉีกขาดระหว่างขนถ่าย</option>
                <option value="สินค้าแตกหัก / แตกหักจากตกหล่น">สินค้าแตกหัก / ตกหล่น</option>
                <option value="เปียกน้ำ / ความชื้น">เปียกน้ำ / ความชื้น</option>
                <option value="หมดอายุคาชั้นวาง">หมดอายุคาชั้นวาง</option>
                <option value="บรรจุภัณฑ์ซีลเปิด / เสียสภาพ">บรรจุภัณฑ์ซีลเปิด / เสียสภาพ</option>
                <option value="อื่นๆ (ระบุในหมายเหตุ)">อื่นๆ (ระบุในหมายเหตุ)</option>
              </select>
            </div>

            {/* Photo attach placeholder */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                ถ่ายภาพหลักฐานสินค้าชำรุด (Photo Proof)
              </label>
              <button
                type="button"
                onClick={() => toast.success('พร้อมแนบภาพถ่ายหลักฐานความเสียหาย')}
                className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-white transition-colors"
              >
                <Camera className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-medium">แตะเพื่อถ่ายรูปด้วยกล้องมือถือ</span>
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                หมายเหตุเพิ่มเติม
              </label>
              <input
                type="text"
                placeholder="เช่น พบตอนจัดเก็บโซน A-02"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!sku.trim() || submitting}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-rose-600/25 active:scale-98 disabled:opacity-50 transition-all mt-4"
            >
              {submitting ? 'กำลังบันทึก...' : 'บันทึกแจ้งสินค้าชำรุด'}
            </button>
          </form>
        )}
      </div>

      {cameraScanOpen && (
        <CameraScannerModal
          isOpen={cameraScanOpen}
          onClose={() => setCameraScanOpen(false)}
          onScan={handleScan}
        />
      )}

      <MobileNav />
    </div>
  );
}
