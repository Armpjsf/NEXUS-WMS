
'use client';

import { useEffect, useState } from 'react';
import { db, PendingTransaction } from '@/lib/db';
import { toast } from 'react-hot-toast';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // 1. Monitor Network Status
  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
        setIsOnline(true);
        processQueue(); // Auto-sync when back online
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Live count of pending items
    const interval = setInterval(async () => {
        const count = await db.pendingTransactions.where('status').equals('PENDING').count();
        setPendingCount(count);
    }, 2000);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        clearInterval(interval);
    };
  }, []);

  // 2. Process the Queue (Push to Cloud)
  const processQueue = async () => {
      if (!navigator.onLine) return;
      
      const pendingItems = await db.pendingTransactions.where('status').equals('PENDING').toArray();
      if (pendingItems.length === 0) return;

      setIsSyncing(true);
      let successCount = 0;

      for (const item of pendingItems) {
          try {
             // Mark as syncing to prevent double process
             await db.pendingTransactions.update(item.id!, { status: 'SYNCING' });

             let endpoint = item.endpoint || '';
             if (!endpoint) {
               if (item.type === 'INBOUND') endpoint = '/api/inbound';
               else if (item.type === 'OUTBOUND') endpoint = '/api/outbound';
               else if (item.type === 'DAMAGE') endpoint = '/api/damage';
               else if (item.type === 'CYCLE_COUNT') endpoint = '/api/cycle-count';
               else if (item.type === 'RECEIVING') endpoint = '/api/receiving';
               else if (item.type === 'ORDER') endpoint = '/api/orders';
               else if (item.type === 'RETURN') endpoint = '/api/returns';
               else endpoint = '/api/transactions';
             }

             const res = await fetch(endpoint, {
                 method: item.method || 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(item.data)
             });

             if (!res.ok) throw new Error('API Error');

             // Success: Delete from queue
             await db.pendingTransactions.delete(item.id!);
             successCount++;

          } catch (error) {
              console.error("Sync Failed for item:", item, error);
              // Revert to PENDING to retry later, maybe increment retryCount
              await db.pendingTransactions.update(item.id!, { status: 'PENDING', retryCount: (item.retryCount || 0) + 1 });
          }
      }

      setIsSyncing(false);
      if (successCount > 0) {
          toast.success(`Synced ${successCount} offline actions!`);
      }
  };

  // 3. Cache Data (Pull from Cloud) - To be called manually or on load
  const syncProducts = async () => {
      if (!navigator.onLine) return;
      try {
          const res = await fetch('/api/products'); // Requires this endpoint
          const data = await res.json();
          if (Array.isArray(data)) {
              await db.products.bulkPut(data.map((p: any) => ({
                  id: p.name, // Using Name as ID for now as per schema
                  name: p.name,
                  category: p.category,
                  price: p.price,
                  stock: p.stock,
                  image: p.image,
                  updatedAt: Date.now()
              })));
              console.log("Offline Cache Updated");
          }
      } catch (e) {
          console.error("Cache Update Failed", e);
      }
  };

  return {
      isOnline,
      isSyncing,
      pendingCount,
      processQueue,
      syncProducts
  };
}
