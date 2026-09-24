import { describe, it, expect } from 'vitest';
import { movingAverageCost } from '@/lib/costing';
import { computeValuation } from '@/lib/data/valuation';
import { txDelta, pastDailyStock } from '@/lib/ledger';
import { generateDepletionData } from '@/lib/forecast';

const NOW = new Date('2026-09-25T05:00:00Z').getTime(); // 12:00 Bangkok
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe('movingAverageCost', () => {
  it('first receipt sets the cost', () => {
    expect(movingAverageCost(0, null, 10, 50)).toBe(50);
  });
  it('averages by quantity', () => {
    // 10 @ 50 on hand + 30 @ 70 received → (500 + 2100) / 40 = 65
    expect(movingAverageCost(10, 50, 30, 70)).toBe(65);
  });
});

describe('computeValuation', () => {
  const base = { receiptCost: {}, poCost: {}, now: NOW };

  it('dormancy comes from the last real movement, not row order', () => {
    const v = computeValuation({
      ...base,
      products: [
        { sku: 'A', name: 'A', stock: 5, price: 100, costPrice: 60, createdAt: daysAgo(400) },
        { sku: 'B', name: 'B', stock: 5, price: 100, costPrice: 60, createdAt: daysAgo(400) },
        { sku: 'C', name: 'C', stock: 5, price: 100, costPrice: 60, createdAt: daysAgo(400) },
        { sku: 'D', name: 'D', stock: 5, price: 100, costPrice: 60, createdAt: daysAgo(400) },
      ],
      lastMoved: { A: daysAgo(2), B: daysAgo(45), C: daysAgo(95), D: daysAgo(10) },
    });
    const bySku = Object.fromEntries(v.deadStockItems.map(d => [d.sku, d]));
    expect(Object.keys(bySku).sort()).toEqual(['B', 'C']);
    expect(bySku.B.daysDormant).toBe(45);
    expect(bySku.C.severity).toBe('CRITICAL');
  });

  it('never-moved stock counts from creation date', () => {
    const v = computeValuation({
      ...base, lastMoved: {},
      products: [{ sku: 'N', name: 'N', stock: 3, price: 10, costPrice: 5, createdAt: daysAgo(70) }],
    });
    expect(v.deadStockItems[0]).toMatchObject({ sku: 'N', daysDormant: 70, neverMoved: true, severity: 'HIGH' });
  });

  it('uses real cost sources in order and never guesses 68% of retail', () => {
    const v = computeValuation({
      now: NOW, lastMoved: {},
      receiptCost: { R: 40 },
      poCost: { R: 99, P: 30 },
      products: [
        { sku: 'X', name: 'X', stock: 2, price: 100, costPrice: 55 },
        { sku: 'R', name: 'R', stock: 1, price: 100 },
        { sku: 'P', name: 'P', stock: 1, price: 100 },
        { sku: 'Z', name: 'Z', stock: 4, price: 100 },
      ],
    });
    // 2×55 + 1×40 + 1×30; Z has no cost → excluded and counted
    expect(v.totalCostValuation).toBe(180);
    expect(v.skusWithoutCost).toBe(1);
    // margin over costed stock only: retail 400, cost 180 → 55%
    expect(v.estimatedMargin).toBe(55);
    expect(v.totalRetailValuation).toBe(800);
  });
});

describe('ledger', () => {
  it('signs each transaction type', () => {
    expect(txDelta('IN', 5)).toBe(5);
    expect(txDelta('OUT', 5)).toBe(-5);
    expect(txDelta('DAMAGE', 2)).toBe(-2);
    expect(txDelta('ADJUST', -3)).toBe(-3);
    expect(txDelta('ADJUST', 4)).toBe(4);
    // a location swap must not change the total (it wiped stock on the card)
    expect(txDelta('RELOCATE', 120)).toBe(0);
  });

  it('walks the stock back day by day from today', () => {
    const rows = [
      { type: 'OUT', qty: 10, created_at: daysAgo(0) },
      { type: 'IN', qty: 30, created_at: daysAgo(1) },
      { type: 'RELOCATE', qty: 999, created_at: daysAgo(1) },
      { type: 'OUT', qty: 5, created_at: daysAgo(2) },
    ];
    const h = pastDailyStock(50, rows, 4, NOW);
    expect(h.map(x => x.stock)).toEqual([35, 30, 60, 50]);
    expect(h[3].date).toBe('2026-09-25');
  });
});

describe('generateDepletionData', () => {
  it('uses real history and no longer invents past days', () => {
    const real = generateDepletionData(50, 10, [{ date: '2026-09-24', stock: 60 }, { date: '2026-09-25', stock: 50 }]);
    expect(real.filter(d => !d.predicted).map(d => d.stock)).toEqual([60, 50]);
    const none = generateDepletionData(50, 10, []);
    expect(none.filter(d => !d.predicted)).toHaveLength(1);
  });
});

import { deriveHistoricalLots, historicalLotNumber } from '@/lib/lotHistory';

describe('historical lot trace (FIFO replay)', () => {
  it('names lots by UTC receive date like the lot-building script', () => {
    expect(historicalLotNumber('2025-02-20T17:30:00Z')).toBe('RCV-20250220');
  });
  it('allocates shipments oldest lot first and keeps doc refs', () => {
    const lots = deriveHistoricalLots(
      [{ qty: 10, created_at: '2025-01-05T03:00:00Z' }, { qty: 20, created_at: '2025-02-20T03:00:00Z' }],
      [
        { type: 'OUT', qty: 8, created_at: '2025-01-10T03:00:00Z', doc_ref: 'A' },
        { type: 'OUT', qty: 5, created_at: '2025-03-01T03:00:00Z', doc_ref: 'B' },
        { type: 'DAMAGE', qty: 1, created_at: '2025-03-02T03:00:00Z', doc_ref: '' },
      ],
    );
    expect(lots.get('RCV-20250105')?.consumed).toEqual([
      { docRef: 'A', type: 'OUT', qty: 8, at: '2025-01-10T03:00:00Z' },
      { docRef: 'B', type: 'OUT', qty: 2, at: '2025-03-01T03:00:00Z' },
    ]);
    const feb = lots.get('RCV-20250220')!;
    expect(feb.received).toBe(20);
    expect(feb.consumed.map(c => [c.docRef, c.qty])).toEqual([['B', 3], ['', 1]]);
  });
});
