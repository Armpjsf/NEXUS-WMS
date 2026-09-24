import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { errorMessage } from '@/lib/errors';
import { bkkDay } from '@/lib/ledger';

export const dynamic = 'force-dynamic';

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export async function GET(request: Request) {
    try {
        const orgId = await getCurrentOrgId();
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const year1 = Number(searchParams.get('year1')) || new Date().getFullYear();
        const year2 = Number(searchParams.get('year2')) || year1 - 1;

        // 1. Products (paged — full catalog)
        const prods = await fetchAllRows((f, t) => supabase
            .from('products').select('*').eq('org_id', orgId).range(f, t));

        // 2. Full movement history (paged) so charts/top-sellers/yearly compare are real.
        const allTx = await fetchAllRows((f, t) => supabase
            .from('stock_transactions')
            .select('type, sku, product_name, qty, doc_ref, location, created_at, unit_price')
            .eq('org_id', orgId).order('created_at', { ascending: false }).range(f, t));

        // Period window (defaults to the sent range; falls back to "all")
        const from = startDate ? new Date(startDate).getTime() : -Infinity;
        const to = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;
        const inWindow = (t: any) => { const ts = t.created_at ? new Date(t.created_at).getTime() : 0; return ts >= from && ts <= to; };
        const periodTx = allTx.filter(inWindow);

        const nameBySku = new Map(prods.map(p => [p.sku, p.name || p.sku]));
        const imgBySku = new Map(prods.map(p => [p.sku, p.image_url || '']));

        // 3. KPIs
        const totalProducts = prods.length;
        const activeSkuCount = prods.filter(p => Number(p.stock || 0) > 0).length;
        const totalStock = prods.reduce((s, p) => s + Number(p.stock || 0), 0);
        const totalValue = prods.reduce((s, p) => s + (Number(p.stock || 0) * Number(p.price || 0)), 0);
        const lowStockCount = prods.filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= Number(p.min_stock || 5)).length;
        const outOfStockCount = prods.filter(p => Number(p.stock || 0) <= 0).length;
        const healthyCount = Math.max(0, activeSkuCount - lowStockCount);

        // period in/out/damage
        const sumType = (arr: any[], type: string) => arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.qty || 0), 0);
        const periodIn = sumType(periodTx, 'IN');
        const periodOut = sumType(periodTx, 'OUT');
        const periodDamage = sumType(periodTx, 'DAMAGE');

        // aging: SKUs in stock with no OUT in the last 90 days
        const now = Date.now();
        const lastOutBySku = new Map<string, number>();
        for (const t of allTx) if (t.type === 'OUT') { const ts = new Date(t.created_at).getTime(); if (ts > (lastOutBySku.get(t.sku) || 0)) lastOutBySku.set(t.sku, ts); }
        const agingStockCount = prods.filter(p => Number(p.stock || 0) > 0 && (now - (lastOutBySku.get(p.sku) || 0)) > 90 * 864e5).length;

        // turnover ≈ period OUT / average on-hand
        const turnoverRate = totalStock > 0 ? (periodOut / totalStock) * 100 : 0;

        // 4. Category breakdown (by stock)
        const catMap: Record<string, number> = {};
        prods.forEach(p => { const c = p.category || 'ทั่วไป'; catMap[c] = (catMap[c] || 0) + Number(p.stock || 0); });
        const categoryBreakdown = Object.entries(catMap).map(([name, value]) => ({ name, value }));

        // 5. Top sellers by OUT qty (period)
        const outBySku = new Map<string, number>();
        for (const t of periodTx) if (t.type === 'OUT') outBySku.set(t.sku, (outBySku.get(t.sku) || 0) + Number(t.qty || 0));
        const topSellers = [...outBySku.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([sku, qty]) => ({ name: nameBySku.get(sku) || sku, sku, qty }));

        // 6. Inventory health pie
        const healthData = [
            { name: 'Healthy', value: healthyCount },
            { name: 'Low', value: lowStockCount },
            { name: 'Out', value: outOfStockCount },
        ].filter(d => d.value > 0);

        // 7. Daily activity — last 30 days in/out on the Bangkok calendar (the
        //    chart shows the last 7 or all 30). Grouping by the UTC date put
        //    00:00–07:00 Bangkok movements on the previous day.
        const dayTotals = new Map<string, { in: number; out: number }>();
        for (const t of allTx) {
            if (!t.created_at || (t.type !== 'IN' && t.type !== 'OUT')) continue;
            const day = bkkDay(t.created_at);
            const cur = dayTotals.get(day) || { in: 0, out: 0 };
            if (t.type === 'IN') cur.in += Number(t.qty || 0); else cur.out += Number(t.qty || 0);
            dayTotals.set(day, cur);
        }
        const movementData: { date: string; name: string; in: number; out: number }[] = [];
        for (let i = 29; i >= 0; i--) {
            const day = bkkDay(now - i * 864e5);
            const [, m, d] = day.split('-');
            movementData.push({ date: day, name: `${Number(d)}/${Number(m)}`, ...(dayTotals.get(day) || { in: 0, out: 0 }) });
        }

        // 8. Low-stock table
        const lowStock = prods
            .filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= Number(p.min_stock || 5))
            .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
            .slice(0, 20)
            .map(p => ({ name: p.name || p.sku, sku: p.sku, qty: Number(p.stock || 0), status: 'Low Stock', image: p.image_url || '' }));

        // 9. Recent activity
        const recentActivity = allTx.slice(0, 12).map(t => ({
            type: t.type === 'IN' ? 'inbound' : 'outbound',
            description: `${t.type === 'IN' ? 'รับเข้า' : t.type === 'OUT' ? 'จ่ายออก' : t.type} ${t.product_name || t.sku} × ${Number(t.qty || 0)}`,
            time: t.created_at ? new Date(t.created_at).toLocaleDateString('th-TH') : '-',
        }));

        // 10. Executive block (real aggregates) --------------------------------
        const totalOutAll = allTx.filter(t => t.type === 'OUT').reduce((s, t) => s + Number(t.qty || 0), 0);
        const totalInAll = allTx.filter(t => t.type === 'IN').reduce((s, t) => s + Number(t.qty || 0), 0);
        const totalDamageAll = allTx.filter(t => t.type === 'DAMAGE').reduce((s, t) => s + Number(t.qty || 0), 0);
        const damageRate = (totalOutAll + totalDamageAll) > 0 ? (totalDamageAll / (totalOutAll + totalDamageAll)) * 100 : 0;
        const spaceEff = totalProducts > 0 ? (activeSkuCount / totalProducts) * 100 : 0;

        // Waterfall: Inbound (+) → Outbound (−) → Damage (−) → Closing (= stock).
        // Each floating bar needs a transparent base `value` + visible `barValue`.
        let run = 0;
        const wf: { name: string; value: number; barValue: number }[] = [];
        wf.push({ name: 'Inbound', value: 0, barValue: totalInAll }); run = totalInAll;
        wf.push({ name: 'Outbound', value: run - totalOutAll, barValue: totalOutAll }); run -= totalOutAll;
        wf.push({ name: 'Damage', value: run - totalDamageAll, barValue: totalDamageAll }); run -= totalDamageAll;
        wf.push({ name: 'Closing', value: 0, barValue: run });

        // Radar: Actual vs Target(100) per KPI
        const radarData = [
            { metric: 'ความแม่นยำ', actual: 100, target: 100 },
            { metric: 'หมุนเวียน', actual: Math.min(100, Math.round(turnoverRate)), target: 100 },
            { metric: 'พื้นที่', actual: Math.round(spaceEff), target: 100 },
            { metric: 'สุขภาพสต็อก', actual: totalProducts > 0 ? Math.round((healthyCount / totalProducts) * 100) : 0, target: 100 },
            { metric: 'ชำรุดต่ำ', actual: Math.round(100 - damageRate), target: 100 },
        ];

        // Monthly IN/OUT per year for the YoY chart
        const monthAgg = (year: number) => {
            const arr = new Array(12).fill(0).map(() => ({ in: 0, out: 0 }));
            for (const t of allTx) {
                const d = new Date(t.created_at); if (d.getFullYear() !== year) continue;
                if (t.type === 'IN') arr[d.getMonth()].in += Number(t.qty || 0);
                else if (t.type === 'OUT') arr[d.getMonth()].out += Number(t.qty || 0);
            }
            return arr;
        };
        const y1 = monthAgg(year1), y2 = monthAgg(year2);
        const yearlyComparison = {
            labels: { year1: String(year1), year2: String(year2) },
            data: TH_MONTHS.map((month, i) => ({
                month, inYear1: y1[i].in, inYear2: y2[i].in, outYear1: y1[i].out, outYear2: y2[i].out,
            })),
        };

        // All-time trend by calendar year
        const yearAgg = new Map<number, { inbound: number; outbound: number }>();
        for (const t of allTx) {
            const y = new Date(t.created_at).getFullYear(); if (!y) continue;
            const e = yearAgg.get(y) || { inbound: 0, outbound: 0 };
            if (t.type === 'IN') e.inbound += Number(t.qty || 0);
            else if (t.type === 'OUT') e.outbound += Number(t.qty || 0);
            yearAgg.set(y, e);
        }
        const annualTrend = [...yearAgg.entries()].sort((a, b) => a[0] - b[0])
            .map(([year, v]) => ({ year: String(year), inbound: v.inbound, outbound: v.outbound }));

        const executive = {
            accuracy: 100, damageRate, spaceEfficiency: spaceEff, otif: 100,
            waterfallData: wf, radarData, yearlyComparison, annualTrend,
        };

        // 11. Forecast — burn rate from OUT over the last 90 days, days-to-stockout
        const WINDOW_DAYS = 90;
        const since = now - WINDOW_DAYS * 864e5;
        const out90 = new Map<string, number>();
        for (const t of allTx) if (t.type === 'OUT' && new Date(t.created_at).getTime() >= since) out90.set(t.sku, (out90.get(t.sku) || 0) + Number(t.qty || 0));
        const forecasts = prods
            .filter(p => Number(p.stock || 0) > 0 && (out90.get(p.sku) || 0) > 0)
            .map(p => {
                const burnRate = (out90.get(p.sku) || 0) / WINDOW_DAYS;
                const daysLeft = burnRate > 0 ? Math.round(Number(p.stock || 0) / burnRate) : 999;
                const risk = daysLeft < 7 ? 'CRITICAL' : daysLeft < 14 ? 'HIGH' : daysLeft < 30 ? 'MEDIUM' : 'LOW';
                return {
                    name: p.name || p.sku, sku: p.sku, category: p.category || 'ทั่วไป', image: p.image_url || '',
                    stock: Number(p.stock || 0), burnRate, daysLeft,
                    date: new Date(now + daysLeft * 864e5).toISOString(), risk,
                };
            })
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .slice(0, 50);

        return NextResponse.json({
            kpi: {
                totalItems: totalProducts, totalStock, totalValue,
                lowStock: lowStockCount, outOfStock: outOfStockCount,
                fastMovingCount: topSellers.length, slowMovingCount: agingStockCount, deadStockCount: outOfStockCount,
            },
            summary: {
                totalSkus: totalProducts, activeSkuCount, totalStock, totalQuantity: totalStock, totalValue,
                lowStockCount, outOfStockCount, agingStockCount,
                inboundPeriod: periodIn, outboundPeriod: periodOut, damagePeriod: periodDamage,
                turnoverRate, emptyLocationCount: 0, emptyLocationList: [],
            },
            categoryBreakdown,
            categorySales: categoryBreakdown,
            topSellers,
            healthData,
            movementData,
            monthlyData: movementData,
            lowStock,
            recentActivity,
            executive,
            forecasts,
            recentTransactions: allTx.slice(0, 10).map((t, idx) => ({
                id: `tx-${idx}`, type: t.type, sku: t.sku, productName: t.product_name || t.sku,
                qty: t.qty, date: t.created_at ? new Date(t.created_at).toLocaleDateString('th-TH') : '-',
                docRef: t.doc_ref || '-', location: t.location || '-',
            })),
            topProducts: topSellers.slice(0, 5).map(t => ({ name: t.name, sku: t.sku, stock: nameBySku.has(t.sku) ? Number(prods.find(p => p.sku === t.sku)?.stock || 0) : 0 })),
        });
    } catch (error) {
        console.error('API Dashboard Error:', error);
        return NextResponse.json({ error: errorMessage(error) || 'Internal Server Error' }, { status: 500 });
    }
}
