import { NextResponse } from 'next/server';
import { getOrg, updateOrg, DEFAULT_ORG } from '@/lib/data/org';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const org = await getOrg(DEFAULT_ORG);
    return NextResponse.json(org || { name: 'NEXUS WMS', brandingColor: '#06b6d4', brandingLogo: '/nexus-icon.png' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const org = await updateOrg(DEFAULT_ORG, body);
    if (!org) return NextResponse.json({ error: 'อัปเดตองค์กรไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, org });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
