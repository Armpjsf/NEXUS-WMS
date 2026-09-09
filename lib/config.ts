// Production URL on Vercel
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://wms-360-pro.vercel.app'; 

export const getApiUrl = (path: string) => {
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    if (typeof window !== 'undefined') {
        // Only compiled native mobile apps (Capacitor iOS/Android) need absolute URL
        // because native apps are served from capacitor:// or file:// protocol
        const win = window as any;
        const isNativeCapacitor = Boolean(
            win.Capacitor && 
            typeof win.Capacitor.isNativePlatform === 'function' && 
            win.Capacitor.isNativePlatform()
        );

        if (isNativeCapacitor) {
            return `${API_BASE_URL}${cleanPath}`;
        }

        // Web browsers (whether localhost, LAN IP like 192.168.x.x, or public domain):
        // ALWAYS use relative path so requests stay on the same origin/port without CORS issues!
        return cleanPath;
    }

    // Default: Relative Path
    return cleanPath;
};
