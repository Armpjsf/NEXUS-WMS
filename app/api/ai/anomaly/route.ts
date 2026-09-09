
import { NextResponse } from 'next/server';
import { getProducts, getCycleCountLogs } from '@/lib/data/wms';
import { detectAnomalies } from '@/lib/anomaly';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch Data in Parallel
    // We need Products for Stock/Ghost checks.
    // We need Cycle Count logs for Variance checks.
    // We might need Audit logs for Future Date checks (let's use Cycle Count + simple Logs for now)
    
    // Note: getCycleCountLogs returns records with 'count_date', 'variance', etc.
    const [products, cycleCounts] = await Promise.all([
        getProducts(),
        getCycleCountLogs(),
    ]);

    // Transform CycleCounts to generic log format expected by anomaly detector
    const logs = cycleCounts.map(c => ({
        id: c.product_name + c.count_date, // composite id
        type: 'CYCLE_COUNT',
        date: c.count_date,
        product_name: c.product_name,
        variance: c.variance,
        system_qty: c.system_qty
    }));

    // 2. Run AI Analysis
    const anomalies = detectAnomalies(products, logs);

    const criticalCount = anomalies.filter(a => a.type === 'CRITICAL').length;
    const warningCount = anomalies.filter(a => a.type === 'WARNING').length;

    // 3. Push notification if any CRITICAL anomalies found
    if (criticalCount > 0) {
        const title = `🚨 พบปัญหาคลังร้ายแรง ${criticalCount} รายการ`;
        const firstCritical = anomalies.find(a => a.type === 'CRITICAL');
        const body = firstCritical?.description || `ตรวจพบ Anomaly ${criticalCount} รายการ กรุณาตรวจสอบ`;

        // FCM — APK
        try {
            const { sendFcmToDevices } = await import('@/lib/fcmSender');
            await sendFcmToDevices({
                title,
                body,
                data: { type: 'anomaly', critical: String(criticalCount) },
            }, { tag: 'Anomaly' });
        } catch (fcmErr) {
            console.error('[Anomaly] FCM Failed:', fcmErr);
        }

        // Web Push — PWA
        try {
            const { sendWebPush } = await import('@/lib/webPushSender');
            await sendWebPush({ title, body, url: '/ai/anomaly' });
        } catch (wpErr) {
            console.error('[Anomaly] Web Push Failed:', wpErr);
        }
    }

    return NextResponse.json({
        total: anomalies.length,
        critical: criticalCount,
        warning: warningCount,
        issues: anomalies
    });

  } catch (error) {
    console.error('Error in Anomaly Detection:', error);
    return NextResponse.json({ error: 'Failed to detect anomalies' }, { status: 500 });
  }
}

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
