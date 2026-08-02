-- =============================================================================
-- PERMISOS TTHH — Reglas de cada motivo según el Código Sustantivo del Trabajo
-- =============================================================================
-- Hasta ahora un motivo solo sabía tres cosas de sí mismo: si es remunerado, si
-- pide soporte y si está exento de la antelación. Con eso no se puede decidir
-- lo que Talento Humano decide a diario:
--
--   · Una incapacidad se registra **hacia atrás** —el médico la expide el mismo
--     día que empieza—, y una diligencia personal no: pedir permiso para el
--     martes pasado no es una solicitud, es un reporte de inasistencia.
--   · La licencia de luto son **cinco días hábiles** (Ley 1280 de 2009); pedir
--     ocho no es un caso límite, es un error de digitación.
--   · El día de la familia es **semestral** (Ley 1857 de 2017, art. 3): el cupo
--     forma parte del motivo, no del criterio de quien autoriza.
--   · El plazo para entregar el soporte de una incapacidad son tres días
--     hábiles y el de un certificado electoral, un mes: un único parámetro
--     global obligaba a elegir el peor de los dos.
--
-- Todo esto vive ahora en el propio motivo y es editable desde Administración,
-- porque las normas cambian y un cambio de norma no debería ser un despliegue.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Naturaleza jurídica: no todo lo que pasa por este formato es un permiso
-- -----------------------------------------------------------------------------
-- El retiro parcial de cesantías es el caso que lo hizo evidente: se tramita en
-- el mismo formato, lo firma la misma gerencia y aparecía en las estadísticas
-- de ausentismo como si el colaborador hubiera faltado, porque el motor exige
-- un rango de fechas. Un trámite no tiene periodo de ausencia, así que se
-- distingue por naturaleza y se excluye del ausentismo.
alter table public.permisos_tipos
  add column if not exists naturaleza text not null default 'permiso'
    check (naturaleza in ('permiso', 'licencia', 'incapacidad', 'vacaciones', 'tramite'));

comment on column public.permisos_tipos.naturaleza is
  'permiso = ausencia autorizada por el empleador (art. 57 num. 6 CST). '
  'licencia = la concede la ley (luto, maternidad, paternidad). '
  'incapacidad = la expide la EPS o la ARL, el empleador no la autoriza. '
  'tramite = no genera ausencia (retiro parcial de cesantías).';

alter table public.permisos_tipos
  add column if not exists genera_ausentismo boolean not null default true;

comment on column public.permisos_tipos.genera_ausentismo is
  'false para los trámites: no restan tiempo laborado y no deben contaminar los '
  'indicadores de ausentismo.';

alter table public.permisos_tipos
  add column if not exists fundamento_legal text;

comment on column public.permisos_tipos.fundamento_legal is
  'Norma que respalda el motivo. Se imprime en el formato y es lo que Talento '
  'Humano cita cuando el colaborador pregunta por qué se le exige un documento.';

-- -----------------------------------------------------------------------------
-- Fechas que admite cada motivo
-- -----------------------------------------------------------------------------
-- `null` = sin límite. Se expresa en días calendario porque una incapacidad de
-- un viernes se reporta el lunes y el fin de semana cuenta.
alter table public.permisos_tipos
  add column if not exists dias_max_retroactivo integer not null default 0;

comment on column public.permisos_tipos.dias_max_retroactivo is
  'Cuántos días hacia atrás admite la fecha de inicio. 0 = solo desde hoy. '
  'Una incapacidad o una calamidad se registran después de ocurrir.';

alter table public.permisos_tipos
  add column if not exists dias_max_futuro integer;

comment on column public.permisos_tipos.dias_max_futuro is
  'Cuántos días hacia adelante admite la fecha de inicio; null = sin tope. '
  'Evita el permiso pedido para dentro de dos años, que nadie recuerda validar.';

alter table public.permisos_tipos
  add column if not exists duracion_maxima_dias numeric(6, 2);

comment on column public.permisos_tipos.duracion_maxima_dias is
  'Tope legal o institucional de la duración. Advierte; no bloquea, porque la '
  'prórroga de una incapacidad y las licencias acumuladas existen.';

