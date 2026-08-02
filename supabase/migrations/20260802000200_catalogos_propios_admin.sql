-- =============================================================================
-- PERMISOS TTHH — El administrador gestiona los catálogos propios
-- =============================================================================
-- Va después de la migración de RLS porque necesita `permisos_es_admin()`.
--
-- En el proyecto compartido la condición era `is_admin() OR permisos_es_admin()`
-- —la primera mitad venía de Cambio de Turnos—. Con la separación se queda solo
-- la de Permisos: ya no hay dos aplicaciones que puedan escribir aquí.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['areas', 'cargos', 'coordinadores']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.permisos_es_admin()) with check (public.permisos_es_admin())',
      t || '_admin', t
    );
  end loop;
end;
$$;
