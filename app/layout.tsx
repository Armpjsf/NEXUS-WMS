import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import PushNotificationManager from "@/components/PushNotificationManager";
import LocalNotificationManager from "@/components/LocalNotificationManager";
import NotificationInitializer from "@/components/NotificationInitializer";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import OfflineIndicator from "@/components/OfflineIndicator";

import Providers from "@/components/Providers";

const FALLBACK_BASE_URL = 'https://nexus-wms.vercel.app';

const getBaseUrl = () => {
  const nextauth = process.env.NEXTAUTH_URL?.trim();
  if (nextauth) return nextauth;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`;
  return FALLBACK_BASE_URL;
};

// Never throw at module-evaluation time: an invalid/empty base URL here crashes
// the whole build during prerender (e.g. /_not-found → "TypeError: Invalid URL").
const getMetadataBase = () => {
  try {
    return new URL(getBaseUrl());
  } catch {
    return new URL(FALLBACK_BASE_URL);
  }
};

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "NEXUS WMS | Smart Warehouse Management System",
  description: "Next-Gen Smart Warehouse Management & Logistics Execution System",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/nexus-icon.png?v=3", type: "image/png" },
      { url: "/favicon.ico?v=3", sizes: "any" }
    ],
    shortcut: "/nexus-icon.png?v=3",
    apple: "/nexus-icon.png?v=3",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NEXUS WMS",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#171c23",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Chivo:wght@400;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@300..800&family=Prompt:wght@300;400;500;600;700;800;900&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body
        suppressHydrationWarning={true}
        className="bg-[#0f141b] text-[#dee2ec] font-sans antialiased"
      >
        <Providers>
            <PushNotificationManager />
            <LocalNotificationManager />
            <NotificationInitializer />
            <KeyboardShortcuts />
            <OfflineIndicator />
            <AppShell>
              {children}
            </AppShell>
        </Providers>
      </body>
    </html>
  );
}
