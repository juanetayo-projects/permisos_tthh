-- =============================================================================
-- PERMISOS TTHH — 004 · Row Level Security
-- Las funciones auxiliares son SECURITY DEFINER a propósito: consultan
-- permisos_perfiles saltándose RLS y así evitan la recursión infinita que se
-- produce cuando una policy sobre una tabla consulta esa misma tabla.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funciones auxiliares
-- -----------------------------------------------------------------------------
create or replace function public.permisos_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol
    from public.permisos_perfiles
   where user_id = auth.uid() and deleted_at is null and activo
   limit 1;
$$;

create or replace function public.permisos_es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.permisos_rol() = 'administrador', false);
$$;

create or replace function public.permisos_es_th()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.permisos_rol() in ('analista_th', 'gerente_th', 'administrador'), false);
$$;

create or replace function public.permisos_es_gerente_th()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.permisos_rol() in ('gerente_th', 'administrador'), false);
$$;

create or replace function public.permisos_perfil_activo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.permisos_perfiles
     where user_id = auth.uid() and estado = 'activo' and activo and deleted_at is null
  );
$$;

-- Áreas que coordina el usuario. Un coordinador puede tener a cargo varias:
-- se resuelven tanto por su propia área como por su correo en el catálogo
-- compartido `coordinadores`.
create or replace function public.permisos_areas_coordinadas()
returns setof integer
language sql
stable
security definer
set search_path = public
as $$
  select distinct c.area_id
    from public.coordinadores c
    join public.permisos_perfiles p on lower(p.correo) = lower(c.correo)
   where p.user_id = auth.uid() and c.activo and c.area_id is not null
  union
  select p.area_id
    from public.permisos_perfiles p
   where p.user_id = auth.uid() and p.rol = 'coordinador' and p.area_id is not null;
$$;

create or replace function public.permisos_coordina_area(p_area_id integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_area_id in (select public.permisos_areas_coordinadas()), false);
$$;

-- -----------------------------------------------------------------------------
-- Activación de RLS
-- -----------------------------------------------------------------------------
alter table public.permisos_empresas            enable row level security;
alter table public.permisos_tramites            enable row level security;
alter table public.permisos_categorias          enable row level security;
alter table public.permisos_tipos               enable row level security;
alter table public.permisos_perfiles            enable row level security;
alter table public.permisos_config              enable row level security;
alter table public.permisos_consecutivos        enable row level security;
alter table public.permisos_solicitudes         enable row level security;
alter table public.permisos_detalle_permiso     enable row level security;
alter table public.permisos_detalle_vacaciones  enable row level security;
alter table public.permisos_adjuntos            enable row level security;
alter table public.permisos_historial           enable row level security;
alter table public.permisos_auditoria           enable row level security;
alter table public.permisos_notificaciones      enable row level security;
alter table public.permisos_eventos             enable row level security;

-- -----------------------------------------------------------------------------
-- Catálogos: cualquiera autenticado los lee; solo el administrador los modifica
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'permisos_empresas', 'permisos_tramites', 'permisos_categorias', 'permisos_tipos'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.permisos_es_admin()) with check (public.permisos_es_admin())',
      t || '_admin', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfiles
-- -----------------------------------------------------------------------------
drop policy if exists permisos_perfiles_select on public.permisos_perfiles;
create policy permisos_perfiles_select on public.permisos_perfiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.permisos_es_th()
    or public.permisos_coordina_area(area_id)
  );

-- El registro propio se crea con rol y estado por defecto; nadie se
-- autoproclama administrador porque la policy fija ambos valores.
drop policy if exists permisos_perfiles_insert_propio on public.permisos_perfiles;
create policy permisos_perfiles_insert_propio on public.permisos_perfiles
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and rol = 'colaborador'
    and estado = 'pendiente_validacion'
  );

drop policy if exists permisos_perfiles_update_propio on public.permisos_perfiles;
create policy permisos_perfiles_update_propio on public.permisos_perfiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and rol = public.permisos_rol()
    and estado = (select estado from public.permisos_perfiles where user_id = auth.uid())
  );

-- Talento Humano valida perfiles; solo el administrador cambia roles.
drop policy if exists permisos_perfiles_th on public.permisos_perfiles;
create policy permisos_perfiles_th on public.permisos_perfiles
  for update to authenticated
  using (public.permisos_es_th())
  with check (public.permisos_es_th());

drop policy if exists permisos_perfiles_admin on public.permisos_perfiles;
create policy permisos_perfiles_admin on public.permisos_perfiles
  for all to authenticated
  using (public.permisos_es_admin())
  with check (public.permisos_es_admin());

-- -----------------------------------------------------------------------------
-- Solicitudes
-- -----------------------------------------------------------------------------
drop policy if exists permisos_solicitudes_select on public.permisos_solicitudes;
create policy permisos_solicitudes_select on public.permisos_solicitudes
  for select to authenticated
  using (
    deleted_at is null
    and (
      solicitante_id = auth.uid()
      or public.permisos_coordina_area(area_id)
      or public.permisos_es_th()
    )
  );

