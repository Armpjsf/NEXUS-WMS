'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { toast } from 'react-hot-toast';

// Module-level lock so multiple mounted components (e.g. OfflineIndicator + OutboundPage)
// firing processQueue() concurrently cannot double-submit the same pending transaction.
let isFlushingQueue = false;

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // 1. Monitor Network Status
  useEffect(() => {
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
    if (!navigator.onLine || isFlushingQueue) return;

    isFlushingQueue = true;
    try {
      const pendingItems = await db.pendingTransactions.where('status').equals('PENDING').toArray();
      if (pendingItems.length === 0) return;

      setIsSyncing(true);
      let successCount = 0;

      for (const item of pendingItems) {
        const currentRetries = item.retryCount || 0;
        if (currentRetries >= 3) {
          await db.pendingTransactions.update(item.id!, { status: 'FAILED' });
          continue;
        }

        const nextRetryCount = currentRetries + 1;
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
            body: JSON.stringify(item.data),
          });

          if (res.ok) {
            await db.pendingTransactions.delete(item.id!);
            successCount++;
          } else {
            const isPermanentClientError =
              res.status === 400 || res.status === 404 || res.status === 409 || res.status === 422;
            const nextStatus = isPermanentClientError || nextRetryCount >= 3 ? 'FAILED' : 'PENDING';
            console.error(`Sync HTTP ${res.status} for item (status -> ${nextStatus}):`, item);
            await db.pendingTransactions.update(item.id!, {
              status: nextStatus,
              retryCount: nextRetryCount,
            });
          }
        } catch (error) {
          console.error('Sync Failed for item:', item, error);
          const nextStatus = nextRetryCount >= 3 ? 'FAILED' : 'PENDING';
          await db.pendingTransactions.update(item.id!, {
            status: nextStatus,
            retryCount: nextRetryCount,
          });
        }
      }

      if (successCount > 0) {
        toast.success(`Synced ${successCount} offline actions!`);
      }
    } finally {
      setIsSyncing(false);
      isFlushingQueue = false;
    }
  };

  // 3. Cache Data (Pull from Cloud) - To be called manually or on load
  const syncProducts = async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : null;
      if (list) {
        await db.products.bulkPut(
          list.map((p: any) => ({
            id: p.sku || p.id || p.name,
            name: p.name,
            category: p.category,
            price: p.price,
            stock: p.stock,
            image: p.image,
            updatedAt: Date.now(),
          }))
        );
        console.log('Offline Cache Updated');
      }
    } catch (e) {
      console.error('Cache Update Failed', e);
    }
  };

  return {
    isOnline,
    isSyncing,
    pendingCount,
    processQueue,
    syncProducts,
  };
}
