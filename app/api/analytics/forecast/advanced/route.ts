import { NextResponse } from 'next/server';
import { getProducts, getTransactions } from '@/lib/data/wms';
import { calculateRiskLevel, recommendReorder } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [products, outbound] = await Promise.all([
            getProducts(),
            getTransactions('OUT')
        ]);

        // 1. Group Sales by Product by Month
        const salesMap = new Map<string, number[]>(); // SKU -> [Month1, Month2, Month3...]
        // Simplified: Just Get Last 3 Months Total for Avg
        // For full time-series, we need to bin by month.
        
        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);

        const productSales = new Map<string, number>();

        outbound.forEach(t => {
            const d = new Date(t.date);
            if(d >= threeMonthsAgo && t.product) {
                productSales.set(t.product, (productSales.get(t.product) || 0) + t.qty);
            }
        });

        // 2. Generate Report
        const report = products.map(p => {
             const total3MonthSales = productSales.get(p.name) || 0;
             const avgMonthlyDemand = total3MonthSales / 3;
             
             const risk = calculateRiskLevel(p.stock, avgMonthlyDemand);
             const reorder = recommendReorder(p.stock, avgMonthlyDemand, 7, 7); // Default LT 7, SS 7

             return {
                 id: p.id,
                 name: p.name,
                 stock: p.stock,
                 category: p.category,
                 avgDemand: avgMonthlyDemand,
                 riskLevel: risk.level,
                 reorderAction: reorder.action,
                 suggestedQty: reorder.qty,
                 daysSupply: avgMonthlyDemand > 0 ? (p.stock / avgMonthlyDemand * 30) : 999
             };
        });

        // 3. Sort by Risk
        report.sort((a, b) => {
            const riskScore = { 'Very High': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
            // @ts-ignore
            return riskScore[b.riskLevel] - riskScore[a.riskLevel];
        });

        return NextResponse.json(report);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
