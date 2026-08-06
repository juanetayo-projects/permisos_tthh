-- =============================================================================
-- PERMISOS TTHH — 029 · Rol Coordinador SST y soporte del CRUD de usuarios
--
-- Dos cosas, y conviene no confundirlas:
--
-- 1) Entra un sexto rol, `coordinador_sst`. Vigila el ausentismo de toda la
--    clínica, así que **lee todas las solicitudes** —no solo las de un área—,
--    pero **no autoriza nada**: ninguna policy de escritura lo menciona. Si
--    además figura en el catálogo `coordinadores`, autoriza como cualquier
--    jefe directo, que es justo lo que pidió Talento Humano: la facultad viene
--    de estar a cargo de un servicio, no del rol de SST.
--
--    Por eso se separa `permisos_ve_todas_las_solicitudes()` de
--    `permisos_es_th()` en vez de meter SST dentro de esta última: `es_th()`
--    gobierna también quién aprueba, quién valida perfiles y quién ve las
--    notificaciones, y ahí SST no pinta nada.
--
-- 2) El módulo de usuarios pasa a ser un CRUD de verdad. La policy
--    `permisos_perfiles_admin` ya es `for all`, así que el borrado lógico no
--    necesita permisos nuevos; lo que sí hacía falta era un índice único que
--    no estorbe cuando se elimina a alguien y se vuelve a dar de alta con el
--    mismo correo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · El rol nuevo
-- -----------------------------------------------------------------------------
alter table public.permisos_perfiles
  drop constraint if exists permisos_perfiles_rol_check;

alter table public.permisos_perfiles
  add constraint permisos_perfiles_rol_check
  check (rol in (
    'colaborador',
    'coordinador',
    'coordinador_sst',
    'analista_th',
    'gerente_th',
    'administrador'
  ));

create or replace function public.permisos_es_sst()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.permisos_rol() = 'coordinador_sst', false);
$$;

revoke all on function public.permisos_es_sst() from public, anon;
grant execute on function public.permisos_es_sst() to authenticated;

comment on function public.permisos_es_sst() is
  'Coordinación de Seguridad y Salud en el Trabajo: lectura global, cero decisión.';

-- Quién puede ver el histórico completo. Deliberadamente más ancho que
-- `permisos_es_th()` y sin ningún uso en policies de escritura.
create or replace function public.permisos_ve_todas_las_solicitudes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.permisos_es_th() or public.permisos_es_sst();
$$;

revoke all on function public.permisos_ve_todas_las_solicitudes() from public, anon;
grant execute on function public.permisos_ve_todas_las_solicitudes() to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · Lectura global para SST
--
-- El colaborador sigue viendo **solo lo suyo**: esta migración no toca esa
-- rama de la condición.
-- -----------------------------------------------------------------------------
drop policy if exists permisos_solicitudes_select on public.permisos_solicitudes;
create policy permisos_solicitudes_select on public.permisos_solicitudes
  for select to authenticated
  using (
    deleted_at is null
    and (
      solicitante_id = auth.uid()
      or public.permisos_es_jefe_de(coordinador_id, area_id)
      or public.permisos_ve_todas_las_solicitudes()
    )
  );

-- Los índices de ausentismo dividen por la plantilla activa del área, así que
-- SST necesita leer los perfiles para poder calcular el denominador.
drop policy if exists permisos_perfiles_select on public.permisos_perfiles;
create policy permisos_perfiles_select on public.permisos_perfiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.permisos_es_th()
    or public.permisos_es_sst()
    or public.permisos_coordina_area(area_id)
  );

-- Los soportes se resuelven por ruta y con su propia lista, no heredan la
-- policy de la solicitud: sin tocar esto, SST vería la fila y no el archivo.
create or replace function public.permisos_puede_ver_soporte(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.permisos_solicitudes s
     where s.id::text = split_part(p_ruta, '/', 1)
       and s.deleted_at is null
       and (
         s.solicitante_id = auth.uid()
         or public.permisos_coordina_area(s.area_id)
         or public.permisos_ve_todas_las_solicitudes()
       )
  );
$$;

-- -----------------------------------------------------------------------------
-- 3 · CRUD de usuarios
--
-- `correo` era `unique` a secas. Al eliminar lógicamente a alguien la fila se
-- queda, así que volver a dar de alta ese mismo correo chocaba contra la
-- restricción sin que hubiera ningún perfil vivo con él. El índice parcial
-- deja pasar ese caso y sigue impidiendo dos perfiles activos con el mismo
-- correo, que es lo que de verdad importa.
-- -----------------------------------------------------------------------------
alter table public.permisos_perfiles
  drop constraint if exists permisos_perfiles_correo_key;

create unique index if not exists permisos_perfiles_correo_vivo_idx
  on public.permisos_perfiles (lower(correo))
  where deleted_at is null;

comment on index public.permisos_perfiles_correo_vivo_idx is
  'Un solo perfil vivo por correo. Los eliminados no ocupan el correo.';

-- -----------------------------------------------------------------------------
-- 4 · El analista de Talento Humano administra los catálogos
--
-- Talento Humano pidió el módulo de Administración para el analista. Darle la
-- pantalla sin darle la escritura la dejaría de adorno: cada guardado moriría
-- contra la policy. Los catálogos que abre son los de su oficio —motivos,
-- documentos exigidos, plazos, jefes directos, áreas, cargos— y los parámetros
-- de operación.
--
-- Lo que **no** se abre, y por qué:
--
--   · `permisos_perfiles_admin` — asignar roles sigue siendo del administrador.
--     Es la separación de funciones que cerró la migración 012: un analista que
--     pudiera repartir roles podría ascenderse a sí mismo y aprobar sus propias
--     solicitudes.
--   · `permisos_eventos` y la auditoría — rastro técnico, no operación.
-- -----------------------------------------------------------------------------
create or replace function public.permisos_gestiona_catalogos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.permisos_rol() in ('analista_th', 'administrador'), false);
$$;

revoke all on function public.permisos_gestiona_catalogos() from public, anon;
grant execute on function public.permisos_gestiona_catalogos() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'permisos_empresas', 'permisos_tramites', 'permisos_categorias', 'permisos_tipos',
    'permisos_documentos', 'permisos_tipos_documentos',
    'areas', 'cargos', 'coordinadores'
  ]
  loop
    -- `to_regclass` porque los catálogos de documentos llegaron en una
    -- migración posterior a la que creó el resto: en una base a medio aplicar
    -- la tabla puede no existir todavía.
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.permisos_gestiona_catalogos())
         with check (public.permisos_gestiona_catalogos())',
      t || '_admin', t
    );
  end loop;
end;
$$;

drop policy if exists permisos_config_admin on public.permisos_config;
create policy permisos_config_admin on public.permisos_config
  for all to authenticated
  using (public.permisos_gestiona_catalogos())
  with check (public.permisos_gestiona_catalogos());
