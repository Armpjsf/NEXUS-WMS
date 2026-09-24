import { NextResponse } from 'next/server';
import { getLPNList, createLPN } from '@/lib/lpnEngine';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const list = await getLPNList();
    return NextResponse.json({ success: true, data: list });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lpn = await createLPN(body);
    return NextResponse.json({ success: true, data: lpn });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}