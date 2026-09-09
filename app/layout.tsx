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

const getBaseUrl = () => {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://nexus-wms.vercel.app';
};

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
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
