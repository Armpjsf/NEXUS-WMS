import { NextResponse } from 'next/server';
import { getOrg, updateOrg } from '@/lib/data/org';
import { getCurrentOrgId, DEFAULT_ORG } from '@/lib/orgContext';
import { requireManagement, getSessionUser } from '@/lib/apiAuth';
import { canEditPlan } from '@/lib/planAdmin';
import { PLAN_LIMITS } from '@/lib/planLimits';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const org = await getOrg(orgId);
    const user = await getSessionUser().catch(() => null);
    return NextResponse.json({
      ...(org || { name: 'NEXUS WMS', brandingColor: '#2563eb', brandingLogo: '/nexus-icon.png', plan: 'FREE' }),
      canEditPlan: canEditPlan(user),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireManagement();
    if (guard.error) return guard.error;

    const orgId = guard.user.orgId || DEFAULT_ORG;
    const body = await request.json();
    const patch: { name?: string; plan?: string; brandingLogo?: string; brandingColor?: string } = {
      name: body.name, brandingLogo: body.brandingLogo, brandingColor: body.brandingColor,
    };

    if (body.plan !== undefined) {
      const current = await getOrg(orgId);
      if (body.plan !== current?.plan) {
        if (!canEditPlan(guard.user)) {
          return NextResponse.json({ error: 'เปลี่ยนแพ็กเกจได้เฉพาะผู้ดูแลแพลตฟอร์ม' }, { status: 403 });
        }
        if (!(body.plan in PLAN_LIMITS)) {
          return NextResponse.json({ error: `แพ็กเกจไม่ถูกต้อง: ${body.plan}` }, { status: 400 });
        }
        patch.plan = body.plan;
      }
    }

    const org = await updateOrg(orgId, patch);
    if (!org) return NextResponse.json({ error: 'อัปเดตองค์กรไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, org });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
