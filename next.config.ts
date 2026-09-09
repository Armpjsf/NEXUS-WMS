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
});

const nextConfig: any = {
  output: isMobileBuild ? 'export' : undefined,
  images: {
    unoptimized: isMobileBuild,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default withPWA(nextConfig);
