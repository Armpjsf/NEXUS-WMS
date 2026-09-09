import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKETS = new Set(['product-images', 'pod-images']);
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Generic image uploader to a whitelisted Supabase Storage bucket.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const bucket = (form.get('bucket') as string) || 'product-images';
    const prefix = ((form.get('prefix') as string) || 'file').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);

    if (!BUCKETS.has(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
    }
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const blob = file as File;
    if (!ALLOWED.includes(blob.type)) {
      return NextResponse.json({ error: 'ไฟล์ต้องเป็นรูปภาพ' }, { status: 400 });
    }
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 5MB' }, { status: 400 });
    }

    const ext = (blob.type.split('/')[1] || 'jpg').toLowerCase();
    const path = `${prefix}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const supabase = getServiceSupabase();

    const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType: blob.type, upsert: true });
    if (error) {
      console.error('Supabase upload Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl });
  } catch (error: any) {
    console.error('API upload Error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
