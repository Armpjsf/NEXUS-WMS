'use client';

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

import GlobalNotificationProvider from "@/components/providers/GlobalNotificationProvider";
import { LanguageProvider } from './providers/LanguageProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
        <LanguageProvider>
          <GlobalNotificationProvider>
              {children}
              {/* Global toast host — without this, every toast() call in the app
                  (dispatch, customer CRUD, ...) fires but renders nothing. */}
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 3500,
                  style: { fontFamily: 'var(--font-prompt), sans-serif', fontSize: '14px', fontWeight: 600 },
                  success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
                  error: { duration: 5000 },
                }}
              />
          </GlobalNotificationProvider>
        </LanguageProvider>
    </SessionProvider>
  );
}
