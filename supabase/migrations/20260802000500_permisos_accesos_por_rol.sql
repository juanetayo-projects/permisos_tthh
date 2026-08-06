-- =============================================================================
-- PERMISOS TTHH — 030 · Qué módulos ve cada rol, sin desplegar
--
-- El reparto de pantallas estaba escrito en el código —una lista de roles al
-- lado de cada enlace y de cada ruta—, así que mover una casilla exigía tocar
-- dos archivos, compilar y publicar. La organización cambia más a menudo que
-- eso, así que el reparto pasa a ser un dato.
--
-- ## Lo que esta tabla decide y lo que no
--
-- Decide **navegación**: qué enlaces salen en el menú y a qué rutas se puede
-- entrar. **No** decide el alcance de los datos: eso siguen haciéndolo las
-- policies, y son ellas las que sostienen la seguridad.
--
-- Es deliberado que no las gobierne. Un catálogo editable desde una pantalla
-- que además concediera lectura convertiría cada descuido al marcar casillas
-- en una fuga: bastaría marcarle a un colaborador «Todas las solicitudes»
-- para enseñarle los soportes médicos de la clínica entera. Con este reparto,
-- lo peor que puede pasar es que alguien vea una pantalla vacía o de más, y el
-- dato sigue protegido por donde siempre.
--
-- El catálogo de módulos **no** vive aquí: un módulo es una pantalla y
-- aparece y desaparece con el código. Lo que se guarda es el reparto.
-- =============================================================================

create table if not exists public.permisos_acceso_rol (
  rol        text not null
               check (rol in (
                 'colaborador', 'coordinador', 'coordinador_sst',
                 'analista_th', 'gerente_th', 'administrador'
               )),
  modulo     text not null,
  created_at timestamptz not null default now(),
  primary key (rol, modulo)
);

comment on table public.permisos_acceso_rol is
  'Qué módulos ve cada rol. Gobierna la navegación, nunca el alcance de los '
  'datos: de eso siguen encargándose las policies.';

-- -----------------------------------------------------------------------------
-- Nadie puede dejar la aplicación sin administrador
--
-- Quitarle Administración al administrador cierra la única puerta desde la que
-- se reparten estas casillas: no habría forma de volver a abrirla salvo
-- entrando por SQL. Se impide en la base de datos y no solo en la pantalla,
-- porque la pantalla no es lo único que escribe en esta tabla.
-- -----------------------------------------------------------------------------
create or replace function public.permisos_proteger_acceso_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.rol = 'administrador' and old.modulo = 'administracion' then
    raise exception
      'El administrador no puede quedarse sin acceso a Administración.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists permisos_acceso_rol_proteger on public.permisos_acceso_rol;
create trigger permisos_acceso_rol_proteger
  before delete or update on public.permisos_acceso_rol
  for each row execute function public.permisos_proteger_acceso_admin();

-- -----------------------------------------------------------------------------
-- RLS: lo lee todo el mundo, lo reparte el administrador
--
-- La lectura es abierta porque cada persona necesita saber su propio menú, y
-- para pintarlo hay que consultar la tabla antes de saber qué rol tiene. No
-- hay nada sensible en ella: son nombres de pantallas.
-- -----------------------------------------------------------------------------
alter table public.permisos_acceso_rol enable row level security;

drop policy if exists permisos_acceso_rol_select on public.permisos_acceso_rol;
create policy permisos_acceso_rol_select on public.permisos_acceso_rol
  for select to authenticated using (true);

drop policy if exists permisos_acceso_rol_admin on public.permisos_acceso_rol;
create policy permisos_acceso_rol_admin on public.permisos_acceso_rol
  for all to authenticated
  using (public.permisos_es_admin())
  with check (public.permisos_es_admin());

-- -----------------------------------------------------------------------------
-- Siembra: exactamente el reparto que fijó Talento Humano
--
-- `on conflict do nothing` para que volver a aplicar la migración no pise un
-- reparto que ya hayan ajustado desde la pantalla.
-- -----------------------------------------------------------------------------
insert into public.permisos_acceso_rol (rol, modulo) values
  -- Común a todos: pedir, consultar lo propio y ver la bandeja de su alcance.
  ('colaborador',     'inicio'),
  ('colaborador',     'solicitar_permiso'),
  ('colaborador',     'solicitar_vacaciones'),
  ('colaborador',     'solicitar_cesantias'),
  ('colaborador',     'mis_solicitudes'),
  ('colaborador',     'bandeja_area'),
  ('colaborador',     'dashboard'),

  ('coordinador',     'inicio'),
  ('coordinador',     'solicitar_permiso'),
  ('coordinador',     'solicitar_vacaciones'),
  ('coordinador',     'solicitar_cesantias'),
  ('coordinador',     'mis_solicitudes'),
  ('coordinador',     'bandeja_area'),
  ('coordinador',     'dashboard'),

  -- SST vigila el ausentismo de toda la clínica y no autoriza nada.
  ('coordinador_sst', 'inicio'),
  ('coordinador_sst', 'solicitar_permiso'),
  ('coordinador_sst', 'solicitar_vacaciones'),
  ('coordinador_sst', 'solicitar_cesantias'),
  ('coordinador_sst', 'mis_solicitudes'),
  ('coordinador_sst', 'bandeja_area'),
  ('coordinador_sst', 'dashboard'),
  ('coordinador_sst', 'todas_solicitudes'),
  ('coordinador_sst', 'ausentismo'),

  -- El analista lleva la operación diaria de Talento Humano.
  ('analista_th',     'inicio'),
  ('analista_th',     'solicitar_permiso'),
  ('analista_th',     'solicitar_vacaciones'),
  ('analista_th',     'solicitar_cesantias'),
  ('analista_th',     'mis_solicitudes'),
  ('analista_th',     'bandeja_area'),
  ('analista_th',     'dashboard'),
  ('analista_th',     'bandeja_th'),
  ('analista_th',     'todas_solicitudes'),
  ('analista_th',     'validaciones'),
  ('analista_th',     'ausentismo'),
  ('analista_th',     'administracion'),

  -- La Gerencia entra al flujo para autorizar el retiro de cesantías.
  ('gerente_th',      'inicio'),
  ('gerente_th',      'solicitar_permiso'),
  ('gerente_th',      'solicitar_vacaciones'),
  ('gerente_th',      'solicitar_cesantias'),
  ('gerente_th',      'mis_solicitudes'),
  ('gerente_th',      'bandeja_area'),
  ('gerente_th',      'dashboard'),
  ('gerente_th',      'bandeja_cesantias'),
  ('gerente_th',      'todas_solicitudes'),

  ('administrador',   'inicio'),
  ('administrador',   'solicitar_permiso'),
  ('administrador',   'solicitar_vacaciones'),
  ('administrador',   'solicitar_cesantias'),
  ('administrador',   'mis_solicitudes'),
  ('administrador',   'bandeja_area'),
  ('administrador',   'dashboard'),
  ('administrador',   'bandeja_th'),
  ('administrador',   'bandeja_cesantias'),
  ('administrador',   'todas_solicitudes'),
  ('administrador',   'validaciones'),
  ('administrador',   'ausentismo'),
  ('administrador',   'administracion')
on conflict (rol, modulo) do nothing;
