// Stock-ledger arithmetic shared by the stock card and the depletion chart.
//
// Meaning of stock_transactions.qty per type:
//   IN      +qty received
//   OUT     -qty issued / shipped
//   DAMAGE  -qty written off
//   ADJUST  signed correction (counted − system), written by count approval
//           and by the history import
//   RELOCATE / MOVE  bin-to-bin move: qty is informational (the SKU's stock),
//           the SKU total does not change → 0
// Treating every non-IN row as "out" (as the stock card did) made each
// location swap wipe the product's whole stock off the running balance.

export interface LedgerRow {
  type: string;
  qty: number | string | null;
  created_at?: string | null;
  date?: string | null;
}

/** Signed effect of one ledger row on the SKU's total stock. */
export function txDelta(type: string, qty: number | string | null | undefined): number {
  const q = Number(qty ?? 0) || 0;
  switch (String(type || '').toUpperCase()) {
    case 'IN':
      return Math.abs(q);
    case 'OUT':
    case 'DAMAGE':
      return -Math.abs(q);
    case 'ADJUST':
      return q;
    default:
      return 0;
  }
}

/** YYYY-MM-DD of a timestamp on the Bangkok calendar. */
export function bkkDay(ts: number | string | Date): string {
  const t = new Date(ts).getTime() + 7 * 3600_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * End-of-day stock for the last `days` days (oldest first, today last),
 * walked backwards from the current stock through the real ledger.
 */
export function pastDailyStock(
  currentStock: number,
  rows: LedgerRow[],
  days = 7,
  now: number = Date.now(),
): Array<{ date: string; stock: number }> {
  const netByDay = new Map<string, number>();
  for (const r of rows) {
    const when = r.created_at || r.date;
    if (!when) continue;
    const d = bkkDay(when);
    netByDay.set(d, (netByDay.get(d) || 0) + txDelta(r.type, r.qty));
  }
  const out: Array<{ date: string; stock: number }> = [];
  let level = Number(currentStock) || 0;
  for (let i = 0; i < days; i++) {
    const day = bkkDay(now - i * 86_400_000);
    out.push({ date: day, stock: Math.max(0, Math.round(level)) });
    level -= netByDay.get(day) || 0; // stock at the end of the previous day
  }
  return out.reverse();
}
