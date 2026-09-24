// Single source of the NextAuth signing secret, shared by lib/auth.ts (signs the
// session JWT) and proxy.ts (decodes it). They MUST agree, so neither reads the
// env var directly.
//
// Dev / build keep a fixed fallback so local work "just runs". In a production
// runtime a missing NEXTAUTH_SECRET returns undefined instead of a well-known
// string: anyone who knows a hardcoded secret could mint an Admin session
// cookie. proxy.ts turns undefined into a 503 (fail closed).

const DEV_FALLBACK_SECRET = 'nexus-dev-only-secret-not-for-production';

export function getAuthSecret(): string | undefined {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (secret) return secret;
  const isProdRuntime =
    process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build';
  if (!isProdRuntime) return DEV_FALLBACK_SECRET;
  console.error('[auth] NEXTAUTH_SECRET is not set in production — all sessions are rejected until it is configured');
  return undefined;
}
