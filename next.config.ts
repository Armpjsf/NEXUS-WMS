import type { NextConfig } from "next";
import { createRequire } from 'module';

// next-auth's react client parses these env vars at module-evaluation time with
// `new URL(url ?? default)`. An EMPTY string passes the `??` guard and makes
// `new URL('')` throw `Invalid URL ('')`, crashing prerender of every page that
// mounts <SessionProvider> (build error: "Error occurred prerendering page ...").
// `undefined` is handled fine by next-auth, so strip blank values before the
// build workers (which inherit this process's env) are spawned.
for (const key of ['NEXTAUTH_URL', 'NEXTAUTH_URL_INTERNAL', 'VERCEL_URL']) {
  if (process.env[key] !== undefined && process.env[key]!.trim() === '') {
    delete process.env[key];
  }
}

const require = createRequire(import.meta.url);
const isMobileBuild = process.env.NEXT_PUBLIC_MOBILE_BUILD === 'true';

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  importScripts: ['/push-worker.js'],
  skipWaiting: true,
  // Purge stale precache after each deploy and take control immediately, so the
  // service worker never serves outdated JS chunks (which surface as a blank
  // "client-side exception" white screen after a new deploy).
  cleanupOutdatedCaches: true,
  clientsClaim: true,
});

// B3 — Security headers applied to every response (skipped for the static
// mobile export, where `headers()` isn't supported). No CSP here on purpose:
// the PWA + inline styles make a strict CSP high-risk to add blindly.
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // the app uses the camera scanner, voice picking and geolocation — allow self, deny the rest
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=()' },
];

const nextConfig: any = {
  output: isMobileBuild ? 'export' : undefined,
  images: {
    unoptimized: isMobileBuild,
  },
  turbopack: {
    root: process.cwd(),
  },
  ...(isMobileBuild ? {} : {
    async headers() {
      return [{ source: '/:path*', headers: SECURITY_HEADERS }];
    },
  }),
};

export default withPWA(nextConfig);
