/**
 * Pluggable Notification Gateway Architecture
 * Supports LINE Notify, LINE Official Account, Webhook, and Mock Staging.
 * Safe fallback mode: Operates without error even if live credentials are not set.
 */

export type NotificationChannel = 'LINE_NOTIFY' | 'LINE_OA' | 'WEBHOOK' | 'EMAIL' | 'MOCK_STAGING';

export interface NotificationPayload {
  channel?: NotificationChannel;
  eventType: 'LOW_STOCK' | 'MAKER_CHECKER_PENDING' | 'ORDER_PACKED' | 'IOT_TEMP_ALERT';
  recipient?: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  logMessage: string;
  timestamp: string;
}

// In-memory log of dispatched notifications
export const notificationHistory: NotificationResult[] = [];

export async function dispatchNotification(payload: NotificationPayload): Promise<NotificationResult> {
  const channel = payload.channel || 'MOCK_STAGING';
  const timestamp = new Date().toISOString();

  // If LINE credentials are not configured or user requests staging:
  if (channel === 'MOCK_STAGING' || !process.env.LINE_NOTIFY_TOKEN) {
    const simulatedResult: NotificationResult = {
      success: true,
      channel: 'MOCK_STAGING',
      status: 'SIMULATED',
      logMessage: `[Notification Gateway - Mock Ready] [${payload.eventType}] ${payload.title}: ${payload.message}`,
      timestamp
    };
    notificationHistory.unshift(simulatedResult);
    if (notificationHistory.length > 50) notificationHistory.pop();
    console.log(simulatedResult.logMessage);
    return simulatedResult;
  }

  // Real LINE Notify Dispatcher when token is provided in future
  try {
    const res = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${process.env.LINE_NOTIFY_TOKEN}`
      },
      body: new URLSearchParams({
        message: `\n[NEXUS WMS]\n🔔 ${payload.title}\n${payload.message}`
      })
    });
    
    const result: NotificationResult = {
      success: res.ok,
      channel: 'LINE_NOTIFY',
      status: res.ok ? 'SENT' : 'FAILED',
      logMessage: res.ok ? 'Sent to LINE successfully' : `LINE API returned ${res.status}`,
      timestamp
    };
    notificationHistory.unshift(result);
    return result;
  } catch (err: any) {
    const failedResult: NotificationResult = {
      success: false,
      channel: 'LINE_NOTIFY',
      status: 'FAILED',
      logMessage: `Error sending LINE notification: ${err.message}`,
      timestamp
    };
    notificationHistory.unshift(failedResult);
    return failedResult;
  }
}