drop policy if exists permisos_solicitudes_insert on public.permisos_solicitudes;
create policy permisos_solicitudes_insert on public.permisos_solicitudes
  for insert to authenticated
  with check (
    solicitante_id = auth.uid()
    and public.permisos_perfil_activo()
  );

-- El solicitante solo puede tocar lo suyo mientras no haya decisión de TH.
drop policy if exists permisos_solicitudes_update_propia on public.permisos_solicitudes;
create policy permisos_solicitudes_update_propia on public.permisos_solicitudes
  for update to authenticated
  using (
    solicitante_id = auth.uid()
    and estado in ('BORRADOR', 'PENDIENTE_COORDINADOR', 'APROBADA_COORDINADOR',
                   'PENDIENTE_TH', 'PENDIENTE_GERENCIA_TH', 'PENDIENTE_SOPORTE')
  )
  with check (solicitante_id = auth.uid());

drop policy if exists permisos_solicitudes_update_coordinador on public.permisos_solicitudes;
create policy permisos_solicitudes_update_coordinador on public.permisos_solicitudes
  for update to authenticated
  using (public.permisos_coordina_area(area_id))
  with check (public.permisos_coordina_area(area_id));

drop policy if exists permisos_solicitudes_update_th on public.permisos_solicitudes;
create policy permisos_solicitudes_update_th on public.permisos_solicitudes
  for update to authenticated
  using (public.permisos_es_th())
  with check (public.permisos_es_th());

-- Nunca se borra físicamente: se usa deleted_at (soft delete).
drop policy if exists permisos_solicitudes_delete on public.permisos_solicitudes;
create policy permisos_solicitudes_delete on public.permisos_solicitudes
  for delete to authenticated
  using (false);

-- -----------------------------------------------------------------------------
-- Detalles y adjuntos: heredan la visibilidad de su solicitud
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'permisos_detalle_permiso', 'permisos_detalle_vacaciones', 'permisos_adjuntos'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (exists (select 1 from public.permisos_solicitudes s
                         where s.id = %I.solicitud_id))',
      t || '_select', t, t
    );

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (exists (select 1 from public.permisos_solicitudes s
                         where s.id = %I.solicitud_id
                           and (s.solicitante_id = auth.uid()
                                or public.permisos_coordina_area(s.area_id)
                                or public.permisos_es_th())))
         with check (exists (select 1 from public.permisos_solicitudes s
                              where s.id = %I.solicitud_id
                                and (s.solicitante_id = auth.uid()
                                     or public.permisos_coordina_area(s.area_id)
                                     or public.permisos_es_th())))',
      t || '_write', t, t, t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Historial: se lee con la solicitud; lo escriben los triggers
-- -----------------------------------------------------------------------------
drop policy if exists permisos_historial_select on public.permisos_historial;
create policy permisos_historial_select on public.permisos_historial
  for select to authenticated
  using (exists (select 1 from public.permisos_solicitudes s
                  where s.id = permisos_historial.solicitud_id));

-- -----------------------------------------------------------------------------
-- Auditoría: solo lectura para Gerencia y Administración. Inmutable.
-- -----------------------------------------------------------------------------
drop policy if exists permisos_auditoria_select on public.permisos_auditoria;
create policy permisos_auditoria_select on public.permisos_auditoria
  for select to authenticated
  using (public.permisos_es_gerente_th());

revoke insert, update, delete on public.permisos_auditoria from authenticated, anon;
revoke insert, update, delete on public.permisos_historial from authenticated, anon;

-- -----------------------------------------------------------------------------
-- Notificaciones y eventos: visibles para TH; los escriben las Edge Functions
-- -----------------------------------------------------------------------------
drop policy if exists permisos_notificaciones_select on public.permisos_notificaciones;
create policy permisos_notificaciones_select on public.permisos_notificaciones
  for select to authenticated
  using (public.permisos_es_th());

drop policy if exists permisos_eventos_select on public.permisos_eventos;
create policy permisos_eventos_select on public.permisos_eventos
  for select to authenticated
  using (public.permisos_es_admin());

-- -----------------------------------------------------------------------------
-- Parámetros: los lee cualquiera autenticado, los cambia el administrador
-- -----------------------------------------------------------------------------
drop policy if exists permisos_config_select on public.permisos_config;
create policy permisos_config_select on public.permisos_config
  for select to authenticated using (true);

drop policy if exists permisos_config_admin on public.permisos_config;
create policy permisos_config_admin on public.permisos_config
  for all to authenticated
  using (public.permisos_es_admin())
  with check (public.permisos_es_admin());

-- Los consecutivos solo se tocan desde la función SECURITY DEFINER.
revoke all on public.permisos_consecutivos from authenticated, anon;
