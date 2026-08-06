-- =============================================================================
-- PERMISOS TTHH — Duración en días hábiles, independiente de dias_calendario
-- =============================================================================
-- `dias_calendario` decide si el motivo puede EMPEZAR cualquier día (sábado,
-- domingo, festivo); en la práctica nunca llegó a gobernar el CÓMPUTO de la
-- duración -- `calcularDuracion` siempre contaba días calendario sin mirar el
-- motivo, así que activarlo aquí para los 18 permisos que ya lo tienen en
-- `false` (cita médica, comisión sindical, diligencia personal, etc.) habría
-- cambiado de golpe el cálculo de solicitudes ya radicadas que nadie pidió
-- tocar.
--
-- Este es un flag nuevo e independiente, en `false` por defecto (mismo
-- comportamiento de siempre: días calendario). Se activa motivo por motivo
-- desde Administración cuando la duración sí debe restar domingos y
-- festivos, como el luto (5 días hábiles, Ley 1280 de 2009), que además debe
-- poder EMPEZAR cualquier día -- de ahí que sea un concepto aparte de
-- `dias_calendario` y no un reemplazo.
-- -----------------------------------------------------------------------------

alter table public.permisos_tipos
  add column if not exists duracion_en_habiles boolean not null default false;

comment on column public.permisos_tipos.duracion_en_habiles is
  'true = la duración del permiso resta domingos y festivos, como vacaciones '
  '(p. ej. luto). Independiente de dias_calendario, que solo decide si puede '
  'empezar cualquier día. false = cuenta días calendario, el comportamiento '
  'de siempre.';

update public.permisos_tipos
   set duracion_en_habiles = true
 where nombre = 'Luto';
