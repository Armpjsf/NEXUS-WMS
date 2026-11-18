import { NextResponse } from 'next/server';
import { getProducts, getCycleCountLogs } from '@/lib/data/wms';
import { detectAnomalies } from '@/lib/anomaly';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const guard = await requireAuth();
    if (guard.error) return guard.error;
    const orgId = guard.user.orgId;

    const [products, cycleCounts] = await Promise.all([
      getProducts(),
      getCycleCountLogs(),
    ]);

    const logs = cycleCounts.map(c => ({
      id: c.product_name + c.count_date,
      type: 'CYCLE_COUNT',
      date: c.count_date,
      product_name: c.product_name,
      variance: c.variance,
      system_qty: c.system_qty,
    }));

    const anomalies = detectAnomalies(products, logs);

    const criticalCount = anomalies.filter(a => a.type === 'CRITICAL').length;
    const warningCount = anomalies.filter(a => a.type === 'WARNING').length;

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
        }, { tag: 'Anomaly', orgId });
      } catch (fcmErr) {
        console.error('[Anomaly] FCM Failed:', fcmErr);
      }

      // Web Push — PWA
      try {
        const { sendWebPush } = await import('@/lib/webPushSender');
        await sendWebPush({ title, body, url: '/ai/anomaly', orgId });
      } catch (wpErr) {
        console.error('[Anomaly] Web Push Failed:', wpErr);
      }
    }

    return NextResponse.json({
      total: anomalies.length,
      critical: criticalCount,
      warning: warningCount,
      issues: anomalies,
    });
  } catch (error) {
    console.error('Error in Anomaly Detection:', error);
    return NextResponse.json({ error: 'Failed to detect anomalies' }, { status: 500 });
  }
}

export const maxDuration = 60;
