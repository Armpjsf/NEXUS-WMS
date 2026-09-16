import { NextResponse } from 'next/server';
import { getLPNList, createLPN } from '@/lib/lpnEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const list = await getLPNList();
    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lpn = await createLPN(body);
    return NextResponse.json({ success: true, data: lpn });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}