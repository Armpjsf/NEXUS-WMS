import { NextResponse } from 'next/server';
import { getProducts, getTransactions, type Transaction } from '@/lib/data/wms';
import { calculateFIFOLayers } from '@/lib/fifo';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const [products, outbound, inbound] = await Promise.all([
      getProducts(),
      getTransactions('OUT'),
      getTransactions('IN'),
    ]);

    // Build cost-price map from Supabase products (by name and by SKU/id)
    const priceMap = new Map<string, number>();
    products.forEach(p => {
      if (p.name) priceMap.set(p.name.trim(), p.price || 0);
      if (p.id) priceMap.set(String(p.id).trim(), p.price || 0);
    });

    // 1. Pre-index inbound transactions by lowercase product name and SKU in O(T_in) single pass,
    //    and track stock & firstReceivedMap simultaneously.
    const stockMap = new Map<string, number>();
    const firstReceivedMap = new Map<string, Date>();
    const inboundByKey = new Map<string, Transaction[]>();

    products.forEach(p => stockMap.set(p.name, 0));

    const addInboundToKey = (key: string, tx: Transaction) => {
      if (!key) return;
      const existing = inboundByKey.get(key);
      if (existing) {
        existing.push(tx);
      } else {
        inboundByKey.set(key, [tx]);
      }
    };

    for (const t of inbound) {
      const prodKey = t.product ? t.product.trim().toLowerCase() : '';
      const skuKey = t.sku ? String(t.sku).trim().toLowerCase() : '';
      if (prodKey) addInboundToKey(prodKey, t);
      if (skuKey && skuKey !== prodKey) addInboundToKey(skuKey, t);

      if (t.product) {
        const curr = stockMap.get(t.product) || 0;
        stockMap.set(t.product, curr + t.qty);

        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          const existing = firstReceivedMap.get(t.product);
          if (!existing || d < existing) {
            firstReceivedMap.set(t.product, d);
          }
          if (t.sku) {
            const existingSku = firstReceivedMap.get(t.sku);
            if (!existingSku || d < existingSku) {
              firstReceivedMap.set(t.sku, d);
            }
          }
        }
      }
    }

    // 2. Single pass over outbound for stock deduction and lastSoldMap
    const lastSoldMap = new Map<string, Date>();
    for (const t of outbound) {
      if (t.product) {
        const curr = stockMap.get(t.product) || 0;
        stockMap.set(t.product, curr - t.qty);

        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          const existing = lastSoldMap.get(t.product);
          if (!existing || d > existing) {
            lastSoldMap.set(t.product, d);
          }
          if (t.sku) {
            const existingSku = lastSoldMap.get(t.sku);
            if (!existingSku || d > existingSku) {
              lastSoldMap.set(t.sku, d);
            }
          }
        }
      }
    }

    // 3. Prepare Report Data with FIFO Layers in O(P) using pre-built inboundByKey Map
    const today = new Date();
    const todayMs = today.getTime();
    const report = products.map(p => {
      const lastSold = lastSoldMap.get(p.name) || (p.id ? lastSoldMap.get(String(p.id)) : undefined);
      let daysSinceLastSale = -1;
      let isNeverSold = false;

      if (lastSold) {
        const diffTime = Math.abs(todayMs - lastSold.getTime());
        daysSinceLastSale = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      } else {
        daysSinceLastSale = 9999;
        isNeverSold = true;
      }

      let movementStatus = 'Deadstock';
      if (!isNeverSold) {
        if (daysSinceLastSale <= 15) movementStatus = 'Fast Moving';
        else if (daysSinceLastSale <= 60) movementStatus = 'Normal Moving';
        else if (daysSinceLastSale <= 90) movementStatus = 'Slow Moving';
        else if (daysSinceLastSale <= 180) movementStatus = 'Very Slow Moving';
      } else {
        const firstReceived = firstReceivedMap.get(p.name) || (p.id ? firstReceivedMap.get(String(p.id)) : undefined);
        if (firstReceived) {
          const diffTime = Math.abs(todayMs - firstReceived.getTime());
          const daysSinceReceived = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (daysSinceReceived <= 90) {
            movementStatus = 'Normal Moving';
          } else if (daysSinceReceived <= 180) {
            movementStatus = 'Very Slow Moving';
          } else {
            movementStatus = 'Deadstock';
          }
          daysSinceLastSale = daysSinceReceived;
        } else {
          movementStatus = 'Normal Moving';
          daysSinceLastSale = 0;
        }
      }

      const stockNode = p.stock;
      const price = priceMap.get(p.name) || p.price || 0;

      // O(1) lookup from pre-built Map instead of O(T_in) .filter()
      const nameKey = p.name ? p.name.trim().toLowerCase() : '';
      const idKey = p.id ? String(p.id).trim().toLowerCase() : '';
      const byName = nameKey ? inboundByKey.get(nameKey) : undefined;
      const byId = idKey && idKey !== nameKey ? inboundByKey.get(idKey) : undefined;

      let prodInbound: Transaction[];
      if (byName && byId) {
        const seen = new Set<Transaction>(byName);
        prodInbound = [...byName];
        for (const tx of byId) {
          if (!seen.has(tx)) prodInbound.push(tx);
        }
      } else {
        prodInbound = byName || byId || [];
      }

      const fifoResult = calculateFIFOLayers(stockNode, prodInbound);
      const fifoTiers = {
        tier_0_30: 0,
        tier_31_60: 0,
        tier_61_90: 0,
        tier_91_180: 0,
        tier_180_plus: 0,
      };
      for (const l of fifoResult.layers) {
        if (l.daysOld <= 30) fifoTiers.tier_0_30 += l.qty;
        else if (l.daysOld <= 60) fifoTiers.tier_31_60 += l.qty;
        else if (l.daysOld <= 90) fifoTiers.tier_61_90 += l.qty;
        else if (l.daysOld <= 180) fifoTiers.tier_91_180 += l.qty;
        else fifoTiers.tier_180_plus += l.qty;
      }

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        location: p.location,
        stock: stockNode,
        price: price,
        value: stockNode * price,
        lastSoldDate: lastSold ? lastSold.toISOString().split('T')[0] : null,
        daysSinceLastSale,
        movementStatus,
        fifoLayers: fifoResult.layers,
        fifoTiers,
        oldestBatchDate: fifoResult.oldestDate,
        maxDaysOld: fifoResult.maxDaysOld,
      };
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Aging API Error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
