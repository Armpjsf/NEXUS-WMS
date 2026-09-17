/**
 * B1 — Next.js instrumentation. `onRequestError` is called for every uncaught
 * server error (App Router routes, RSC, route handlers), giving one central
 * place to capture + alert instead of retrofitting every try/catch.
 */
import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Loaded lazily so the edge/runtime split stays clean.
  const { captureError } = await import('@/lib/observability');
  await captureError(err, {
    where: `${(request as any)?.method || ''} ${(request as any)?.path || (request as any)?.url || ''}`.trim() || (context as any)?.routePath,
    extra: { routerKind: (context as any)?.routerKind, renderSource: (context as any)?.renderSource },
  });
};

export async function register() {
  // reserved for future init (e.g. metrics); no-op today.
}
