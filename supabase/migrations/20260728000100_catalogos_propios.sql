-- =============================================================================
-- PERMISOS TTHH — 000 · Catálogos propios
-- =============================================================================
-- Va **antes** que todo lo demás porque `permisos_perfiles` y
-- `permisos_solicitudes` apuntan a estas tres tablas con claves foráneas.
--
-- Permisos nació dentro del proyecto Supabase de Cambio de Turnos (decisión D2)
-- y reutilizaba sus `areas`, `cargos` y `coordinadores`. La convivencia salió
-- cara en sitios concretos:
--
--   · **Las plantillas de correo de Auth son del proyecto, no de la app.** Las
--     comparte Cambio de Turnos, así que no se podían tocar para Permisos; por
--     eso hubo que escribir la Edge Function `permisos-recuperar-clave` en vez
--     de usar `resetPasswordForEmail`.
--   · **Un cambio en una app podía romper la otra.** Ya pasó: la policy
--     `sol_insert` de Cambio de Turnos dejaba insertar a un usuario de Permisos
--     y hubo que endurecerla desde este repositorio.
--   · Administración avisaba «ojo, este catálogo lo comparten las dos
--     aplicaciones» en la mitad de sus secciones.
--
-- Se separó el 2026-08-02, cuando Permisos tenía 4 perfiles y 3 solicitudes
-- frente a los 26 usuarios y 7.584 solicitudes de Cambio de Turnos: cada
-- colaborador que se registra encarece la migración.
--
-- Las tres tablas conservan **la misma forma** que tenían en el proyecto
-- compartido, para que ni las claves foráneas ni las consultas cambien. Lo
-- único que cambia es de quién son.
-- -----------------------------------------------------------------------------

create table if not exists public.areas (
  id          serial primary key,
  nombre      text not null unique,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.areas is
  'Procesos y áreas de la clínica. Antes vivía en el proyecto de Cambio de '
  'Turnos; desde la separación es de Permisos.';

create table if not exists public.cargos (
  id          serial primary key,
  nombre      text not null unique,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Una fila por coordinador **y por servicio**: quien cubre tres servicios
-- necesita tres filas, y el cargo desambigua en los desplegables.
create table if not exists public.coordinadores (
  id          serial primary key,
  area_id     integer references public.areas (id),
  cargo       text not null,
  nombre      text,
  correo      text not null,
  link        text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists coordinadores_area_idx on public.coordinadores (area_id);
create index if not exists coordinadores_correo_idx on public.coordinadores (lower(correo));

-- -----------------------------------------------------------------------------
-- Lectura para cualquiera autenticado: el formulario de solicitud los necesita.
-- La escritura se abre al administrador en la migración de RLS, que es donde
-- se define `permisos_es_admin()`.
-- -----------------------------------------------------------------------------
alter table public.areas          enable row level security;
alter table public.cargos         enable row level security;
alter table public.coordinadores  enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['areas', 'cargos', 'coordinadores']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t
    );
  end loop;
end;
$$;
