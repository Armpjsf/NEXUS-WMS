'use client';

import { useCallback, useEffect, useState } from 'react';
import { db, type PendingTransaction } from '@/lib/db';
import { toast } from 'react-hot-toast';

// Module-level lock so multiple mounted components (e.g. OfflineIndicator + OutboundPage)
// firing processQueue() concurrently cannot double-submit the same pending transaction.
let isFlushingQueue = false;

export interface OfflineSyncScope {
  orgId?: string;
  userId?: string;
}

export function shouldSyncPendingTransaction(
  item: Pick<PendingTransaction, 'orgId' | 'userId'>,
  currentScope?: OfflineSyncScope,
): boolean {
  const itemOrg = item.orgId?.trim() || '';
  const itemUser = item.userId?.trim() || '';
  const scopeOrg = currentScope?.orgId?.trim() || '';
  const scopeUser = currentScope?.userId?.trim() || '';

  if (itemOrg) {
    if (!scopeOrg || itemOrg !== scopeOrg) return false;
  } else if (scopeOrg) {
    return false;
  }

  if (itemUser) {
    if (!scopeUser || itemUser !== scopeUser) return false;
  }

  return true;
}

export async function clearOfflineDbForUser(scope?: OfflineSyncScope): Promise<void> {
  if (!scope?.orgId && !scope?.userId) {
    await db.pendingTransactions.clear();
    await db.products.clear();
    return;
  }
  const pending = await db.pendingTransactions.toArray();
  const toDelete = pending
    .filter((item) => (!scope.orgId || item.orgId === scope.orgId) && (!scope.userId || item.userId === scope.userId))
    .map((item) => item.id!)
    .filter((id) => typeof id === 'number');
  if (toDelete.length > 0) {
    await db.pendingTransactions.bulkDelete(toDelete);
  }
  if (scope.orgId) {
    await db.products.where('orgId').equals(scope.orgId).delete();
  }
}

export function useOfflineSync(currentScope?: OfflineSyncScope) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const scopeOrg = currentScope?.orgId?.trim() || '';
  const scopeUser = currentScope?.userId?.trim() || '';

  // 2. Process the Queue (Push to Cloud) with tenant + user re-authorization
  const processQueue = useCallback(async () => {
    if (!navigator.onLine || isFlushingQueue) return;

    isFlushingQueue = true;
    try {
      const pendingItems = await db.pendingTransactions.where('status').equals('PENDING').toArray();
      const authorizedItems = pendingItems.filter((item) =>
        shouldSyncPendingTransaction(item, { orgId: scopeOrg, userId: scopeUser }),
      );
      if (authorizedItems.length === 0) return;

      setIsSyncing(true);
      let successCount = 0;

      for (const item of authorizedItems) {
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
  }, [scopeOrg, scopeUser]);

  // 1. Monitor Network Status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(async () => {
      const items = await db.pendingTransactions.where('status').equals('PENDING').toArray();
      const count = items.filter((item) =>
        shouldSyncPendingTransaction(item, { orgId: scopeOrg, userId: scopeUser }),
      ).length;
      setPendingCount(count);
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [processQueue, scopeOrg, scopeUser]);

  // 3. Cache Data (Pull from Cloud)
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
            orgId: scopeOrg || p.org_id || undefined,
            name: p.name,
            category: p.category,
            price: p.price,
            stock: p.stock,
            image: p.image,
            updatedAt: Date.now(),
          })),
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
