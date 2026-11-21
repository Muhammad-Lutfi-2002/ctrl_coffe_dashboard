-- Pindahkan helper RLS ke skema private (tidak terekspos Data API) dan cabut EXECUTE yang tidak perlu.
DO $outer$
DECLARE p record; newq text;
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN RETURN; END IF;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS private';
  EXECUTE 'REVOKE ALL ON SCHEMA private FROM PUBLIC, anon';
  EXECUTE 'GRANT USAGE ON SCHEMA private TO authenticated';
  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION private.current_role_code() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
      'SELECT r.role_code FROM public.users u JOIN public.roles r ON r.id_roles = u.id_roles WHERE u.id_users = (SELECT auth.uid()) AND u.is_active';
    REVOKE ALL ON FUNCTION private.current_role_code() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION private.current_role_code() TO authenticated;
  $sql$;
  FOR p IN SELECT schemaname, tablename, policyname, qual FROM pg_policies WHERE schemaname = 'public' AND qual LIKE '%current_role_code%' LOOP
    newq := regexp_replace(p.qual, '(public\.)?current_role_code\(\)', 'private.current_role_code()', 'g');
    EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', p.policyname, p.schemaname, p.tablename, newq);
  END LOOP;
  EXECUTE 'DROP FUNCTION IF EXISTS public.current_role_code()';
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END $outer$;
