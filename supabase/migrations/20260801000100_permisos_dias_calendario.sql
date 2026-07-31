-- =============================================================================
-- PERMISOS TTHH — Motivos que se cuentan por días calendario
-- =============================================================================
-- No todos los permisos se miden igual:
--
--   · Cita médica y vacaciones ocurren y se cuentan en **días hábiles**: no se
--     pide permiso para un día que no se trabaja.
--   · Una incapacidad o una licencia de maternidad corren por **días
--     calendario**: empiezan el día que las expide el médico, aunque sea
--     sábado, y los domingos y festivos cuentan igual.
--
-- Hasta ahora la única excepción era `exento_antelacion` (calamidad y luto),
-- que se usaba para las dos cosas a la vez. Separar el concepto permite que
-- Talento Humano ajuste cada motivo sin tocar código.
-- -----------------------------------------------------------------------------

alter table public.permisos_tipos
  add column if not exists dias_calendario boolean not null default false;

comment on column public.permisos_tipos.dias_calendario is
  'true = el permiso puede empezar y terminar cualquier día, y su duración se '
  'cuenta en días calendario (incapacidades, licencias). false = solo días '
  'hábiles (citas médicas, diligencias).';

-- Incapacidades y licencias corren por calendario desde que las expide el
-- médico. Calamidad y luto también: ocurren cuando ocurren.
update public.permisos_tipos
   set dias_calendario = true
 where nombre in (
   'Incapacidad médica',
   'Licencia de maternidad o paternidad',
   'Calamidad doméstica',
   'Luto'
 );
