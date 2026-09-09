import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'product-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Upload a product image to Supabase Storage and return its public URL.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const blob = file as File;
    if (!ALLOWED.includes(blob.type)) {
      return NextResponse.json({ error: 'ไฟล์ต้องเป็นรูปภาพ (jpg/png/webp/gif)' }, { status: 400 });
    }
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 5MB' }, { status: 400 });
    }

    const ext = (blob.name?.split('.').pop() || blob.type.split('/')[1] || 'jpg').toLowerCase();
    const sku = (form.get('sku') as string) || 'product';
    const safeSku = sku.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const path = `${safeSku}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await blob.arrayBuffer());
    const supabase = getServiceSupabase();

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: blob.type, upsert: true });

    if (error) {
      console.error('Supabase upload image Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl });
  } catch (error: any) {
    console.error('API upload image Error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
