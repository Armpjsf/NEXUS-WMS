// Trace for HISTORICAL lots (RCV-YYYYMMDD).
//
// scripts/build-lots-from-history.mjs created those lots from the IN ledger —
// one lot per (sku, receive date, UTC) — and consumed every OUT/DAMAGE against
// them FIFO (oldest lot first). lot_movements only started recording later, so
// for these lots the trace showed 0 received / 0 shipped. This replays the
// same FIFO over stock_transactions so the trace (and recall list) matches the
// lot balances the script stored.

export interface LedgerIn { qty: number | string; created_at: string }
export interface LedgerOut { qty: number | string; created_at: string; doc_ref?: string | null; type: string }

export interface LotConsumption { docRef: string; type: string; qty: number; at: string }
export interface DerivedLot { lotNumber: string; received: number; consumed: LotConsumption[] }

export const HISTORICAL_LOT = /^RCV-\d{8}$/;

/** Lot number the history script gave to an IN made at `iso`. */
export function historicalLotNumber(iso: string): string {
  return `RCV-${new Date(iso).toISOString().slice(0, 10).replace(/-/g, '')}`;
}

export function deriveHistoricalLots(ins: LedgerIn[], outs: LedgerOut[]): Map<string, DerivedLot> {
  const lots = new Map<string, DerivedLot & { remaining: number }>();
  for (const t of ins) {
    const n = historicalLotNumber(t.created_at);
    const lot = lots.get(n) || { lotNumber: n, received: 0, consumed: [], remaining: 0 };
    lot.received += Number(t.qty) || 0;
    lot.remaining += Number(t.qty) || 0;
    lots.set(n, lot);
  }
  const queue = [...lots.values()].sort((a, b) => a.lotNumber.localeCompare(b.lotNumber));
  const ordered = outs
    .filter(o => o.type === 'OUT' || o.type === 'DAMAGE')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let head = 0;
  for (const o of ordered) {
    let need = Math.abs(Number(o.qty) || 0);
    while (need > 0 && head < queue.length) {
      const lot = queue[head];
      if (lot.remaining <= 0) { head++; continue; }
      const use = Math.min(lot.remaining, need);
      lot.remaining -= use;
      need -= use;
      lot.consumed.push({ docRef: o.doc_ref || '', type: o.type, qty: use, at: o.created_at });
    }
  }
  return new Map([...lots].map(([k, v]) => [k, { lotNumber: v.lotNumber, received: v.received, consumed: v.consumed }]));
}
