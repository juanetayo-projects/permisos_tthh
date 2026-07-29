-- =============================================================================
-- PERMISOS TTHH — 001 · Catálogos y perfiles
-- Proyecto Supabase compartido con Cambio de Turnos (decisión D2).
-- Todos los objetos nuevos llevan el prefijo `permisos_` para no interferir
-- con las tablas de la otra aplicación.
-- Se reutilizan tal cual: public.areas, public.cargos, public.coordinadores.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Empresas de la RED (casillas del encabezado de ambos formatos)
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_empresas (
  id          serial primary key,
  nombre      text not null unique,
  orden       integer not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.permisos_empresas is
  'Empresas a las que puede pertenecer el colaborador (TH-F-002 / TH-F-005).';

-- -----------------------------------------------------------------------------
-- Trámites: cada formato que gestiona la aplicación.
-- Código, versión y vigencia son editables desde Administración para que
-- Calidad publique una versión nueva sin necesidad de desplegar (decisión D10).
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_tramites (
  id                   serial primary key,
  codigo               text not null unique,
  nombre               text not null,
  prefijo_consecutivo  text not null,
  codigo_formato       text not null,
  version_formato      text not null,
  vigencia_formato     text,
  proceso              text not null default 'TALENTO HUMANO',
  nota_pie             text,
  antelacion_minima    integer not null default 0,
  unidad_antelacion    text not null default 'horas'
                         check (unidad_antelacion in ('horas', 'dias')),
  orden                integer not null default 0,
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on column public.permisos_tramites.antelacion_minima is
  'Antelación exigida por el formato. Se usa para ADVERTIR y marcar la solicitud '
  'como extemporánea, nunca para bloquear el envío (riesgo R8).';

-- -----------------------------------------------------------------------------
-- Motivos de permiso en dos niveles (decisión D4)
--   categoría = casilla impresa en el formato TH-F-002
--   tipo      = motivo real, base de las estadísticas de ausentismo
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_categorias (
  id               serial primary key,
  nombre           text not null unique,
  casilla_formato  text not null,
  orden            integer not null default 0,
  activo           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists public.permisos_tipos (
  id                              serial primary key,
  categoria_id                    integer not null
                                    references public.permisos_categorias (id),
  nombre                          text not null,
  remunerado_por_defecto          boolean not null default true,
  requiere_soporte_previo         boolean not null default false,
  requiere_soporte_posterior      boolean not null default false,
  soporte_obligatorio_desde_dias  numeric(5, 2),
  ruta_aprobacion                 text not null default 'coordinador_th'
                                    check (ruta_aprobacion in ('coordinador_th', 'gerente_th_directo')),
  exento_antelacion               boolean not null default false,
  descripcion                     text,
  orden                           integer not null default 0,
  activo                          boolean not null default true,
  created_at                      timestamptz not null default now(),
  unique (categoria_id, nombre)
);

comment on column public.permisos_tipos.soporte_obligatorio_desde_dias is
  'Umbral en días a partir del cual el soporte posterior es obligatorio. '
  'Para cita médica son 2 días, según el Paso 4 del prompt inicial.';

comment on column public.permisos_tipos.exento_antelacion is
  'Calamidad y luto no pueden planearse con antelación: no se marcan extemporáneos.';

-- -----------------------------------------------------------------------------
-- Perfiles
-- No se reutiliza public.profiles: su columna `rol` pertenece al dominio de
-- Cambio de Turnos. Permisos mantiene su propio perfil sobre auth.users, de modo
-- que ambas apps comparten el login sin contaminarse entre sí.
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_perfiles (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  nombre          text not null,
  correo          text not null unique,
  tipo_documento  text not null default 'CC'
                    check (tipo_documento in ('CC', 'CE', 'PA', 'PEP', 'TI', 'NIT')),
  documento       text,
  telefono        text,
  empresa_id      integer references public.permisos_empresas (id),
  area_id         integer references public.areas (id),
  cargo_id        integer references public.cargos (id),
  coordinador_id  integer references public.coordinadores (id),
  rol             text not null default 'colaborador'
                    check (rol in ('colaborador', 'coordinador', 'analista_th', 'gerente_th', 'administrador')),
  estado          text not null default 'pendiente_validacion'
                    check (estado in ('pendiente_validacion', 'activo', 'inactivo')),
  fecha_ingreso   date,
  activo          boolean not null default true,
  validado_por    uuid references auth.users (id),
  validado_en     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

comment on table public.permisos_perfiles is
  'Perfil del colaborador dentro de la app de Permisos. Un usuario recién '
  'registrado queda en estado pendiente_validacion hasta que Talento Humano '
  'confirma su área y su coordinador (decisión D5).';

create index if not exists permisos_perfiles_area_idx
  on public.permisos_perfiles (area_id) where deleted_at is null;
create index if not exists permisos_perfiles_rol_idx
  on public.permisos_perfiles (rol) where deleted_at is null;
create index if not exists permisos_perfiles_estado_idx
  on public.permisos_perfiles (estado) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Parámetros editables sin desplegar
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_config (
  clave        text primary key,
  valor        jsonb not null,
  descripcion  text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id)
);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.permisos_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists permisos_tramites_touch on public.permisos_tramites;
create trigger permisos_tramites_touch
  before update on public.permisos_tramites
  for each row execute function public.permisos_touch_updated_at();

drop trigger if exists permisos_perfiles_touch on public.permisos_perfiles;
create trigger permisos_perfiles_touch
  before update on public.permisos_perfiles
  for each row execute function public.permisos_touch_updated_at();
