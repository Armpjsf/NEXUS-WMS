'use client';

// Root error boundary (catches errors in the root layout itself). Must render
// its own <html>/<body>. Same self-healing reload as app/error.tsx.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const hardReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* ignore */ }
    window.location.reload();
  };

  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f6f8fb', color: '#0f172a' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>เกิดข้อผิดพลาดชั่วคราว</h2>
          <p style={{ fontSize: 14, color: '#64748b', maxWidth: 360, margin: '0 0 24px' }}>
            ระบบสะดุดเล็กน้อย (มักเกิดหลังอัปเดตเวอร์ชันใหม่) ลองโหลดหน้าใหม่อีกครั้ง
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => reset()} style={{ padding: '10px 20px', background: '#e2e8f0', color: '#1e293b', fontSize: 14, fontWeight: 700, borderRadius: 12, border: 'none' }}>
              ลองอีกครั้ง
            </button>
            <button onClick={hardReload} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 700, borderRadius: 12, border: 'none' }}>
              โหลดหน้าใหม่
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
