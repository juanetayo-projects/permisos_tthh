-- =============================================================================
-- PERMISOS TTHH — 032 · Días compensados en vacaciones
--
-- Talento Humano admite compensar en dinero parte del periodo. Hasta ahora eso
-- no cabía en el formato: el colaborador lo escribía en «Observaciones» y
-- nómina se enteraba leyendo texto libre.
--
-- Se guarda como columna propia porque es un dato que se suma, se filtra y se
-- exporta, no una nota. Y va acompañado de un documento en la matriz —la carta
-- firmada—, que es lo que exige nómina para tramitarlo.
--
-- Ojo con `dias_pendientes`: a partir de ahora la aplicación lo calcula como
-- `corresponden − a disfrutar − compensados`. Los compensados se pagan en vez
-- de disfrutarse, así que dejan de estar pendientes; contarlos como saldo vivo
-- le haría creer al colaborador que aún los puede tomar.
-- =============================================================================

alter table public.permisos_detalle_vacaciones
  add column if not exists dias_compensados numeric(5, 1) not null default 0;

comment on column public.permisos_detalle_vacaciones.dias_compensados is
  'Días del periodo que se pagan en dinero en vez de disfrutarse. Exigen carta '
  'firmada y elevan el mínimo de descanso efectivo de 6 a 8 días.';

-- -----------------------------------------------------------------------------
-- La carta firmada, en el catálogo de documentos
--
-- Entra en `permisos_documentos` y no como una casilla suelta del formulario
-- para que Talento Humano pueda renombrarla o retirarla desde Administración,
-- igual que el resto de soportes.
-- -----------------------------------------------------------------------------
insert into public.permisos_documentos (codigo, nombre, norma, descripcion, orden, activo)
values (
  'carta_dias_compensados',
  'Carta de solicitud de días compensados',
  'Art. 189 CST',
  'Solicitud escrita y firmada por el colaborador pidiendo que parte del '
  'periodo se compense en dinero. Sin ella nómina no tramita la compensación.',
  20,
  true
)
on conflict (codigo) do update
  set nombre = excluded.nombre,
      norma = excluded.norma,
      descripcion = excluded.descripcion,
      activo = true;
