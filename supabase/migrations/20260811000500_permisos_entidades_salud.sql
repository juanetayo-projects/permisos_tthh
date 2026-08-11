-- =============================================================================
-- PERMISOS TTHH — Catálogo de EPS y ARL
-- =============================================================================
-- El campo "EPS o ARL que la expide" del reporte de incapacidad era texto
-- libre: cada jefe escribía el nombre a su manera ("Sura", "SURA ARL",
-- "Positiva Compañía de Seguros"...), lo que impedía agrupar el ausentismo
-- por entidad. Pasa a ser un catálogo, con el mismo patrón que áreas y
-- cargos (EditorCatalogo + carga masiva desde Excel).
-- -----------------------------------------------------------------------------

create table if not exists public.entidades_salud (
  id          serial primary key,
  nombre      text not null unique,
  tipo        text not null check (tipo in ('EPS', 'ARL')),
  activo      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.entidades_salud is
  'Catálogo de EPS y ARL, para el campo "EPS o ARL que la expide" del reporte '
  'de incapacidad.';

alter table public.entidades_salud enable row level security;

drop policy if exists entidades_salud_select on public.entidades_salud;
create policy entidades_salud_select on public.entidades_salud
  for select to authenticated using (true);

drop policy if exists entidades_salud_admin on public.entidades_salud;
create policy entidades_salud_admin on public.entidades_salud
  for all to authenticated
  using (public.permisos_gestiona_catalogos())
  with check (public.permisos_gestiona_catalogos());

-- -----------------------------------------------------------------------------
-- Semilla: las EPS y ARL más comunes en Colombia, para no arrancar en cero.
-- Talento Humano ajusta la lista desde Administración.
-- -----------------------------------------------------------------------------
insert into public.entidades_salud (nombre, tipo, orden) values
  ('Nueva EPS', 'EPS', 1),
  ('Sura EPS', 'EPS', 2),
  ('Sanitas', 'EPS', 3),
  ('Salud Total', 'EPS', 4),
  ('Compensar', 'EPS', 5),
  ('Famisanar', 'EPS', 6),
  ('Coosalud', 'EPS', 7),
  ('Mutual Ser', 'EPS', 8),
  ('Aliansalud', 'EPS', 9),
  ('Comfenalco Valle', 'EPS', 10),
  ('Capital Salud', 'EPS', 11),
  ('Emssanar', 'EPS', 12),
  ('Asmet Salud', 'EPS', 13),
  ('Sura ARL', 'ARL', 14),
  ('Positiva Compañía de Seguros', 'ARL', 15),
  ('Colmena Seguros', 'ARL', 16),
  ('Seguros Bolívar', 'ARL', 17),
  ('Axa Colpatria', 'ARL', 18),
  ('Liberty Seguros', 'ARL', 19),
  ('Mapfre Seguros', 'ARL', 20)
on conflict (nombre) do nothing;
