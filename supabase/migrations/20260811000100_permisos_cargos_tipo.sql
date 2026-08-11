-- =============================================================================
-- PERMISOS TTHH — Tipo de cargo (asistencial / administrativo)
-- =============================================================================
-- La fecha de reintegro tras vacaciones cambia según el tipo de cargo: un
-- cargo asistencial se presenta al día calendario siguiente, y el resto sigue
-- el cálculo actual de día hábil siguiente. `cargos` no tenía forma de
-- distinguirlos.
--
-- Se deja en 'administrativo' por defecto y Talento Humano lo ajusta desde
-- Administración → Cargos, cargo por cargo — no se asume aquí cuáles son
-- asistenciales.
--
-- Ojo: esta tabla es compartida con Cambio de Turnos (ver comentario en
-- 20260728000100_catalogos_propios.sql). El cambio es aditivo (columna nueva
-- con default) y no rompe esa app.
-- -----------------------------------------------------------------------------

alter table public.cargos
  add column if not exists tipo text not null default 'administrativo';

alter table public.cargos
  drop constraint if exists cargos_tipo_check;

alter table public.cargos
  add constraint cargos_tipo_check check (tipo in ('administrativo', 'asistencial'));

comment on column public.cargos.tipo is
  'Gobierna si la fecha de reintegro tras vacaciones cae al día calendario '
  'siguiente (asistencial) o al día hábil siguiente (administrativo, el '
  'cálculo de siempre).';