alter table public.permisos_tipos
  add column if not exists duracion_minima_dias numeric(6, 2);

-- -----------------------------------------------------------------------------
-- Horas frente a días
-- -----------------------------------------------------------------------------
-- El formulario pedía siempre hora de salida y de regreso, incluso para una
-- licencia de maternidad de 18 semanas, donde la pregunta no significa nada.
alter table public.permisos_tipos
  add column if not exists permite_horas boolean not null default true;

comment on column public.permisos_tipos.permite_horas is
  'true = el permiso puede ser de unas horas dentro de la jornada (cita médica, '
  'diligencia). false = se mide en días completos (licencias, incapacidades).';

-- -----------------------------------------------------------------------------
-- Plazo del soporte posterior, por motivo
-- -----------------------------------------------------------------------------
alter table public.permisos_tipos
  add column if not exists plazo_soporte_dias integer;

comment on column public.permisos_tipos.plazo_soporte_dias is
  'Días para entregar el soporte posterior contados desde el regreso. null = se '
  'usa el parámetro global dias_plazo_soporte_posterior.';

alter table public.permisos_tipos
  add column if not exists plazo_soporte_habiles boolean not null default true;

comment on column public.permisos_tipos.plazo_soporte_habiles is
  'true = el plazo se cuenta en días hábiles; false = en días calendario, que es '
  'como se expresan los plazos largos (el mes del certificado electoral).';

-- -----------------------------------------------------------------------------
-- Cupo por periodo
-- -----------------------------------------------------------------------------
alter table public.permisos_tipos
  add column if not exists max_por_periodo integer;

alter table public.permisos_tipos
  add column if not exists periodo_control text not null default 'ninguno'
    check (periodo_control in ('ninguno', 'mes', 'semestre', 'anio'));

comment on column public.permisos_tipos.max_por_periodo is
  'Cuántas veces puede usarse el motivo dentro de `periodo_control`. El día de '
  'la familia es semestral (Ley 1857 de 2017, art. 3).';

-- -----------------------------------------------------------------------------
-- Concurrencia: qué pasa cuando algo ocurre durante otro permiso ya autorizado
-- -----------------------------------------------------------------------------
alter table public.permisos_tipos
  add column if not exists interrumpe_otros boolean not null default false;

comment on column public.permisos_tipos.interrumpe_otros is
  'true = si ocurre dentro de un permiso ya autorizado, lo interrumpe y los días '
  'restantes quedan para reprogramar. Es el caso de la incapacidad que cae en '
  'mitad de las vacaciones (art. 187 CST y concepto MinTrabajo 2018).';

alter table public.permisos_tipos
  add column if not exists prioridad integer not null default 0;

comment on column public.permisos_tipos.prioridad is
  'Ordena qué motivo manda cuando dos se solapan: gana el de prioridad mayor. '
  'Incapacidad (30) > luto (20) > calamidad (15) > vacaciones (10) > permiso (0).';

-- -----------------------------------------------------------------------------
-- Valores para los motivos que ya existen
-- -----------------------------------------------------------------------------
update public.permisos_tipos t set
  naturaleza            = v.naturaleza,
  genera_ausentismo     = v.genera_ausentismo,
  fundamento_legal      = v.fundamento,
  dias_max_retroactivo  = v.retro,
  dias_max_futuro       = v.futuro,
  duracion_maxima_dias  = v.max_dias,
  permite_horas         = v.horas,
  plazo_soporte_dias    = v.plazo,
  plazo_soporte_habiles = v.habiles,
  max_por_periodo       = v.cupo,
  periodo_control       = v.periodo,
  interrumpe_otros      = v.interrumpe,
  prioridad             = v.prioridad
