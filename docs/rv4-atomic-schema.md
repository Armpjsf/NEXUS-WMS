# Atomic integration schema enforcement (RV4-01)

This branch includes the existing SaaS/tenant/integration prerequisites needed by RV4-01. It deliberately excludes the in-progress TMS navigation redesign and the unrelated WMS 3D workflow note.

Event-backed WMS writes and idempotency-keyed TMS requests require migration 011 atomic RPCs. Missing/inaccessible RPC or malformed response returns HTTP 503 with ATOMIC_EFFECT_SCHEMA_MISSING. There is no non-atomic fallback for these requests. TMS releases its quota reservation on failure.

Install and verify existing migration 011 and its prerequisites before routing traffic to the new request paths. Use docs/checks/rv4-atomic-readiness.sql as a read-only database preflight, then verify actual PostgREST schema-cache visibility, grants and authenticated synthetic-tenant routes on staging. No migration or deployment is performed by this branch.

Before packaging, the isolated default suites passed (WMS 66 tests, TMS 50 tests), both TypeScript checks and changed-file lint passed, and WMS org-scope passed. The pushed worktree is verified separately; test counts may differ because unrelated concurrent UI tests are excluded. True multi-session PostgreSQL tests, DB+Storage restore, physical-device testing and owner UAT remain release gates.

No live environment values, credentials or customer data are included.

Packaged branch verification (2026-11-18): WMS default suite 66/66 passed; TypeScript --noEmit --incremental false passed; staged whitespace check passed. WMS org-scope passed (52 allowlisted). No live database or deployment action was performed.
