-- =============================================================================
-- PERMISOS TTHH — 012 · Cierra escalamiento de privilegios en `permisos_perfiles_th`
--
-- Hallazgo: la policy `permisos_perfiles_th` permitía a un `analista_th` o
-- `gerente_th` actualizar CUALQUIER columna de CUALQUIER perfil, incluida
-- `rol`. Un `analista_th` podía otorgarse a sí mismo el rol `administrador`.
--
-- Talento Humano sigue pudiendo validar perfiles (área, cargo, coordinador,
-- documento, estado), pero ya no puede tocar `rol`. Asignar roles de
-- coordinador/analista_th/gerente_th/administrador queda exclusivamente en
-- manos del administrador (`permisos_perfiles_admin`), ejercido desde el
-- módulo de Administración.
-- =============================================================================

create or replace function public.permisos_rol_de(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.permisos_perfiles where user_id = p_user_id;
$$;

revoke all on function public.permisos_rol_de(uuid) from public, anon;
grant execute on function public.permisos_rol_de(uuid) to authenticated;

drop policy if exists permisos_perfiles_th on public.permisos_perfiles;
create policy permisos_perfiles_th on public.permisos_perfiles
  for update to authenticated
  using (public.permisos_es_th())
  with check (
    public.permisos_es_th()
    and rol = public.permisos_rol_de(user_id)
  );
