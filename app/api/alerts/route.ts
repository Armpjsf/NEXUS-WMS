import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getProducts, getDamageRecords } from '@/lib/data/wms';
import { getAllAlerts, getAlertSummary } from '@/lib/inAppAlerts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const allowedOwners = (session?.user as any)?.allowedOwners;
    
    // Fetch products (Filtered) and damage records (All) in parallel
    const [products, damageRecords] = await Promise.all([
      getProducts(undefined, allowedOwners),
      getDamageRecords()
    ]);

    // Generate alerts
    const alerts = getAllAlerts(products, damageRecords);
    const summary = getAlertSummary(products, damageRecords);

    return NextResponse.json({
      alerts: alerts.slice(0, 20), // Limit to 20 most recent
      summary
    });
  } catch (error) {
    console.error('[Alerts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}
