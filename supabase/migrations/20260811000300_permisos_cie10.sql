-- =============================================================================
-- PERMISOS TTHH — Catálogo CIE10 y diagnóstico de la incapacidad
-- =============================================================================
-- Toda incapacidad (enfermedad común, accidente de trabajo, enfermedad
-- laboral, licencia de maternidad, licencia de paternidad) queda registrada
-- con su código CIE10, buscable por código o por nombre del diagnóstico. La
-- tabla se puebla aparte, en un lote posterior a esta migración, con el
-- listado oficial del Ministerio de Salud.
-- -----------------------------------------------------------------------------

create table if not exists public.cie10 (
  codigo      text primary key,
  nombre      text not null,
  capitulo    text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.cie10 is
  'Catálogo CIE10 (Ministerio de Salud de Colombia). Se busca por código o por '
  'nombre del diagnóstico al reportar una incapacidad.';

-- Búsqueda por nombre sin depender de acentos ni mayúsculas exactas.
create extension if not exists pg_trgm;

create index if not exists cie10_nombre_trgm_idx
  on public.cie10 using gin (nombre gin_trgm_ops);

alter table public.cie10 enable row level security;

drop policy if exists cie10_select on public.cie10;
create policy cie10_select on public.cie10
  for select to authenticated using (true);

drop policy if exists cie10_admin on public.cie10;
create policy cie10_admin on public.cie10
  for all to authenticated
  using (public.permisos_es_admin())
  with check (public.permisos_es_admin());

-- -----------------------------------------------------------------------------
-- Diagnóstico de la solicitud
-- -----------------------------------------------------------------------------
alter table public.permisos_detalle_permiso
  add column if not exists cie10_codigo text references public.cie10 (codigo);

comment on column public.permisos_detalle_permiso.cie10_codigo is
  'Diagnóstico CIE10 de la incapacidad. Nullable a nivel de base de datos '
  '-igual que el resto de campos condicionales de esta tabla-: lo exige la '
  'validación de dominio cuando el motivo es de naturaleza incapacidad, no '
  'un constraint duro.';
