-- Row Level Security untuk Supabase Data API. Hanya dijalankan bila skema auth Supabase tersedia
-- (di PGlite/Postgres biasa dilewati). Koneksi server (role postgres) mem-bypass RLS; otorisasi server tetap wajib.
DO $outer$
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN RETURN; END IF;
  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION public.current_role_code() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
      'SELECT r.role_code FROM public.users u JOIN public.roles r ON r.id_roles = u.id_roles WHERE u.id_users = (SELECT auth.uid()) AND u.is_active';
    REVOKE ALL ON FUNCTION public.current_role_code() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.current_role_code() TO authenticated;
  $sql$;
END $outer$;--> statement-breakpoint
DO $outer$
DECLARE t text; grp record;
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN RETURN; END IF;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_\_%' ESCAPE '\' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', t);
  END LOOP;
  EXECUTE 'REVOKE ALL ON public.stock_balances FROM anon';
  FOR grp IN SELECT * FROM (VALUES
    ('roles', ARRAY['admin','purchasing','finance','owner']),
    ('categories', ARRAY['admin','purchasing','finance','owner']), ('units', ARRAY['admin','purchasing','finance','owner']),
    ('materials', ARRAY['admin','purchasing','finance','owner']), ('products', ARRAY['admin','purchasing','finance','owner']),
    ('recipes', ARRAY['admin','purchasing','owner']), ('suppliers', ARRAY['admin','purchasing','finance','owner']),
    ('supplier_materials', ARRAY['admin','purchasing','owner']),
    ('stock_movements', ARRAY['admin','purchasing','owner']), ('stock_opnames', ARRAY['admin','owner']), ('stock_opname_items', ARRAY['admin','owner']),
    ('purchase_requests', ARRAY['admin','purchasing','owner']), ('pr_items', ARRAY['admin','purchasing','owner']),
    ('approvals', ARRAY['purchasing','finance','owner']),
    ('supplier_quotations', ARRAY['purchasing','owner']), ('quotation_items', ARRAY['purchasing','owner']),
    ('scoring_parameters', ARRAY['purchasing','owner']), ('scoring_parameter_history', ARRAY['owner']),
    ('purchase_orders', ARRAY['admin','purchasing','finance','owner']), ('po_items', ARRAY['admin','purchasing','finance','owner']),
    ('goods_receipts', ARRAY['admin','purchasing','finance','owner']), ('gr_items', ARRAY['admin','purchasing','finance','owner']),
    ('supplier_invoices', ARRAY['finance','owner']), ('invoice_items', ARRAY['finance','owner']), ('payments', ARRAY['finance','owner']),
    ('budgets', ARRAY['finance','owner']), ('expenses', ARRAY['finance','owner']),
    ('sales_transactions', ARRAY['admin','finance','owner']), ('sales_items', ARRAY['admin','finance','owner']), ('sales_import_batches', ARRAY['admin','owner']),
    ('audit_logs', ARRAY['admin','owner']), ('app_settings', ARRAY['admin','finance','owner'])
  ) AS v(tbl, allowed) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_select_' || grp.tbl, grp.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_role_code() = ANY (%L::text[]))', 'rls_select_' || grp.tbl, grp.tbl, grp.allowed);
  END LOOP;
  DROP POLICY IF EXISTS rls_select_users ON public.users;
  CREATE POLICY rls_select_users ON public.users FOR SELECT TO authenticated
    USING (id_users = (SELECT auth.uid()) OR public.current_role_code() IN ('admin','owner'));
END $outer$;
