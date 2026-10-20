import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * SSRF protection: ensure the URL uses http/https and does not point to
 * loopback, private RFC1918, link-local (169.254.169.254), IPv6 local, or internal domains.
 */
function isSafePublicUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;

  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('::ffff:127.') ||
    host.startsWith('::ffff:10.') ||
    host.startsWith('::ffff:192.168.') ||
    host.startsWith('::ffff:169.254.') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    host.endsWith('.localhost')
  ) {
    return false;
  }

  // IPv4 private/loopback/link-local check
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return false;
    }
  }

  return true;
}

async function safeFetchImage(initialUrl: string, maxRedirects = 5): Promise<Response | null> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!isSafePublicUrl(currentUrl)) {
      throw new Error('Blocked unsafe URL');
    }

    const res = await fetch(currentUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isSafePublicUrl(nextUrl)) {
        throw new Error('Blocked unsafe redirect target');
      }
      currentUrl = nextUrl;
      continue;
    }

    if (res.url && !isSafePublicUrl(res.url)) {
      throw new Error('Blocked unsafe final URL');
    }

    return res;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL', { status: 400 });
  }

  if (!isSafePublicUrl(url)) {
    return new NextResponse('Forbidden URL', { status: 400 });
  }

  // Logic to extract ID and construct robust Google Drive URL
  let targetUrl = url;

  try {
    if (url.includes('lh3.googleusercontent.com')) {
      targetUrl = url;
    } else {
      let fileId: string | null = null;
      if (url.includes('/d/')) {
        fileId = url.split('/d/')[1].split('/')[0];
      } else if (url.includes('id=')) {
        fileId = url.split('id=')[1].split('&')[0];
      }

      if (fileId && /^[a-zA-Z0-9_-]+$/.test(fileId)) {
        targetUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }

    if (!isSafePublicUrl(targetUrl)) {
      return new NextResponse('Forbidden target URL', { status: 400 });
    }

    const response = await safeFetchImage(targetUrl);

    if (!response || !response.ok) {
      if (targetUrl !== url) {
        const retryRes = await safeFetchImage(url);
        if (retryRes && retryRes.ok) {
          const contentType = retryRes.headers.get('content-type') || 'image/png';
          const arrayBuffer = await retryRes.arrayBuffer();
          return new NextResponse(Buffer.from(arrayBuffer), {
            headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' },
          });
        }
      }
      return new NextResponse('Failed to fetch image', { status: 502 });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(Buffer.from(arrayBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    if (error?.message?.startsWith('Blocked unsafe')) {
      return new NextResponse('Forbidden URL', { status: 400 });
    }
    console.error('Proxy Exception:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
