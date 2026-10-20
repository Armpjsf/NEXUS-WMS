'use client';

import { useState } from 'react';
import { ArrowUpToLine, Scissors, Ban, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RackConfig,
  binCodeFor,
  bayLabel,
  slotState,
  slotSpan,
  mergeSlotUp,
  splitSlot,
  setSlotCode,
  toggleSlotOff,
} from '@/lib/warehouseLayout';

/**
 * Slot-by-slot editor for one rack (bays across, levels up). Click a slot, then
 * merge it with the level above, split it back, rename it or switch it off.
 * Merged slots are drawn as one tall cell.
 */
export default function RackSlotEditor({
  rack,
  onChange,
}: {
  rack: RackConfig;
  onChange: (binOverrides: Record<string, string>) => void;
}) {
  const [sel, setSel] = useState<{ bay: number; level: number } | null>(null);
  // draft code for the selected slot; resets whenever the selection or its code changes
  const [draft, setDraft] = useState<{ key: string; value: string }>({ key: '', value: '' });

  const bays = Math.max(1, Math.floor(rack.bays || 1));
  const levels = Math.max(1, Math.floor(rack.levels || 1));

  // keep the selection on the base of its span and inside the rack
  const selBase = sel && sel.bay <= bays && sel.level <= levels ? { bay: sel.bay, level: slotSpan(rack, sel.bay, sel.level).base } : null;
  const selSpan = selBase ? slotSpan(rack, selBase.bay, selBase.level) : null;
  const selState = selBase ? slotState(rack, selBase.bay, selBase.level) : null;
  const selCode = selBase ? binCodeFor(rack, selBase.bay, selBase.level) : null;

  const draftKey = selBase ? `${selBase.bay}-${selBase.level}-${selCode}` : '';
  const codeDraft = draft.key === draftKey ? draft.value : selCode || '';
  const setCodeDraft = (value: string) => setDraft({ key: draftKey, value });

  const apply = (next: RackConfig) => onChange(next.binOverrides || {});

  const cells: { bay: number; base: number; top: number; state: string; code: string | null }[] = [];
  for (let bay = 1; bay <= bays; bay++) {
    for (let level = 1; level <= levels; level++) {
      const state = slotState(rack, bay, level);
      if (state === 'merged-into-below') continue; // drawn as part of the cell below
      const { top } = slotSpan(rack, bay, level);
      cells.push({ bay, base: level, top, state, code: binCodeFor(rack, bay, level) });
    }
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto pb-1">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${bays}, minmax(2.6rem, 1fr))`,
            gridTemplateRows: `repeat(${levels}, 1.35rem) auto`,
          }}
        >
          {cells.map(c => {
            const isSel = selBase?.bay === c.bay && selBase.level === c.base;
            const merged = c.top > c.base;
            return (
              <button
                key={`${c.bay}-${c.base}`}
                onClick={() => setSel({ bay: c.bay, level: c.base })}
                title={c.code || 'ไม่มีช่อง'}
                style={{ gridColumn: c.bay, gridRow: `${levels - c.top + 1} / span ${c.top - c.base + 1}` }}
                className={cn(
                  'rounded px-0.5 text-[8px] leading-none font-mono font-bold truncate border transition-colors',
                  c.state === 'off'
                    ? 'border-dashed border-[#3a4250] text-[#4b5363] bg-transparent'
                    : merged
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                      : c.state === 'custom'
                        ? 'border-sky-500/50 bg-sky-500/10 text-sky-200'
                        : 'border-[#30353d] bg-[#171c23] text-[#c9d1e0]',
                  isSel && 'ring-2 ring-[#facc15] border-[#facc15]',
                )}
              >
                {c.state === 'off' ? '×' : c.code}
              </button>
            );
          })}
          {Array.from({ length: bays }, (_, i) => (
            <div key={`h${i}`} className="text-center text-[9px] font-mono text-[#8a92a6] pt-0.5" style={{ gridColumn: i + 1, gridRow: levels + 1 }}>
              {bayLabel(rack, i + 1)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[9px] text-[#8a92a6]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/40" />รวมช่อง</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500/40" />ตั้งรหัสเอง</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm border border-dashed border-[#5b6475]" />ปิดช่อง</span>
      </div>

      {selBase && selSpan ? (
        <div className="rounded-lg border border-[#30353d] bg-[#171c23] p-2 space-y-2">
          <div className="text-[10px] text-[#8a92a6]">
            ช่วงเสา <b className="text-[#dee2ec]">{bayLabel(rack, selBase.bay)}</b> • ชั้น{' '}
            <b className="text-[#dee2ec]">{selSpan.top > selSpan.base ? `${selSpan.base}–${selSpan.top}` : selSpan.base}</b>
            {selState === 'off' && <span className="text-rose-400"> • ปิดอยู่</span>}
          </div>

          {selState !== 'off' && (
            <div className="flex gap-1">
              <input
                value={codeDraft}
                onChange={e => setCodeDraft(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') apply(setSlotCode(rack, selBase.bay, selBase.level, codeDraft)); }}
                className="flex-1 min-w-0 bg-[#12161d] border border-[#30353d] rounded-lg px-2 py-1 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                placeholder="รหัสโลเคชัน"
              />
              <button
                onClick={() => apply(setSlotCode(rack, selBase.bay, selBase.level, codeDraft))}
                disabled={codeDraft === (selCode || '')}
                title="ใช้รหัสนี้"
                className="px-2 rounded-lg bg-[#252a32] border border-[#30353d] text-[#57ec7f] disabled:opacity-30"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => apply(mergeSlotUp(rack, selBase.bay, selBase.level))}
              disabled={selState === 'off' || selSpan.top >= levels}
              className="py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex flex-col items-center gap-0.5 disabled:opacity-30"
            >
              <ArrowUpToLine className="w-3.5 h-3.5" /> รวมกับชั้นบน
            </button>
            <button
              onClick={() => apply(splitSlot(rack, selBase.bay, selBase.level))}
              disabled={selState === 'normal'}
              className="py-1.5 rounded-lg bg-[#252a32] border border-[#30353d] text-[#dee2ec] text-[10px] font-bold flex flex-col items-center gap-0.5 disabled:opacity-30"
            >
              <Scissors className="w-3.5 h-3.5" /> {selSpan.top > selSpan.base ? 'แยกช่อง' : 'คืนค่าเดิม'}
            </button>
            <button
              onClick={() => apply(toggleSlotOff(rack, selBase.bay, selBase.level))}
              className="py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-bold flex flex-col items-center gap-0.5"
            >
              <Ban className="w-3.5 h-3.5" /> {selState === 'off' ? 'เปิดช่อง' : 'ปิดช่อง'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-[#8a92a6]">คลิกช่องเพื่อรวม/แยก ตั้งรหัสเอง หรือปิดช่อง</p>
      )}
    </div>
  );
}
