import type { Metadata } from "next";
import { Prompt, Outfit } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import PushNotificationManager from "@/components/PushNotificationManager";
import LocalNotificationManager from "@/components/LocalNotificationManager";
import NotificationInitializer from "@/components/NotificationInitializer";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import OfflineIndicator from "@/components/OfflineIndicator";

import Providers from "@/components/Providers";

const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

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
export const viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning={true}
        className={`${prompt.variable} ${outfit.variable} antialiased`}
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
