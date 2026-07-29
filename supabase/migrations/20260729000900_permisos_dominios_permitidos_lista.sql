-- =============================================================================
-- PERMISOS TTHH — 009 · Dominios de correo permitidos
--
-- No todos los colaboradores tienen cuenta `@cacsantabarbara.co`: muchos usan
-- correo personal. Se sustituye la restricción de un único dominio por una
-- **lista configurable**, donde la lista vacía significa "cualquier dominio".
--
-- El control real de quién entra sigue siendo la validación de Talento Humano
-- (decisión D5): un usuario recién registrado queda en `pendiente_validacion`
-- y no puede crear solicitudes hasta que TH confirme su identidad, su área y
-- su jefe directo.
-- =============================================================================

delete from public.permisos_config where clave = 'dominio_permitido';

insert into public.permisos_config (clave, valor, descripcion)
values (
  'dominios_permitidos',
  '[]'::jsonb,
  'Dominios de correo que pueden auto-registrarse. Lista vacía = se acepta cualquier dominio, porque no todos los colaboradores tienen correo institucional. El filtro real es la validación de Talento Humano.'
)
on conflict (clave) do update
  set valor = excluded.valor, descripcion = excluded.descripcion;

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
    'dominios_permitidos', coalesce((
      select valor from public.permisos_config where clave = 'dominios_permitidos'
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.permisos_catalogos_registro() from public;
grant execute on function public.permisos_catalogos_registro() to anon, authenticated;
