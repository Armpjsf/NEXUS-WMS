// Message of a caught value. Catch variables are `unknown` under strict mode —
// use this instead of `catch (e: any) { e.message }`.
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

export class AtomicEffectSchemaError extends Error {
  readonly code = 'ATOMIC_EFFECT_SCHEMA_MISSING';
  readonly status = 503;

  constructor() {
    super('Atomic integration schema is not ready. Verify migration 011 and refresh the RPC schema cache before retrying.');
    this.name = 'AtomicEffectSchemaError';
  }
}