from (values
  -- nombre, naturaleza, ausentismo, fundamento,
  -- retro, futuro, max_dias, horas, plazo, habiles, cupo, periodo, interrumpe, prioridad
  ('Cita médica', 'permiso', true,
   'Art. 57 num. 6 CST · permiso remunerado para atención médica.',
   1, 180, 3, true, 3, true, null, 'ninguno', false, 5),

  ('Incapacidad médica', 'incapacidad', true,
   'Arts. 227 y 228 CST · Decreto 780 de 2016. La expide la EPS o la ARL; el '
   'empleador la registra, no la autoriza.',
   30, 30, 180, false, 3, true, null, 'ninguno', true, 30),

  ('Licencia de maternidad o paternidad', 'licencia', true,
   'Arts. 236 y 239 CST · Ley 1822 de 2017 · Ley 2114 de 2021: 18 semanas de '
   'maternidad y 2 semanas de paternidad.',
   30, 300, 126, false, 30, false, null, 'ninguno', true, 25),

  ('Diligencia personal', 'permiso', true,
   'Art. 57 num. 6 CST · permiso concedido por el empleador, usualmente no '
   'remunerado o compensable.',
   0, 90, 2, true, null, true, null, 'ninguno', false, 0),

  ('Votaciones', 'permiso', true,
   'Ley 403 de 1997, art. 3 · Ley 815 de 2003: media jornada de descanso '
   'compensatorio remunerado dentro del mes siguiente a la votación.',
   30, 60, 1, true, 30, false, null, 'ninguno', false, 0),

  ('Deberes de acudiente', 'permiso', true,
   'Ley 1857 de 2017, art. 3 · Ley 1098 de 2006: acompañamiento escolar del '
   'menor a cargo.',
   0, 60, 1, true, 5, true, null, 'ninguno', false, 0),

  ('Día de la familia', 'permiso', true,
   'Ley 1857 de 2017, art. 3 · jornada semestral para compartir con la familia.',
   0, 180, 1, false, null, true, 1, 'semestre', false, 0),

  ('Calamidad doméstica', 'permiso', true,
   'Art. 57 num. 6 CST · grave calamidad doméstica debidamente comprobada.',
   15, 15, 5, true, 5, true, null, 'ninguno', true, 15),

  ('Luto', 'licencia', true,
   'Art. 57 num. 10 CST, adicionado por la Ley 1280 de 2009: 5 días hábiles por '
   'la muerte del cónyuge, compañero permanente o pariente hasta el grado que '
   'señala la norma.',
   15, 15, 5, false, 30, false, null, 'ninguno', true, 20),

  ('Movilidad sostenible', 'permiso', true,
   'Ley 1811 de 2016 · incentivo institucional al uso de la bicicleta.',
   0, 90, 1, true, null, true, null, 'ninguno', false, 0),

  ('Comisión o actividad institucional', 'permiso', false,
   'Actividad ordenada por la empresa: el colaborador está trabajando, así que '
   'no cuenta como ausentismo.',
   0, 365, null, true, null, true, null, 'ninguno', false, 0),

  -- El trámite que no es un permiso. Se mantiene el nombre para no romper las
  -- solicitudes ya radicadas; lo que cambia es que deja de contar como ausencia.
  ('Solicitud de cesantías', 'tramite', false,
   'Art. 102 CST · Ley 1071 de 2006: retiro parcial de cesantías para vivienda o '
   'educación. Es un trámite ante la Gerencia de Talento Humano, no una ausencia.',
   0, 365, null, false, 15, true, null, 'ninguno', false, 0)
) as v(nombre, naturaleza, genera_ausentismo, fundamento,
       retro, futuro, max_dias, horas, plazo, habiles, cupo, periodo, interrumpe, prioridad)
where t.nombre = v.nombre;

-- -----------------------------------------------------------------------------
-- Parámetros nuevos
-- -----------------------------------------------------------------------------
insert into public.permisos_config (clave, valor, descripcion) values
  ('horas_jornada', '8'::jsonb,
   'Horas de una jornada. Convierte horas de permiso en días de ausentismo.'),
  ('dias_habiles_mes', '24'::jsonb,
   'Días programados al mes por colaborador. Denominador del índice de ausentismo.'),
  ('bloquear_solapamiento', 'false'::jsonb,
   'true = impide enviar una solicitud que se cruce con otra vigente. Por '
   'defecto solo advierte: la interrupción es un caso legítimo y frecuente.')
on conflict (clave) do nothing;
