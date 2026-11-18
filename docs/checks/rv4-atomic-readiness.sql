-- Read-only staging preflight. This does NOT apply migrations or invoke business RPCs.
-- Inspect the row for the product being deployed. All checks must be true.
-- SQL cannot prove that PostgREST's schema cache is current: also run the
-- authenticated synthetic-tenant RPC/route smoke tests before enabling traffic.
WITH expected(product, signature) AS (
  VALUES
    ('wms', 'public.apply_wms_tms_pod_target_atomic(text,text,text,text,uuid,text,integer,text,text,text,text,boolean,text,jsonb,timestamp with time zone,text,text,text,text,boolean,jsonb,boolean,timestamp with time zone)'),
    ('tms', 'public.apply_tms_job_create_atomic(text,text,text,text,uuid,text,integer,jsonb,jsonb,text,text,boolean,timestamp with time zone)')
), resolved AS (
  SELECT product, signature, to_regprocedure(signature) AS function_oid
  FROM expected
)
SELECT product,
       signature,
       function_oid IS NOT NULL AS exact_rpc_signature_present,
       to_regclass('public.integration_effect_receipts') IS NOT NULL AS receipts_table_present,
       COALESCE((
         SELECT has_function_privilege(role.oid, resolved.function_oid, 'EXECUTE')
         FROM pg_roles AS role
         WHERE role.rolname = 'service_role'
       ), FALSE) AS service_role_can_execute
FROM resolved
ORDER BY product;
