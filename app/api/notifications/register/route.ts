import { NextResponse } from 'next/server';
import { registerDeviceToken } from '@/lib/data/wms';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const status = await registerDeviceToken(token, 'unknown');
    return NextResponse.json({
      success: true,
      message: status === 'updated' ? 'Already registered' : 'Token registered',
    });
  } catch (error) {
    console.error('[PushRegister] Error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
