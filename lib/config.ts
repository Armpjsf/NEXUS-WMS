// Absolute base only needed when the app is served from a bundled native origin
// (capacitor://, file://, ionic://). This build's APK uses a remote server.url,
// so the webview origin is the live https site and relative paths are correct.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nexus-wms-phi.vercel.app';

export const getApiUrl = (path: string) => {
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    if (typeof window !== 'undefined') {
        const proto = window.location.protocol;
        // Loaded over http/https — this includes the Capacitor webview, which points
        // at the remote https site via server.url. Same-origin relative paths hit the
        // exact site the app is running on (no CORS, no wrong-domain calls).
        if (proto === 'http:' || proto === 'https:') {
            return cleanPath;
        }
        // Bundled native origin (capacitor://, file://, ionic://) has no backend of
        // its own, so fall back to the absolute production URL.
        return `${API_BASE_URL}${cleanPath}`;
    }

    // Server-side: relative path.
    return cleanPath;
};
