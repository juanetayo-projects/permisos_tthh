-- =============================================================================
-- PERMISOS TTHH — El retiro parcial de cesantías deja de ser un permiso
-- =============================================================================
-- Se modeló como un motivo del TH-F-002 porque se firma en ese papel, y el
-- formulario de permisos lo trataba como una ausencia: pedía fecha de inicio,
-- fecha de fin, hora de salida y hora de regreso, y encima advertía «faltan 21
-- horas para el inicio y el formato exige 48; quedará marcada como
-- extemporánea». Nada de eso significa algo en una solicitud de cesantías: no
-- hay periodo que disfrutar ni antelación que cumplir.
--
-- Se le da trámite propio, como lo tienen las vacaciones. Con eso gana:
--   · Su propia numeración (`CE-2026-00001`), separada de los permisos.
--   · Antelación cero, así que deja de marcarse extemporánea sin motivo.
--   · Su propia pantalla, sin fechas ni horarios.
--
-- El código de formato sigue siendo el TH-F-002 porque es lo que Calidad tiene
-- publicado hoy. Si publican uno específico, se cambia desde Administración sin
-- desplegar: para eso `permisos_tramites` es editable.
-- -----------------------------------------------------------------------------

insert into public.permisos_tramites
  (codigo, nombre, prefijo_consecutivo, codigo_formato, version_formato, proceso,
   nota_pie, antelacion_minima, unidad_antelacion, orden)
values
  ('cesantias', 'Solicitud de retiro parcial de cesantías', 'CE', 'TH-F-002', '02',
   'TALENTO HUMANO',
   'El retiro parcial de cesantías solo procede para vivienda o educación (art. 102 CST · Ley 1071 de 2006). La Gerencia de Talento Humano verifica la destinación antes de tramitarlo ante la administradora.',
   0, 'horas', 3)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Las solicitudes ya radicadas se mueven al trámite nuevo
-- -----------------------------------------------------------------------------
-- Sin esto quedarían mezcladas con los permisos en las bandejas y los reportes,
-- que es justo lo que se está separando. El consecutivo antiguo se conserva:
-- renumerar rompería la trazabilidad de un documento que ya circuló firmado.
update public.permisos_solicitudes s
   set tramite_id = (select id from public.permisos_tramites where codigo = 'cesantias')
  from public.permisos_detalle_permiso dp
  join public.permisos_tipos t on t.id = dp.tipo_id
 where dp.solicitud_id = s.id
   and t.naturaleza = 'tramite'
   and s.tramite_id = (select id from public.permisos_tramites where codigo = 'permiso');

-- -----------------------------------------------------------------------------
-- Un trámite no tiene periodo
-- -----------------------------------------------------------------------------
-- `fecha_inicio` y `fecha_fin` siguen siendo obligatorias en la tabla común: son
-- el eje de bandejas, filtros y reportes, y hacerlas nulas obligaría a defender
-- ese nulo en cada consulta. En un trámite se llenan con el día de la radicación,
-- que es lo único que significan aquí. La vista de ausentismo ya lo deja fuera
-- por `genera_ausentismo`, así que no contamina ningún indicador.
comment on column public.permisos_solicitudes.fecha_inicio is
  'Primer día de la ausencia. En los trámites —cesantías— es el día de la '
  'radicación: no hay periodo que disfrutar.';
