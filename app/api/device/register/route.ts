import { NextResponse } from 'next/server';
import { registerDeviceToken } from '@/lib/data/wms';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { token, platform } = await request.json();
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const status = await registerDeviceToken(token, platform || 'unknown');
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Device Register Error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
