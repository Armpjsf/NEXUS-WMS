'use client';

// components/providers/GlobalNotificationProvider.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';

interface NotificationContextType {
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  sendNotification: (title: string, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  permission: 'default',
  requestPermission: async () => {},
  sendNotification: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export default function GlobalNotificationProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert("This browser does not support desktop notification");
      return;
    }

    const newPermission = await Notification.requestPermission();
    setPermission(newPermission);
    
    if (newPermission === 'granted') {
       new Notification("Notifications Enabled! 🔔", {
           body: "You will now receive alerts for low stock and important updates.",
           icon: "/icon512_rounded.png"
       });
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (permission === 'granted') {
      // PWA Service Worker (Mobile)
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
         navigator.serviceWorker.ready.then(registration => {
             registration.showNotification(title, {
                 icon: '/icon512_rounded.png',
                 badge: '/icon512_maskable.png',
                 vibrate: [200, 100, 200],
                 ...options
             } as any);
         });
      } else {
         // Desktop Fallback
         new Notification(title, {
             icon: '/icon512_rounded.png',
             ...options
         });
      }
    }
  };

  return (
    <NotificationContext.Provider value={{ permission, requestPermission, sendNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}
