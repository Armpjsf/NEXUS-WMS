import { NextResponse } from 'next/server';
import { getProductsUncached, getTransactionsUncached, getDamageRecords } from '@/lib/data/wms';
import { requireManagement } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireManagement();
  if (guard.error) return guard.error;
  try {
    const products = await getProductsUncached();
    const inbound = await getTransactionsUncached('IN');
    const outbound = await getTransactionsUncached('OUT');
    const damage = await getDamageRecords();
    
    // Create a Set of valid SKUs for fast lookup
    const validSkus = new Set(products.map(p => p.name.trim()));

    const issues: any[] = [];

    // 1. Check Dates (Legacy: "รับ/จ่าย: วันที่ผิดฟอร์แมต/ว่าง")
    // In GSheet, date might be empty string.
    inbound.forEach((t, idx) => {
        if (!t.date || isNaN(new Date(t.date).getTime())) {
            issues.push({ type: 'Date Error', source: 'Inbound', row: idx + 2, description: `Invalid Date: ${t.date}` });
        }
    });
    outbound.forEach((t, idx) => {
        if (!t.date || isNaN(new Date(t.date).getTime())) {
            issues.push({ type: 'Date Error', source: 'Outbound', row: idx + 2, description: `Invalid Date: ${t.date}` });
        }
    });

    // 2. Check SKU existence (Legacy: "SKU ไม่อยู่ในมาสเตอร์")
    inbound.forEach((t, idx) => {
        const productName = t.product?.trim();
        if (productName && !validSkus.has(productName)) {
             issues.push({ type: 'Unknown SKU', source: 'Inbound', row: idx + 2, description: `SKU not in master: ${t.product}` });
        }
    });
    outbound.forEach((t, idx) => {
        const productName = t.product?.trim();
        if (productName && !validSkus.has(productName)) {
             issues.push({ type: 'Unknown SKU', source: 'Outbound', row: idx + 2, description: `SKU not in master: ${t.product}` });
        }
    });

    // 3. Check Negative/Zero Qty (Legacy: "ปริมาณ <= 0")
    inbound.forEach((t, idx) => {
        if (t.qty <= 0) {
            issues.push({ type: 'Invalid Qty', source: 'Inbound', row: idx + 2, description: `Qty <= 0: ${t.qty}` });
        }
    });
    outbound.forEach((t, idx) => {
        if (t.qty <= 0) {
            issues.push({ type: 'Invalid Qty', source: 'Outbound', row: idx + 2, description: `Qty <= 0: ${t.qty}` });
        }
    });

    // 4. Reconcile Stock (Theoretical vs Actual)
    // Map: Product Name normalized -> Net Change (In - Out)
    const stockFlow = new Map<string, number>();

    // Init keys from products
    products.forEach(p => stockFlow.set(p.name.trim().toLowerCase(), 0));

    // Add Inbound
    inbound.forEach(t => {
        const key = t.product?.trim().toLowerCase();
        if (!key) return;
        // If product doesn't exist in master, we skip (it's already flagged as Unknown SKU)
        if (stockFlow.has(key)) {
            stockFlow.set(key, (stockFlow.get(key) || 0) + t.qty);
        }
    });

    // Subtract Outbound
    outbound.forEach(t => {
        const key = t.product?.trim().toLowerCase();
        if (!key) return;
        if (stockFlow.has(key)) {
            stockFlow.set(key, (stockFlow.get(key) || 0) - t.qty);
        }
    });

    // Subtract Damage
    damage.forEach(d => {
        const key = d.product_name.trim().toLowerCase();
        if (stockFlow.has(key)) {
            stockFlow.set(key, (stockFlow.get(key) || 0) - d.quantity);
        }
    });

    // Compare
    products.forEach((p, idx) => {
        const key = p.name.trim().toLowerCase();
        const calculated = stockFlow.get(key) || 0;
        const actual = p.stock || 0;

        // Tolerance: Floating point check? Assuming integers for now.
        // Or slight logging variations. Mismatch if diff != 0
        if (calculated !== actual) {
             const diff = actual - calculated;
             // Only flag significant mismatches logic? No, strict check.
             issues.push({ 
                 type: 'Stock Mismatch', 
                 source: 'Reconciliation', 
                 row: idx + 2, // Row in Master Sheet
                 description: `${p.name}: Sheet=${actual} vs Log=${calculated} (Diff: ${diff > 0 ? '+' : ''}${diff})` 
             });
        }
    });

    return NextResponse.json({ 
        totalIssues: issues.length,
        issues 
    });

  } catch (error: any) {
    console.error("Data Quality API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
