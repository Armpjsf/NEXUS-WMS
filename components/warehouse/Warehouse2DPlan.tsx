'use client';

import { useMemo } from 'react';
import { MapPin, Sparkles, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WarehouseLayout, RackConfig, binCodeFor } from '@/lib/warehouseLayout';
import { WarehouseMapData, MapBin, MapRack } from '@/lib/warehouseMap';

type Heatmap = 'STOCK' | 'VELOCITY';

interface Props {
  layout: WarehouseLayout;
  map: WarehouseMapData;
  heatmapMode: Heatmap;
  matchingBinCodes: Set<string>;
  zoneFilter: string; // 'ALL' or a zone code
  selectedRackCode: string | null;
  onSelectRack: (rackCode: string | null) => void;
  onSelectBin: (bin: MapBin) => void;
}

const STOCK_FILL = { NORMAL: '#10b981', LOW_STOCK: '#f59e0b', EMPTY: '#334155' } as const;
const CLASS_FILL = { A: '#ef4444', B: '#f59e0b', C: '#3b82f6', D: '#475569' } as const;

function binFill(bin: MapBin, mode: Heatmap): string {
  if (mode === 'VELOCITY') return bin.totalStock > 0 ? CLASS_FILL[bin.velocityClass] : STOCK_FILL.EMPTY;
  return STOCK_FILL[bin.status];
}

/** Colour of one bay seen from above: the "loudest" bin across its levels. */
function bayFill(bins: MapBin[], mode: Heatmap): { fill: string; ratio: number } {
  const stocked = bins.filter(b => b.totalStock > 0);
  if (stocked.length === 0) return { fill: STOCK_FILL.EMPTY, ratio: 0 };
  const ratio = stocked.length / Math.max(1, bins.length);
  if (mode === 'VELOCITY') {
    const best = stocked.reduce((a, b) => (a.velocityClass < b.velocityClass ? a : b));
    return { fill: CLASS_FILL[best.velocityClass], ratio };
  }
  return { fill: stocked.some(b => b.status === 'LOW_STOCK') ? STOCK_FILL.LOW_STOCK : STOCK_FILL.NORMAL, ratio };
}

function rackFootprint(r: RackConfig) {
  return { len: Math.max(0.5, r.bays * r.bayWidth), depth: Math.max(0.3, r.rackDepth) };
}

