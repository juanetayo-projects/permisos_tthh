-- =============================================================================
-- PERMISOS TTHH — 017 · La bandeja sigue al jefe elegido en la solicitud
--
-- ⚠️ Cierra un hueco que dejó la migración del formulario.
--
-- El formulario ya permite elegir explícitamente el jefe directo que debe
-- autorizar, porque un colaborador puede haber cambiado de servicio. Pero las
-- policies resolvían la visibilidad **solo por área**, así que la solicitud
-- seguía cayendo en la bandeja de quien coordina esa área, no en la del jefe
-- elegido. El campo se guardaba y no servía para nada.
--
-- Se añade el reconocimiento por `coordinador_id`, manteniendo el criterio por
-- área para no dejar huérfanas las solicitudes sin jefe asignado.
-- =============================================================================

create or replace function public.permisos_coordinador_ids()
returns setof integer
language sql
stable
security definer
set search_path = public
as $$
  select c.id
    from public.coordinadores c
    join public.permisos_perfiles p on lower(p.correo) = lower(c.correo)
   where p.user_id = auth.uid() and c.activo;
$$;

revoke all on function public.permisos_coordinador_ids() from public, anon;
grant execute on function public.permisos_coordinador_ids() to authenticated;

comment on function public.permisos_coordinador_ids() is
  'IDs de coordinador que corresponden al usuario actual, emparejados por correo.';

create or replace function public.permisos_es_jefe_de(p_coordinador_id integer, p_area_id integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_coordinador_id in (select public.permisos_coordinador_ids()), false)
      or public.permisos_coordina_area(p_area_id);
$$;

revoke all on function public.permisos_es_jefe_de(integer, integer) from public, anon;
grant execute on function public.permisos_es_jefe_de(integer, integer) to authenticated;

drop policy if exists permisos_solicitudes_select on public.permisos_solicitudes;
create policy permisos_solicitudes_select on public.permisos_solicitudes
  for select to authenticated
  using (
    deleted_at is null
    and (
      solicitante_id = auth.uid()
      or public.permisos_es_jefe_de(coordinador_id, area_id)
      or public.permisos_es_th()
    )
  );

drop policy if exists permisos_solicitudes_update_coordinador on public.permisos_solicitudes;
create policy permisos_solicitudes_update_coordinador on public.permisos_solicitudes
  for update to authenticated
  using (public.permisos_es_jefe_de(coordinador_id, area_id))
  with check (public.permisos_es_jefe_de(coordinador_id, area_id));
