-- Ejecutar en Supabase SQL Editor con el rol postgres.
-- Solo consulta metadatos: no modifica permisos ni lee registros de clientes.
select jsonb_pretty(jsonb_build_object(
  'tabla_roles_existe', to_regclass('public.dashboard_user_roles') is not null,
  'relaciones', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'nombre', c.relname,
      'tipo', c.relkind,
      'rls', c.relrowsecurity,
      'opciones', c.reloptions,
      'anon_select', has_any_column_privilege('anon', c.oid, 'SELECT'),
      'anon_insert', has_any_column_privilege('anon', c.oid, 'INSERT'),
      'anon_update', has_any_column_privilege('anon', c.oid, 'UPDATE'),
      'anon_delete', has_table_privilege('anon', c.oid, 'DELETE'),
      'authenticated_select', has_any_column_privilege('authenticated', c.oid, 'SELECT'),
      'authenticated_insert', has_any_column_privilege('authenticated', c.oid, 'INSERT'),
      'authenticated_update', has_any_column_privilege('authenticated', c.oid, 'UPDATE'),
      'authenticated_delete', has_table_privilege('authenticated', c.oid, 'DELETE')
    ) order by c.relname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  ),
  'politicas', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'esquema', schemaname, 'tabla', tablename, 'nombre', policyname,
      'tipo', permissive, 'roles', roles, 'operacion', cmd,
      'using', qual, 'with_check', with_check
    ) order by schemaname, tablename, policyname), '[]'::jsonb)
    from pg_policies where schemaname in ('public', 'storage')
  ),
  'buckets', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'publico', public
    ) order by id), '[]'::jsonb) from storage.buckets
  ),
  'funciones_privilegiadas', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'esquema', n.nspname, 'nombre', p.proname,
      'argumentos', oidvectortypes(p.proargtypes),
      'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) order by n.nspname, p.proname), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
  )
)) as diagnostico;
