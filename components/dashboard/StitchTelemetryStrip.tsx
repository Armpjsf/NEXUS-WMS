'use client';

import { ArrowDownToLine, ArrowUpFromLine, Boxes, DollarSign, AlertOctagon } from 'lucide-react';

interface StitchTelemetryStripProps {
  summary?: any;
}

/**
 * แถบสรุปสถานะด้านบน — ใช้ตัวเลขจริงจาก /api/dashboard เท่านั้น
 * (ไม่มีค่า mock/hardcode; ช่องที่ยังไม่มีข้อมูลจะแสดง 0 ตามจริง)
 */
export default function StitchTelemetryStrip({ summary }: StitchTelemetryStripProps) {
  const inbound = Number(summary?.inboundPeriod || 0);
  const outbound = Number(summary?.outboundPeriod || 0);
  const flowTotal = inbound + outbound;
  const inboundShare = flowTotal > 0 ? Math.round((inbound / flowTotal) * 100) : 0;
  const outboundShare = flowTotal > 0 ? 100 - inboundShare : 0;

  const activeSku = Number(summary?.activeSkuCount || 0);
  const totalSku = Number(summary?.totalSkus || 0);
  const activeShare = totalSku > 0 ? Math.round((activeSku / totalSku) * 100) : 0;

  const totalValue = Number(summary?.totalValue || 0);
  const totalStock = Number(summary?.totalStock || 0);

  const lowStock = Number(summary?.lowStockCount || 0);
  const outOfStock = Number(summary?.outOfStockCount || 0);
  const exceptions = lowStock + outOfStock;

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Inbound */}
      <div className="nx-glass-card p-5 flex flex-col justify-between gap-3 transition-all hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">
            รับเข้า (Inbound)
          </span>
          <ArrowDownToLine className="w-4 h-4 text-emerald-600 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl text-slate-900 font-bold tabular-nums tracking-tight">
            {inbound.toLocaleString()}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-700 border border-emerald-500/20 tabular-nums shrink-0">
            {flowTotal > 0 ? `${inboundShare}% flow` : '0 ชิ้น'}
          </span>
        </div>
      </div>

      {/* 2. Outbound */}
      <div className="nx-glass-card p-5 flex flex-col justify-between gap-3 transition-all hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">
            จ่ายออก (Outbound)
          </span>
          <ArrowUpFromLine className="w-4 h-4 text-sky-600 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl text-slate-900 font-bold tabular-nums tracking-tight">
            {outbound.toLocaleString()}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/12 text-sky-700 border border-sky-500/20 tabular-nums shrink-0">
            {flowTotal > 0 ? `${outboundShare}% flow` : '0 ชิ้น'}
          </span>
        </div>
      </div>

      {/* 3. Active SKU */}
      <div className="nx-glass-card p-5 flex flex-col justify-between gap-3 transition-all hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">
            Active SKUs
          </span>
          <Boxes className="w-4 h-4 text-amber-600 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl text-slate-900 font-bold tabular-nums tracking-tight">
            {activeSku.toLocaleString()}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/12 text-amber-700 border border-amber-500/20 tabular-nums shrink-0">
            {activeShare}% / {totalSku.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 4. Stock Units / Value */}
      <div className="nx-glass-card p-5 flex flex-col justify-between gap-3 transition-all hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">
            คงคลังรวม (On-Hand)
          </span>
          <DollarSign className="w-4 h-4 text-emerald-700 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl text-slate-900 font-bold tabular-nums tracking-tight">
            {totalStock.toLocaleString()}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900/8 text-slate-700 border border-slate-900/10 tabular-nums shrink-0">
            ฿{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* 5. Exceptions */}
      <div className="nx-glass-card p-5 flex flex-col justify-between gap-3 transition-all hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">
            Exceptions
          </span>
          <AlertOctagon className={`w-4 h-4 shrink-0 ${exceptions > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-2xl font-bold tabular-nums tracking-tight ${exceptions > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {exceptions.toLocaleString()}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums shrink-0 ${
            exceptions > 0
              ? 'bg-rose-500/12 text-rose-700 border-rose-500/20'
              : 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20'
          }`}>
            {exceptions > 0 ? `Low ${lowStock} · Out ${outOfStock}` : 'Healthy'}
          </span>
        </div>
      </div>
    </div>
  );
}
