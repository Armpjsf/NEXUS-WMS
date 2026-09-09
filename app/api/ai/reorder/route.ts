
// app/api/ai/reorder/route.ts
import { NextResponse } from 'next/server';
import { getProducts, getTransactionsUncached } from '@/lib/data/wms';
import { calculateTrend, calculateSafetyStock } from '@/lib/forecast';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch Products & History in Parallel
    const [products, outboundTxs] = await Promise.all([
        getProducts(),
        getTransactionsUncached('OUT') // Get real sales history
    ]);
    
    if (!products || products.length === 0) return NextResponse.json([]);

    // 2. Process History: Group by Product -> Daily Usage
    const historyMap = new Map<string, number[]>();
    const today = new Date();
    
    // Initialize map
    products.forEach(p => historyMap.set(p.id, []));

    // Map transactions to daily buckets (Last 30 days for now)
    // In a real DB, we'd query by date range. iterate all txs is fine for < 5000 rows.
    const cutoffDate = new Date();
    cutoffDate.setDate(today.getDate() - 60); // Check last 60 days

    outboundTxs.forEach(tx => {
        if (!tx.product || !tx.qty) return;
        const txDate = new Date(tx.date);
        if (txDate < cutoffDate) return;

        // Simplify: We just collect raw positive movement quantities for the trend
        // A better approach is bucket by day, but raw sequence also works for simple linear regression 
        // if we assume roughly uniform events.
        // Let's bucket by day for accuracy.
        const dateKey = tx.date; // YYYY-MM-DD
        // We'll store this differently. complex approach:
    });

    // Simplify for speed: Just get array of QTYs sorted by date for each product
    // This represents "usage events".
    const productUsage = new Map<string, { date: string, qty: number }[]>();
    products.forEach(p => productUsage.set(p.id, []));

    outboundTxs.forEach(tx => {
        const pid = products.find(p => p.name === tx.product)?.id; 
        if (pid) {
           productUsage.get(pid)?.push({ date: tx.date, qty: tx.qty });
        }
    });

    const suggestions = [];
    
    for (const p of products) {
        const usageEvents = productUsage.get(p.id) || [];
        // Sort by date
        usageEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Create daily bucket array (fill 0s for missing days? linear regression handles sparse data ok, 
        // but for "Daily Rate" it's better to sum up per day).
        // Let's effectively convert to "Daily Usage" array.
        const dailyMap = new Map<string, number>();
        usageEvents.forEach(e => {
            const current = dailyMap.get(e.date) || 0;
            dailyMap.set(e.date, current + e.qty);
        });

        // Convert map to array of numbers sorted by date
        const dailyUsage: number[] = [];
        // Fill last 30 days
        for(let i=29; i>=0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            dailyUsage.push(dailyMap.get(key) || 0);
        }

        // --- CORE AI LOGIC ---
        const trend = calculateTrend(dailyUsage);
        const safetyStock = calculateSafetyStock(dailyUsage);
        
        const currentStock = p.stock || 0;
        const minStock = p.minStock || 10;
        
        // Dynamic Reorder Point:
        // ROP = (Average Daily Usage * Lead Time) + Safety Stock
        // Lead Time: Assume 7 days for now (or could be in product sheet)
        const avgDaily = dailyUsage.reduce((a, b) => a + b, 0) / 30;
        const predictedDaily = trend.prediction > 0 ? trend.prediction : avgDaily;
        // Use the higher of avg or prediction to be safe
        const cleanupDaily = Math.max(avgDaily, predictedDaily);
        
        const dynamicROP = Math.ceil((cleanupDaily * 7) + safetyStock);
        
        // Decision Logic
        let confidence = 0;
        let reason = "";
        const effectiveMin = Math.max(minStock, dynamicROP); // Respect manual min if higher

        if (currentStock <= 0) {
             confidence = 100;
             reason = "Critical: Out of Stock";
        } else if (currentStock <= effectiveMin) {
             // High urgency
             confidence = 85 + (trend.slope * 10); // Boost if trending up
             reason = trend.slope > 0.1 
                ? `Critical: Low stock & Trending UP (+${trend.growthRate.toFixed(1)}%)`
                : "Restock Needed: Below reorder point";
        } else if (trend.trend === 'UP' && currentStock < effectiveMin * 1.5) {
             // Predicting stockout soon
             confidence = 60 + (trend.rSquared * 20);
             reason = `Suggestion: High Velocity (+${trend.growthRate.toFixed(1)}%). Stock up early.`;
        }

        if (confidence > 50) { // Threshold
            const targetDays = 30; // Aim to cover 30 days
            const targetQty = Math.ceil(cleanupDaily * targetDays) + safetyStock;
            const suggest = Math.max(0, targetQty - currentStock);

            if (suggest > 0) {
                 suggestions.push({
                    id: p.id,
                    name: p.name,
                    currentStock,
                    minStock: effectiveMin, // Show dynamic ROP to user
                    price: p.price,
                    img: p.image,
                    confidence: Math.min(100, Math.round(confidence)),
                    reason,
                    suggestedQty: suggest,
                    trendInfo: {
                        slope: trend.slope,
                        growth: trend.growthRate,
                        direction: trend.trend
                    }
                });
            }
        }
    }

    return NextResponse.json(suggestions.sort((a, b) => b.confidence - a.confidence));

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate AI suggestions' }, { status: 500 });
  }
}

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
