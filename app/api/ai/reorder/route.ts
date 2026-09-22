// app/api/ai/reorder/route.ts
import { NextResponse } from 'next/server';
import { getProductsUncached } from '@/lib/data/wms';
import { calculateTrend, calculateSafetyStock } from '@/lib/forecast';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SLOTTING_WINDOW_DAYS = 90;
const PAGE = 1000;

async function getRecentOutbound(orgId: string): Promise<any[]> {
  const admin = getServiceSupabase();
  const since = new Date(Date.now() - SLOTTING_WINDOW_DAYS * 864e5).toISOString();
  const rows: any[] = [];

  for (let from = 0; from < 10000; from += PAGE) {
    const { data, error } = await admin
      .from('stock_transactions')
      .select('sku, product_name, qty, type, created_at')
      .eq('org_id', orgId)
      .eq('type', 'OUT')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) break;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  // Fallback: If no recent movements in 90 days, fetch the latest OUT transactions
  if (rows.length === 0) {
    const { data } = await admin
      .from('stock_transactions')
      .select('sku, product_name, qty, type, created_at')
      .eq('org_id', orgId)
      .eq('type', 'OUT')
      .order('created_at', { ascending: false })
      .limit(3000);
    if (data) rows.push(...data);
  }

  return rows;
}

export async function GET() {
  try {
    const orgId = await getCurrentOrgId();

    // 1. Fetch Products & History in Parallel
    const [products, outboundTxs] = await Promise.all([
      getProductsUncached(),
      getRecentOutbound(orgId)
    ]);
    
    if (!products || products.length === 0) return NextResponse.json([]);

    // 2. Build fast lookup maps for flexible SKU/Name resolution
    const productById = new Map<string, any>();
    const productByName = new Map<string, any>();

    products.forEach(p => {
      if (p.id) productById.set(String(p.id).trim().toLowerCase(), p);
      if ((p as any).sku) productById.set(String((p as any).sku).trim().toLowerCase(), p);
      if (p.name) productByName.set(String(p.name).trim().toLowerCase(), p);
    });

    // 3. Process History: Group by Product -> Daily Usage
    const productUsage = new Map<string, { date: string; qty: number }[]>();
    products.forEach(p => productUsage.set(p.id, []));

    outboundTxs.forEach((tx: any) => {
      const txSku = String(tx.sku || '').trim().toLowerCase();
      const txName = String(tx.product_name || tx.product || '').trim().toLowerCase();
      const matched = productById.get(txSku) || productByName.get(txName) || productByName.get(txSku) || productById.get(txName);
      if (matched) {
        productUsage.get(matched.id)?.push({
          date: tx.created_at || tx.date,
          qty: Number(tx.qty || 0)
        });
      }
    });

    const suggestions = [];
    const today = new Date();
    
    for (const p of products) {
      const usageEvents = productUsage.get(p.id) || [];
      usageEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Create daily bucket map
      const dailyMap = new Map<string, number>();
      usageEvents.forEach(e => {
        const key = typeof e.date === 'string' ? e.date.split('T')[0] : '';
        if (key) {
          const current = dailyMap.get(key) || 0;
          dailyMap.set(key, current + e.qty);
        }
      });

      // Fill last 30 days
      const dailyUsage: number[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dailyUsage.push(dailyMap.get(key) || 0);
      }

      // --- CORE AI LOGIC ---
      const trend = calculateTrend(dailyUsage);
      const safetyStock = calculateSafetyStock(dailyUsage);
      
      const currentStock = Number(p.stock || 0);
      const minStock = Number(p.minStock || 10);
      
      // Dynamic Reorder Point:
      // ROP = (Average Daily Usage * Lead Time) + Safety Stock
      // Lead Time: Assume 7 days
      const avgDaily = dailyUsage.reduce((a, b) => a + b, 0) / 30;
      const predictedDaily = trend.prediction > 0 ? trend.prediction : avgDaily;
      const cleanupDaily = Math.max(avgDaily, predictedDaily);
      
      const dynamicROP = Math.ceil((cleanupDaily * 7) + safetyStock);
      const effectiveMin = Math.max(minStock, dynamicROP); // Respect manual min if higher

      // Decision Logic & Urgency Scoring
      let confidence = 0;
      let reason = "";

      if (currentStock <= 0) {
        confidence = 100;
        reason = "วิกฤต: สินค้าหมดสต็อก (Out of Stock)";
      } else if (currentStock <= effectiveMin) {
        const boost = trend.slope > 0.1 ? 10 : 0;
        confidence = Math.min(95, 85 + boost);
        reason = trend.slope > 0.1 
          ? `วิกฤต: สต็อกต่ำและแนวโน้มการเบิกเพิ่มขึ้น (+${trend.growthRate.toFixed(1)}%)`
          : `ต้องสั่งซื้อเพิ่ม: สต็อกคงเหลือต่ำกว่าเกณฑ์ (${currentStock} / ${effectiveMin})`;
      } else if (trend.trend === 'UP' && currentStock < effectiveMin * 1.8) {
        confidence = 70;
        reason = `คำแนะนำ: มีอัตราการเบิกเติบโตต่อเนื่อง (+${trend.growthRate.toFixed(1)}%) แนะนำสั่งซื้อล่วงหน้า`;
      } else if (cleanupDaily > 0 && currentStock < effectiveMin * 1.5) {
        confidence = 65;
        reason = `คำแนะนำ: มีการเบิกใช้เฉลี่ยวันละ ${cleanupDaily.toFixed(1)} ชิ้น ควรเตรียมสั่งซื้อรอบถัดไป`;
      }

      if (confidence >= 50) {
        let suggest = 0;
        if (cleanupDaily > 0) {
          const targetDays = 30; // Aim to cover 30 days
          const targetQty = Math.ceil(cleanupDaily * targetDays) + safetyStock;
          suggest = Math.max(0, targetQty - currentStock);
        }

        // Crucial replenish safety net:
        // If stock is below min, ensure order brings stock up to a safe buffer
        if (currentStock <= effectiveMin) {
          const safeTarget = Math.max(effectiveMin * 2, minStock * 2, 10);
          suggest = Math.max(suggest, safeTarget - currentStock);
        }

        if (suggest > 0) {
          suggestions.push({
            id: p.id,
            name: p.name,
            currentStock,
            minStock: effectiveMin,
            price: Number(p.price || 0),
            img: p.image,
            confidence: Math.min(100, Math.round(confidence)),
            reason,
            suggestedQty: suggest,
            sparkline: dailyUsage.slice(-7).join(','),
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
    console.error('Error in AI Reorder:', error);
    return NextResponse.json({ error: 'Failed to generate AI suggestions' }, { status: 500 });
  }
}

// Vercel: allow up to 60s
export const maxDuration = 60;
