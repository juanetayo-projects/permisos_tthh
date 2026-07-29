-- =============================================================================
-- PERMISOS TTHH — 008 · Catálogos para el formulario de registro
--
-- Quien se registra todavía no tiene sesión, y las policies de los catálogos
-- son `to authenticated`, así que los desplegables llegaban vacíos.
--
-- En vez de abrir las tablas al rol `anon` —`areas` y `cargos` pertenecen a
-- Cambio de Turnos— se expone una única función SECURITY DEFINER que devuelve
-- solo `id` y `nombre` de lo estrictamente necesario. No revela correos,
-- coordinadores ni ningún dato de personas.
-- =============================================================================

create or replace function public.permisos_catalogos_registro()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'empresas', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by orden)
        from public.permisos_empresas where activo
    ), '[]'::jsonb),
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre)
        from public.areas where activo
    ), '[]'::jsonb),
    'cargos', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre)
        from public.cargos where activo
    ), '[]'::jsonb),
    'dominio_permitido', coalesce((
      select valor from public.permisos_config where clave = 'dominio_permitido'
    ), '"cacsantabarbara.co"'::jsonb)
  );
$$;

revoke all on function public.permisos_catalogos_registro() from public;
grant execute on function public.permisos_catalogos_registro() to anon, authenticated;

comment on function public.permisos_catalogos_registro() is
  'Catálogos mínimos para el formulario de registro público: empresas, áreas, '
  'cargos y dominio permitido. Solo id y nombre; ningún dato personal.';
