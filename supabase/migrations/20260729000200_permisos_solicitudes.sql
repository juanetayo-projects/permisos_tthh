-- =============================================================================
-- PERMISOS TTHH — 002 · Solicitudes
-- Patrón tabla común + detalle por trámite: las bandejas, el dashboard, la
-- auditoría y los reportes trabajan sobre una sola tabla, y cada formato aporta
-- sus campos propios. Añadir un tercer trámite mañana no toca el motor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Consecutivos por prefijo y año: PL-2026-00001 / VA-2026-00001
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_consecutivos (
  prefijo  text not null,
  anio     integer not null,
  ultimo   integer not null default 0,
  primary key (prefijo, anio)
);

create or replace function public.permisos_siguiente_consecutivo(p_prefijo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio  integer := extract(year from (now() at time zone 'America/Bogota'))::integer;
  v_num   integer;
begin
  insert into public.permisos_consecutivos as c (prefijo, anio, ultimo)
  values (p_prefijo, v_anio, 1)
  on conflict (prefijo, anio)
    do update set ultimo = c.ultimo + 1
  returning ultimo into v_num;

  return p_prefijo || '-' || v_anio || '-' || lpad(v_num::text, 5, '0');
end;
$$;

-- -----------------------------------------------------------------------------
-- Solicitud — campos comunes a TH-F-002 y TH-F-005
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_solicitudes (
  id                   uuid primary key default gen_random_uuid(),
  tramite_id           integer not null references public.permisos_tramites (id),
  consecutivo          text unique,
  solicitante_id       uuid not null references public.permisos_perfiles (user_id),
  empresa_id           integer references public.permisos_empresas (id),
  area_id              integer references public.areas (id),
  cargo_id             integer references public.cargos (id),
  coordinador_id       integer references public.coordinadores (id),

  fecha_solicitud      date not null default (now() at time zone 'America/Bogota')::date,
  fecha_inicio         date not null,
  fecha_fin            date not null,

  estado               text not null default 'BORRADOR'
                         check (estado in (
                           'BORRADOR',
                           'PENDIENTE_COORDINADOR',
                           'APROBADA_COORDINADOR',
                           'PENDIENTE_TH',
                           'PENDIENTE_GERENCIA_TH',
                           'APROBADA_TH',
                           'PENDIENTE_SOPORTE',
                           'FINALIZADA',
                           'ARCHIVADA',
                           'RECHAZADA_COORDINADOR',
                           'RECHAZADA_TH',
                           'CANCELADA',
                           'VENCIDA'
                         )),
  extemporanea         boolean not null default false,
  observaciones        text,

  enviada_en           timestamptz,
  coord_actor_id       uuid references auth.users (id),
  coord_fecha          timestamptz,
  coord_ip             text,
  th_actor_id          uuid references auth.users (id),
  th_fecha             timestamptz,
  th_ip                text,
  motivo_rechazo       text,
  codigo_verificacion  text unique,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,

  constraint permisos_solicitudes_fechas_coherentes
    check (fecha_fin >= fecha_inicio)
);

create index if not exists permisos_solicitudes_estado_idx
  on public.permisos_solicitudes (estado) where deleted_at is null;
create index if not exists permisos_solicitudes_solicitante_idx
  on public.permisos_solicitudes (solicitante_id) where deleted_at is null;
create index if not exists permisos_solicitudes_area_idx
  on public.permisos_solicitudes (area_id) where deleted_at is null;
create index if not exists permisos_solicitudes_fecha_inicio_idx
  on public.permisos_solicitudes (fecha_inicio) where deleted_at is null;
create index if not exists permisos_solicitudes_tramite_idx
  on public.permisos_solicitudes (tramite_id) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Detalle del formato TH-F-002 (permiso laboral)
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_detalle_permiso (
  solicitud_id                 uuid primary key
                                 references public.permisos_solicitudes (id) on delete cascade,
  categoria_id                 integer references public.permisos_categorias (id),
  tipo_id                      integer references public.permisos_tipos (id),
  tipo_otro                    text,
  hora_salida                  time,
  hora_regreso                 time,
  horas_permiso                numeric(6, 2),
  dias_permiso                 numeric(6, 2),
  remunerado                   boolean not null default true,
  requiere_compensacion        boolean not null default false,
  plan_compensacion            text,
  justificacion                text,
  requiere_soporte_posterior   boolean not null default false,
  fecha_limite_soporte         date,
  soporte_posterior_entregado  boolean not null default false,
  soporte_validado_por         uuid references auth.users (id),
  soporte_validado_en          timestamptz
);

-- -----------------------------------------------------------------------------
-- Detalle del formato TH-F-005 (vacaciones)
-- Los saldos se digitan a mano y Talento Humano los valida contra nómina
-- (decisión D11). La app calcula los días hábiles en paralelo y advierte si no
-- coinciden, pero no impide el envío.
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_detalle_vacaciones (
  solicitud_id             uuid primary key
                             references public.permisos_solicitudes (id) on delete cascade,
  dias_corresponden        numeric(5, 1),
  dias_a_disfrutar         numeric(5, 1),
  dias_pendientes          numeric(5, 1),
  fecha_reintegro          date,
  dias_habiles_calculados  numeric(5, 1),
  declaracion_aceptada     boolean not null default false,
  fecha_constancia         date,
  saldo_validado_por       uuid references auth.users (id),
  saldo_validado_en        timestamptz,
  saldo_observacion_th     text
);

comment on table public.permisos_detalle_vacaciones is
  'Los días de vacaciones se cuentan en días hábiles de lunes a viernes, '
  'excluyendo festivos colombianos con Ley Emiliani. Deducido del propio '
  'formato: 6 días del 2 al 9-ene-2026 con reintegro el martes 13, porque el '
  'lunes 12 es el festivo de Reyes trasladado.';

-- -----------------------------------------------------------------------------
-- Adjuntos (bucket privado)
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_adjuntos (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.permisos_solicitudes (id) on delete cascade,
  momento         text not null default 'previo' check (momento in ('previo', 'posterior')),
  nombre_archivo  text not null,
  ruta_storage    text not null,
  mime            text,
  tamano_bytes    bigint,
  subido_por      uuid not null references auth.users (id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists permisos_adjuntos_solicitud_idx
  on public.permisos_adjuntos (solicitud_id) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Consecutivo y código de verificación al salir de BORRADOR
-- -----------------------------------------------------------------------------
create or replace function public.permisos_asignar_consecutivo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefijo text;
begin
  if new.consecutivo is null and new.estado <> 'BORRADOR' then
    select prefijo_consecutivo into v_prefijo
      from public.permisos_tramites where id = new.tramite_id;

    new.consecutivo := public.permisos_siguiente_consecutivo(coalesce(v_prefijo, 'SL'));
    new.codigo_verificacion := encode(gen_random_bytes(9), 'hex');
    new.enviada_en := coalesce(new.enviada_en, now());
  end if;

  return new;
end;
$$;

drop trigger if exists permisos_solicitudes_consecutivo on public.permisos_solicitudes;
create trigger permisos_solicitudes_consecutivo
  before insert or update of estado on public.permisos_solicitudes
  for each row execute function public.permisos_asignar_consecutivo();

drop trigger if exists permisos_solicitudes_touch on public.permisos_solicitudes;
create trigger permisos_solicitudes_touch
  before update on public.permisos_solicitudes
  for each row execute function public.permisos_touch_updated_at();
