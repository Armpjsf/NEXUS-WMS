import { NextResponse } from 'next/server';
import { onboardOrganization } from '@/lib/data/onboarding';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Public self-service signup: create org + admin user + seed sample warehouse.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await onboardOrganization({
      orgName: body.orgName,
      slug: body.slug,
      plan: body.plan,
      adminUsername: body.adminUsername,
      adminPassword: body.adminPassword,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, username: result.username });
  } catch (error) {
    console.error('API onboarding error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
