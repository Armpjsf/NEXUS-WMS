
import { getAllTransactions, type Transaction, getProducts } from './data/wms';

export interface InventoryBatch {
  date: string;
  qty: number;
  cost: number;
  initialQty: number; // For tracking batch consumption %
}

export interface FIFOStack {
  sku: string;
  totalStock: number;
  weightedAverageCost: number;
  layers: InventoryBatch[];
}

export interface SalesAnalysis {
  transaction: Transaction; // The OUT transaction
  cogs: number;
  profit: number;
  margin: number;
}

/**
 * Replays transaction history to reconstruct the current inventory stack for a product.
 * Uses FIFO (First-In-First-Out) logic.
 */
export async function getFIFOStack(sku: string): Promise<FIFOStack> {
    const allTx = await getAllTransactions();
    const productTx = allTx.filter(t => t.sku === sku);

    // Initialize Stack
    let layers: InventoryBatch[] = [];

    // Replay History
    for (const tx of productTx) {
        if (tx.type === 'IN') {
             // Add new batch layer
             layers.push({
                 date: tx.date,
                 qty: tx.qty,
                 cost: tx.price, // Cost Price
                 initialQty: tx.qty
             });
        } else if (tx.type === 'OUT') {
             // Consume from oldest layers
             let qtyToDeduct = tx.qty;
             
             while (qtyToDeduct > 0 && layers.length > 0) {
                 const oldestLayer = layers[0];
                 
                 if (oldestLayer.qty > qtyToDeduct) {
                     // Partial consumption of this layer
                     oldestLayer.qty -= qtyToDeduct;
                     qtyToDeduct = 0;
                 } else {
                     // Full consumption of this layer
                     qtyToDeduct -= oldestLayer.qty;
                     layers.shift(); // Remove empty layer
                 }
             }
        }
    }

    // Calculate Summary
    const totalStock = layers.reduce((acc, l) => acc + l.qty, 0);
    const totalValue = layers.reduce((acc, l) => acc + (l.qty * l.cost), 0);
    const weightedAverageCost = totalStock > 0 ? totalValue / totalStock : 0;

    return {
        sku,
        totalStock,
        weightedAverageCost,
        layers
    };
}

/**
 * Simulates a sale to calculate Projected Profit based on current FIFO stack.
 * Does NOT update the database.
 */
export async function simulateSale(sku: string, saleQty: number, salePrice: number) {
    const stack = await getFIFOStack(sku);
    let layers = JSON.parse(JSON.stringify(stack.layers)); // Deep copy to simulate
    
    let remainingQty = saleQty;
    let totalCOGS = 0;
    
    // Simulation Logic
    for (const layer of layers) {
        if (remainingQty <= 0) break;

        const take = Math.min(layer.qty, remainingQty);
        totalCOGS += (take * layer.cost);
        remainingQty -= take;
    }

    // If we run out of stock during simulation, assume replacement cost (weighted average or last cost)
    if (remainingQty > 0) {
         // Fallback: If stockout, use Weighted Average for remaining
         totalCOGS += (remainingQty * stack.weightedAverageCost);
    }

    const revenue = saleQty * salePrice;
    const profit = revenue - totalCOGS;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
        sku,
        saleQty,
        salePrice,
        revenue,
        cogs: totalCOGS,
        profit,
        margin,
        isStockoutRisk: remainingQty > 0
    };
}

/**
 * Replays ALL history to calculate realized profit for every past transaction.
 * Useful for analytics dashboard.
 */
export async function calculateHistoricalProfit() {
    const allTx = await getAllTransactions();
    
    // Group by SKU
    const txBySku: Record<string, Transaction[]> = {};
    for (const tx of allTx) {
        if (!txBySku[tx.sku]) txBySku[tx.sku] = [];
        txBySku[tx.sku].push(tx);
    }

    const salesAnalysis: SalesAnalysis[] = [];

    // Process each SKU
    for (const sku in txBySku) {
        let layers: InventoryBatch[] = [];
        const transactions = txBySku[sku];

        for (const tx of transactions) {
            if (tx.type === 'IN') {
                 layers.push({ date: tx.date, qty: tx.qty, cost: tx.price, initialQty: tx.qty });
            } else if (tx.type === 'OUT') {
                 let qtyLeft = tx.qty;
                 let currentTxCOGS = 0;

                 // Consume
                 // We need to clone layers to not mess up if we want to backtrack? 
                 // No, we are replaying sequentially from start. Consuming IS the correct state update.
                 
                 // However, we need to handle the case where layers run out (Negative Stock in history)
                 // If layers empty, use 0 cost or last known cost? Let's use 0 for safety but flag it.
                 
                 let consumedLayersCount = 0;

                 while (qtyLeft > 0) {
                     if (layers.length === 0) {
                         // Emergency: Stockout but sale happened (Data error or pre-history stock)
                         // Assume 0 cost -> 100% margin (Data Quality Issue)
                         // Or assume sale price * 0.7?
                         // Let's stick to 0 cost to highlight data issue.
                         qtyLeft = 0; 
                         break;
                     }

                     const layer = layers[0];
                     if (layer.qty > qtyLeft) {
                         currentTxCOGS += (qtyLeft * layer.cost);
                         layer.qty -= qtyLeft;
                         qtyLeft = 0;
                     } else {
                         currentTxCOGS += (layer.qty * layer.cost);
                         qtyLeft -= layer.qty;
                         layers.shift();
                     }
                 }

                 const revenue = tx.qty * tx.price;
                 const profit = revenue - currentTxCOGS;
                 salesAnalysis.push({
                     transaction: tx,
                     cogs: currentTxCOGS,
                     profit,
                     margin: revenue > 0 ? (profit / revenue) * 100 : 0
                 });
            }
        }
    }

    return salesAnalysis;
}
