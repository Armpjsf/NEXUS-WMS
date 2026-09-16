'use client';

import { TrendingUp, ArrowDownToLine, ArrowUpFromLine, Boxes, DollarSign, AlertOctagon } from 'lucide-react';

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
    <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 bg-[#090f15] p-3 rounded-xl border border-[#30353d]/70 shadow-xl mb-6">
      {/* Card 1: Inbound (จริง) */}
      <div className="bg-[#171c23] p-4 rounded-lg flex flex-col justify-between relative overflow-hidden border border-[#30353d]/40 group hover:border-[#facc15]/50 transition-colors">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#facc15]" />
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-[#d1c6ab] uppercase tracking-wider font-semibold">
            รับเข้า (INBOUND)
          </span>
          <ArrowDownToLine className="w-3.5 h-3.5 text-[#facc15]" />
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl text-[#dee2ec] font-bold tabular-nums">
            {inbound.toLocaleString()}
          </span>
          <span className="font-mono text-xs text-[#d1c6ab]">ชิ้น</span>
        </div>
        <div className="w-full bg-[#252a32] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#facc15] h-full transition-all duration-700 rounded-full" style={{ width: `${inboundShare}%` }} />
        </div>
        <div className="mt-2 text-[#d1c6ab] font-mono text-[10px]">
          {flowTotal > 0 ? `${inboundShare}% ของยอดเคลื่อนไหว` : 'ยังไม่มีรายการเคลื่อนไหว'}
        </div>
      </div>

      {/* Card 2: Outbound (จริง) */}
      <div className="bg-[#171c23] p-4 rounded-lg flex flex-col justify-between relative overflow-hidden border border-[#30353d]/40 group hover:border-[#4cd7f6]/50 transition-colors">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#4cd7f6]" />
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-[#d1c6ab] uppercase tracking-wider font-semibold">
            จ่ายออก (OUTBOUND)
          </span>
          <ArrowUpFromLine className="w-3.5 h-3.5 text-[#4cd7f6]" />
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl text-[#dee2ec] font-bold tabular-nums">
            {outbound.toLocaleString()}
          </span>
          <span className="font-mono text-xs text-[#d1c6ab]">ชิ้น</span>
        </div>
        <div className="w-full bg-[#252a32] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#4cd7f6] h-full transition-all duration-700 rounded-full" style={{ width: `${outboundShare}%` }} />
        </div>
        <div className="mt-2 text-[#d1c6ab] font-mono text-[10px]">
          {flowTotal > 0 ? `${outboundShare}% ของยอดเคลื่อนไหว` : 'ยังไม่มีรายการเคลื่อนไหว'}
        </div>
      </div>

      {/* Card 3: Active SKU (จริง) */}
      <div className="bg-[#171c23] p-4 rounded-lg flex flex-col justify-between relative overflow-hidden border border-[#30353d]/40 group hover:border-[#57ec7f]/50 transition-colors">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#57ec7f]" />
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-[#d1c6ab] uppercase tracking-wider font-semibold">
            SKU ที่มีสต็อก (ACTIVE)
          </span>
          <Boxes className="w-3.5 h-3.5 text-[#57ec7f]" />
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl text-[#dee2ec] font-bold tabular-nums">{activeSku.toLocaleString()}</span>
          <span className="font-mono text-xs text-[#d1c6ab]">/ {totalSku.toLocaleString()} รายการ</span>
        </div>
        <div className="w-full bg-[#252a32] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#57ec7f] h-full rounded-full transition-all duration-700" style={{ width: `${activeShare}%` }} />
        </div>
        <div className="mt-2 text-[#d1c6ab] font-mono text-[10px]">
          {totalSku > 0 ? `${activeShare}% ของสินค้าทั้งหมด` : 'ยังไม่มีสินค้าในระบบ'}
        </div>
      </div>

      {/* Card 4: Stock Value (จริง) */}
      <div className="bg-[#171c23] p-4 rounded-lg flex flex-col justify-between relative overflow-hidden border border-[#30353d]/40 group hover:border-[#eec200]/50 transition-colors">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#eec200]" />
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-[#d1c6ab] uppercase tracking-wider font-semibold">
            มูลค่าสต็อกรวม (VALUE)
          </span>
          <DollarSign className="w-3.5 h-3.5 text-[#eec200]" />
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl text-[#dee2ec] font-bold tabular-nums">
            ฿{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="mt-auto flex items-center gap-1.5 text-[#d1c6ab] font-mono text-[10px]">
          <TrendingUp className="w-3 h-3 text-[#eec200]" />
          <span>คงคลังรวม {totalStock.toLocaleString()} ชิ้น</span>
        </div>
      </div>

      {/* Card 5: Exceptions (จริง) */}
      <div className="bg-[#171c23] p-4 rounded-lg flex flex-col justify-between relative overflow-hidden border border-[#30353d]/40 group hover:border-[#ffb4ab]/50 transition-colors">
        <div className={`absolute top-0 left-0 w-1 h-full ${exceptions > 0 ? 'bg-[#93000a]' : 'bg-[#57ec7f]'}`} />
        <div className="flex items-center justify-between gap-2">
          <span className={`font-mono text-[10px] uppercase tracking-wider font-semibold ${exceptions > 0 ? 'text-[#ffb4ab]' : 'text-[#d1c6ab]'}`}>
            ต้องจัดการ (EXCEPTIONS)
          </span>
          <AlertOctagon className={`w-3.5 h-3.5 ${exceptions > 0 ? 'text-[#ffb4ab]' : 'text-[#57ec7f]'}`} />
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className={`font-mono text-2xl font-bold tabular-nums ${exceptions > 0 ? 'text-[#ffb4ab]' : 'text-[#57ec7f]'}`}>
            {exceptions.toLocaleString()}
          </span>
          <span className="font-mono text-xs text-[#d1c6ab]">รายการ</span>
        </div>
        <div className="mt-auto flex items-center justify-between text-[#d1c6ab] font-mono text-[10px]">
          <span>ใกล้หมด {lowStock.toLocaleString()}</span>
          <span className={outOfStock > 0 ? 'text-[#ffb4ab] font-semibold' : ''}>หมดสต็อก {outOfStock.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
