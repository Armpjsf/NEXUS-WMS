import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// Server-only. Never exposed to the browser (not NEXT_PUBLIC_), so it is
// undefined on the client and the shared client falls back to the anon key.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

// Shared client. In this codebase `supabase` is only ever imported inside
// server-side API routes, where the service-role key is present and used so
// requests bypass RLS (tenancy is enforced in the app layer). On the client
// (no service key) it degrades to the anon key — which the locked-down RLS
// policies deny table access to, closing the "public anon key reads everything"
// hole. Direct client-side table access is intentionally not supported.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  serviceRoleKey || supabaseAnonKey || 'placeholder-anon-key'
);

// Explicit service-role client (admin / bypass RLS).
export const getServiceSupabase = () => {
  const serviceKey = serviceRoleKey || supabaseAnonKey;
  return createClient(supabaseUrl || 'https://placeholder.supabase.co', serviceKey);
};
