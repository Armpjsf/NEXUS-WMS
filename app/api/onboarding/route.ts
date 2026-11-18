import { NextResponse } from 'next/server';
import { onboardOrganization } from '@/lib/data/onboarding';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Public self-service signup: create org + HQ branch + admin user.
// Always provisions on the FREE plan and defaults seedDemo to false (opt-in only).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await onboardOrganization({
      orgName: body.orgName,
      slug: body.slug,
      plan: 'FREE',
      adminUsername: body.adminUsername,
      adminPassword: body.adminPassword,
      seedDemo: body.seedDemo === true,
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
      resumeIfIncomplete: body.resumeIfIncomplete === true,
      legalName: typeof body.legalName === 'string' ? body.legalName : undefined,
      taxId: typeof body.taxId === 'string' ? body.taxId : undefined,
      address: typeof body.address === 'string' ? body.address : undefined,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, stepFailed: result.stepFailed, rolledBack: result.rolledBack },
        { status: 400 },
      );
    }
    return NextResponse.json({
      success: true,
      orgId: result.orgId,
      username: result.username,
      resumed: result.resumed,
      seededDemo: result.seededDemo,
    });
  } catch (error) {
    console.error('API onboarding error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
