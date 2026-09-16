import { NextResponse } from 'next/server';
import { getProductivityAnalytics } from '@/lib/productivityEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const analytics = getProductivityAnalytics();
    return NextResponse.json({ success: true, data: analytics });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}