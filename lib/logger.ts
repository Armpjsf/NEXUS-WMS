/**
 * B1 — Structured logger.
 * JSON lines in production (parseable by log tooling), readable text in dev.
 * Zero dependencies. Use instead of bare console.* so logs carry level+context.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
const isProd = process.env.NODE_ENV === 'production';

function emit(level: Level, msg: string, ctx?: Record<string, any>) {
  const rec = { t: new Date().toISOString(), level, msg, ...(ctx || {}) };
  const line = isProd ? JSON.stringify(rec) : `[${level}] ${msg}${ctx ? ' ' + JSON.stringify(ctx) : ''}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (m: string, c?: Record<string, any>) => { if (!isProd) emit('debug', m, c); },
  info: (m: string, c?: Record<string, any>) => emit('info', m, c),
  warn: (m: string, c?: Record<string, any>) => emit('warn', m, c),
  error: (m: string, c?: Record<string, any>) => emit('error', m, c),
};