export default function Warehouse2DPlan({
  layout,
  map,
  heatmapMode,
  matchingBinCodes,
  zoneFilter,
  selectedRackCode,
  onSelectRack,
  onSelectBin,
}: Props) {
  const mapRacks = useMemo(() => {
    const byCode = new Map<string, MapRack>();
    map.zones.forEach(z => z.racks.forEach(r => byCode.set(r.rack.rackCode, r)));
    return byCode;
  }, [map]);

  // Fit the view to the building and to any rack placed outside it.
  const view = useMemo(() => {
    let minX = -layout.widthM / 2, maxX = layout.widthM / 2;
    let minY = -layout.lengthM / 2, maxY = layout.lengthM / 2;
    layout.racks.forEach(r => {
      const { len, depth } = rackFootprint(r);
      const reach = Math.hypot(len, depth) / 2;
      minX = Math.min(minX, r.posX - reach); maxX = Math.max(maxX, r.posX + reach);
      minY = Math.min(minY, r.posZ - reach); maxY = Math.max(maxY, r.posZ + reach);
    });
    const pad = 2;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [layout]);

  const labelSize = Math.max(0.6, Math.min(1.6, Math.max(view.w, view.h) / 60));
  const selected = selectedRackCode ? mapRacks.get(selectedRackCode) : undefined;
  const visibleRacks = map.zones
    .filter(z => zoneFilter === 'ALL' || z.zoneCode === zoneFilter)
    .flatMap(z => z.racks);

  return (
    <div className="space-y-5">
      {/* Floor plan (top-down, metres) */}
      <div className="rounded-2xl border border-[#30353d] bg-[#0f1419] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30353d] text-[11px] text-[#8a92a6]">
          <span className="font-bold text-[#d1c6ab]">ผังพื้นคลัง (มุมบน)</span>
          <span className="font-mono">{layout.widthM} × {layout.lengthM} m • {layout.racks.length} แร็ก</span>
        </div>
        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="w-full h-auto max-h-[560px] block touch-manipulation"
          preserveAspectRatio="xMidYMid meet"
          onClick={() => onSelectRack(null)}
        >
          {/* Building outline + 5 m grid */}
          <defs>
            <pattern id="wh-grid" width="5" height="5" patternUnits="userSpaceOnUse" x={-layout.widthM / 2} y={-layout.lengthM / 2}>
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#1f2630" strokeWidth="0.05" />
            </pattern>
          </defs>
          <rect
            x={-layout.widthM / 2}
            y={-layout.lengthM / 2}
            width={layout.widthM}
            height={layout.lengthM}
            fill="url(#wh-grid)"
            stroke="#3a4250"
            strokeWidth="0.15"
          />
          <text x={0} y={layout.lengthM / 2 + labelSize * 1.2} textAnchor="middle" fontSize={labelSize * 0.8} fill="#5b6475">
            ▼ ด้านหน้าคลัง / ประตูรับ-จ่าย
          </text>

          {layout.racks.map(r => {
            const mr = mapRacks.get(r.rackCode);
            const { len, depth } = rackFootprint(r);
            const deg = (-(Number(r.rotationY) || 0) * 180) / Math.PI;
            const dimmed = zoneFilter !== 'ALL' && r.zoneCode !== zoneFilter;
            const isSel = r.rackCode === selectedRackCode;
            const isFloor = r.type === 'FLOOR_BLOCK' || r.type === 'CROSS_DOCK';
            const hasMatch = !!mr && mr.bins.some(b => matchingBinCodes.has(b.binCode));
            const bayW = len / Math.max(1, r.bays);

            return (
              <g
                key={r.rackCode}
                transform={`translate(${r.posX} ${r.posZ}) rotate(${deg})`}
                opacity={dimmed ? 0.25 : 1}
                className="cursor-pointer"
                onClick={e => { e.stopPropagation(); onSelectRack(r.rackCode); }}
              >
                <rect
                  x={-len / 2}
                  y={-depth / 2}
                  width={len}
                  height={depth}
                  fill="#1b2027"
                  stroke={isSel ? '#2dd4bf' : hasMatch ? '#22d3ee' : r.color || '#64748b'}
                  strokeWidth={isSel || hasMatch ? 0.25 : 0.1}
                  strokeDasharray={isFloor ? '0.4 0.3' : undefined}
                />
                {Array.from({ length: r.bays }, (_, i) => {
                  const bay = i + 1;
                  const bins = mr ? mr.bins.filter(b => b.bay === bay) : [];
                  if (bins.length === 0) return null; // whole bay switched off
                  const { fill, ratio } = bayFill(bins, heatmapMode);
                  const match = bins.some(b => matchingBinCodes.has(b.binCode));
                  return (
                    <rect
                      key={bay}
                      x={-len / 2 + i * bayW + 0.06}
                      y={-depth / 2 + 0.06}
                      width={Math.max(0.05, bayW - 0.12)}
                      height={Math.max(0.05, depth - 0.12)}
                      fill={match ? '#22d3ee' : fill}
                      opacity={match ? 1 : ratio === 0 ? 0.55 : 0.45 + ratio * 0.55}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Labels drawn unrotated at the rack's start end so back-to-back racks don't collide */}
          {layout.racks.map(r => {
            const dimmed = zoneFilter !== 'ALL' && r.zoneCode !== zoneFilter;
            const { len } = rackFootprint(r);
            const theta = Number(r.rotationY) || 0;
            const lx = -len / 2 - labelSize * 0.4; // local x of the start end
            return (
              <text
                key={`lbl-${r.rackCode}`}
                x={r.posX + lx * Math.cos(theta)}
                y={r.posZ - lx * Math.sin(theta) + labelSize * 0.35}
                textAnchor="end"
                fontSize={labelSize}
                fontWeight={700}
                fill={r.rackCode === selectedRackCode ? '#2dd4bf' : '#c9d1e0'}
                opacity={dimmed ? 0.3 : 1}
                className="pointer-events-none font-mono"
              >
                {r.rackCode}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Rack quick-pick (handy on phones where the plan is small) */}
      <div className="flex flex-wrap gap-1.5">
        {visibleRacks.map(r => (
          <button
            key={r.rack.rackCode}
            onClick={() => onSelectRack(r.rack.rackCode)}
            className={cn(
              'px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold transition-colors',
              r.rack.rackCode === selectedRackCode
                ? 'bg-teal-600 border-teal-500 text-white'
                : 'bg-[#1b2027] border-[#30353d] text-[#c9d1e0] hover:border-teal-500/60',
              r.bins.some(b => matchingBinCodes.has(b.binCode)) && 'ring-1 ring-cyan-400',
            )}
          >
            {r.rack.rackCode}
            <span className="ml-1.5 text-[10px] font-normal opacity-70">
              {r.occupiedBins}/{r.bins.length}
            </span>
          </button>
        ))}
      </div>

      {/* Elevation of the selected rack: bays across, levels up */}
      {selected ? (
        <RackElevation
          mapRack={selected}
          heatmapMode={heatmapMode}
          matchingBinCodes={matchingBinCodes}
          onSelectBin={onSelectBin}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-[#30353d] p-6 text-center text-xs text-[#8a92a6] flex items-center justify-center gap-2">
          <MousePointerClick className="w-4 h-4 text-teal-500" />
          คลิกแร็กในผังหรือเลือกจากรายการด้านบน เพื่อดูช่องเก็บทุกชั้น
        </div>
      )}
    </div>
  );
}

function RackElevation({
  mapRack,
  heatmapMode,
  matchingBinCodes,
  onSelectBin,
}: {
  mapRack: MapRack;
  heatmapMode: Heatmap;
  matchingBinCodes: Set<string>;
  onSelectBin: (bin: MapBin) => void;
}) {
  const { rack, bins } = mapRack;
  const byKey = new Map(bins.map(b => [`${b.bay}-${b.level}`, b]));
  const levels = Array.from({ length: rack.levels }, (_, i) => rack.levels - i); // top level first
  const bays = Array.from({ length: rack.bays }, (_, i) => i + 1);

  return (
    <div className="rounded-2xl border border-[#30353d] bg-[#12161d] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-black text-sm text-teal-300 flex items-center gap-2 font-mono">
          <MapPin className="w-4 h-4" /> แร็ก {rack.rackCode}
          <span className="text-[11px] font-normal text-[#8a92a6]">
            โซน {rack.zoneCode} • {rack.bays} ช่อง × {rack.levels} ชั้น
          </span>
        </h3>
        <span className="text-[11px] text-[#8a92a6] font-mono">
          ใช้งาน {mapRack.occupiedBins}/{bins.length} ช่อง • {mapRack.totalStock.toLocaleString()} ชิ้น
        </span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `2.25rem repeat(${rack.bays}, minmax(5.75rem, 11rem))` }}
        >
          {levels.map(level => (
            <div key={level} className="contents">
              <div className="flex items-center justify-center text-[10px] font-mono text-[#8a92a6]">ช.{level}</div>
              {bays.map(bay => {
                const bin = byKey.get(`${bay}-${level}`);
                if (!bin) {
                  // Slot switched off (merged bay / no bin here)
                  const merged = binCodeFor(rack, bay, level) === null;
                  return (
                    <div
                      key={bay}
                      className="rounded-xl border border-dashed border-[#252a32] min-h-[64px] flex items-center justify-center text-[10px] text-[#4b5363]"
                    >
                      {merged ? 'รวมช่อง' : '—'}
                    </div>
                  );
                }
                const match = matchingBinCodes.has(bin.binCode);
                const fill = binFill(bin, heatmapMode);
                const first = bin.products[0];
                return (
                  <button
                    key={bay}
                    onClick={() => onSelectBin(bin)}
                    className={cn(
                      'rounded-xl border p-2 text-left min-h-[64px] flex flex-col justify-between transition-transform hover:scale-[1.03]',
                      match && 'ring-2 ring-cyan-400',
                    )}
                    style={{
                      borderColor: bin.totalStock > 0 ? fill : '#30353d',
                      background: bin.totalStock > 0 ? `${fill}26` : '#171c23',
                    }}
                    title={bin.binCode}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-black text-[10px] text-white truncate">{bin.binCode}</span>
                      {match && <Sparkles className="w-3 h-3 text-cyan-300 shrink-0" />}
                    </div>
                    {first ? (
                      <div className="text-[10px] leading-tight">
                        <div className="truncate text-slate-300">{first.name}</div>
                        <div className="font-mono font-bold" style={{ color: fill }}>
                          {heatmapMode === 'VELOCITY' ? `Class ${bin.velocityClass}` : `${bin.totalStock.toLocaleString()} ชิ้น`}
                          {bin.products.length > 1 && <span className="text-[#8a92a6] font-normal"> +{bin.products.length - 1}</span>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#5b6475] italic">ว่าง</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          <div />
          {bays.map(bay => (
            <div key={bay} className="text-center text-[10px] font-mono text-[#8a92a6]">ช่อง {bay}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
