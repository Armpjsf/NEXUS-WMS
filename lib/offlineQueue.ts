// Namespaced localStorage-backed offline queue for critical warehouse actions.
// Isolated by orgId + userId and re-authorized on flush so queued actions
// from User A / Tenant A can never replay under User B / Tenant B's session.

export interface OfflineQueueScope {
  orgId: string;
  userId: string;
}

export interface QueuedAction {
  id: string;
  /** API path, e.g. '/api/orders/ready' */
  path: string;
  body: any;
  ts: number;
  orgId?: string;
  userId?: string;
}

const LEGACY_KEY = 'wms_offline_queue_v1';

export function getOfflineQueueKey(scope?: Partial<OfflineQueueScope>): string {
  const orgId = scope?.orgId?.trim();
  const userId = scope?.userId?.trim();
  if (orgId && userId) {
    return `wms_offline_queue_v2:${orgId}:${userId}`;
  }
  return 'wms_offline_queue_v2:unscoped:unscoped';
}

export function canReplayQueuedAction(
  action: QueuedAction,
  currentScope?: Partial<OfflineQueueScope>,
): boolean {
  const activeOrg = currentScope?.orgId?.trim();
  const activeUser = currentScope?.userId?.trim();
  if (!activeOrg || !activeUser) {
    return false;
  }
  return action.orgId === activeOrg && action.userId === activeUser;
}

export function readQueue(scope?: Partial<OfflineQueueScope>): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(getOfflineQueueKey(scope)) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedAction[], scope?: Partial<OfflineQueueScope>) {
  localStorage.setItem(getOfflineQueueKey(scope), JSON.stringify(q));
}

export function enqueue(path: string, body: any, scope?: OfflineQueueScope) {
  const q = readQueue(scope);
  q.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    path,
    body,
    ts: Date.now(),
    orgId: scope?.orgId?.trim(),
    userId: scope?.userId?.trim(),
  });
  writeQueue(q, scope);
}

export function queueLength(scope?: Partial<OfflineQueueScope>): number {
  return readQueue(scope).length;
}

export function clearOfflineStateOnLogout(scope?: Partial<OfflineQueueScope>): void {
  try {
    if (scope?.orgId && scope?.userId) {
      localStorage.removeItem(getOfflineQueueKey(scope));
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Replay queued actions in order. Re-authorizes every queued item against
 * `currentScope` so actions created by another user or tenant are quarantined
 * and never sent under the wrong session.
 */
export async function flushQueue(
  getUrl: (path: string) => string,
  currentScope?: OfflineQueueScope,
): Promise<number> {
  if (!currentScope?.orgId?.trim() || !currentScope?.userId?.trim()) {
    return 0;
  }

  let q = readQueue(currentScope);
  let sent = 0;
  const quarantined: QueuedAction[] = [];

  while (q.length > 0) {
    const action = q[0];
    if (!canReplayQueuedAction(action, currentScope)) {
      // Hold cross-session/unscoped item aside; NEVER replay under active session
      quarantined.push(action);
      q = q.slice(1);
      writeQueue([...quarantined, ...q], currentScope);
      continue;
    }

    try {
      const res = await fetch(getUrl(action.path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      break; // still offline or server error — retry later
    }
    q = q.slice(1);
    writeQueue([...quarantined, ...q], currentScope);
    sent++;
  }
  return sent;
}
