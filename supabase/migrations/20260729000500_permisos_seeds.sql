-- =============================================================================
-- PERMISOS TTHH — 005 · Semillas de catálogos
-- Valores tomados literalmente de los formatos TH-F-002 V02 y TH-F-005 V02.
-- =============================================================================

-- Empresas de la RED (casillas del encabezado de ambos formatos)
insert into public.permisos_empresas (nombre, orden) values
  ('CAC Santa Bárbara', 1),
  ('GE2', 2),
  ('Geriater', 3)
on conflict (nombre) do nothing;

-- Trámites
insert into public.permisos_tramites
  (codigo, nombre, prefijo_consecutivo, codigo_formato, version_formato, proceso,
   nota_pie, antelacion_minima, unidad_antelacion, orden)
values
  ('permiso', 'Autorización de permiso laboral', 'PL', 'TH-F-002', '02', 'TALENTO HUMANO',
   'Los permisos deben ser solicitados mínimo con 48 horas de antelación y deben ser entregados a Talento Humano antes de las 24 Horas',
   48, 'horas', 1),
  ('vacaciones', 'Solicitud y autorización de vacaciones', 'VA', 'TH-F-005', '02', 'TALENTO HUMANO',
   'Este formato debe ser entregado a Talento Humano mínimo 20 días antes del disfrute de las vacaciones',
   20, 'dias', 2)
on conflict (codigo) do nothing;

-- Categorías = casillas impresas en el formato TH-F-002
insert into public.permisos_categorias (nombre, casilla_formato, orden) values
  ('Personal',          'Personal',          1),
  ('Día de la Familia', 'Dia de la Familia', 2),
  ('Salud',             'Salud',             3),
  ('Empresarial',       'Empresarial',       4),
  ('Calamidad',         'Calamidad',         5)
on conflict (nombre) do nothing;

-- Tipos = motivo real, base de las estadísticas de ausentismo
insert into public.permisos_tipos
  (categoria_id, nombre, remunerado_por_defecto, requiere_soporte_previo,
   requiere_soporte_posterior, soporte_obligatorio_desde_dias, ruta_aprobacion,
   exento_antelacion, descripcion, orden)
select c.id, v.nombre, v.remunerado, v.soporte_previo, v.soporte_posterior,
       v.umbral_dias, v.ruta, v.exento, v.descripcion, v.orden
from (values
  ('Salud', 'Cita médica', true, false, true, 2.0, 'coordinador_th', false,
   'Si el ausentismo supera 2 días debe presentar copia de la asistencia médica, incapacidad o historia clínica.', 1),
  ('Salud', 'Incapacidad médica', true, true, false, null, 'coordinador_th', true,
   'Requiere el certificado de incapacidad al momento de la solicitud.', 2),
  ('Salud', 'Licencia de maternidad o paternidad', true, true, false, null, 'coordinador_th', false,
   'Requiere certificado médico o registro civil de nacimiento.', 3),
  ('Personal', 'Diligencia personal', false, false, false, null, 'coordinador_th', false,
   null, 4),
  ('Personal', 'Votaciones', true, false, true, null, 'coordinador_th', false,
   'Debe presentar el certificado electoral.', 5),
  ('Personal', 'Deberes de acudiente', true, false, true, null, 'coordinador_th', false,
   'Debe presentar constancia de la institución educativa.', 6),
  ('Día de la Familia', 'Día de la familia', true, false, false, null, 'coordinador_th', false,
   'Beneficio institucional unificado en el formato desde la versión 02.', 7),
  ('Calamidad', 'Calamidad doméstica', true, false, true, null, 'coordinador_th', true,
   'No puede planearse con antelación: exenta de la regla de las 48 horas.', 8),
  ('Calamidad', 'Luto', true, false, true, null, 'coordinador_th', true,
   'Debe presentar registro de defunción. Exenta de la regla de las 48 horas.', 9),
  ('Empresarial', 'Movilidad sostenible', true, false, false, null, 'coordinador_th', false,
   null, 10),
  ('Empresarial', 'Comisión o actividad institucional', true, false, false, null, 'coordinador_th', false,
   null, 11),
  ('Empresarial', 'Solicitud de cesantías', true, true, false, null, 'gerente_th_directo', false,
   'Llega directamente a la bandeja de la Gerencia de Talento Humano, sin pasar por el coordinador.', 12)
) as v(categoria, nombre, remunerado, soporte_previo, soporte_posterior,
       umbral_dias, ruta, exento, descripcion, orden)
join public.permisos_categorias c on c.nombre = v.categoria
on conflict (categoria_id, nombre) do nothing;

-- Parámetros editables desde Administración
insert into public.permisos_config (clave, valor, descripcion) values
  ('dominio_permitido', '"cacsantabarbara.co"'::jsonb,
   'Único dominio de correo que puede auto-registrarse.'),
  ('antelacion_permiso_horas', '48'::jsonb,
   'Antelación mínima de un permiso. Advierte y marca como extemporánea; no bloquea.'),
  ('antelacion_vacaciones_dias', '20'::jsonb,
   'Antelación mínima de vacaciones. Advierte y marca como extemporánea; no bloquea.'),
  ('dias_umbral_soporte_cita_medica', '2'::jsonb,
   'Días de ausentismo a partir de los cuales la cita médica exige soporte posterior.'),
  ('dias_plazo_soporte_posterior', '5'::jsonb,
   'Días hábiles que tiene el colaborador para entregar el soporte posterior.'),
  ('max_mb_adjunto', '10'::jsonb,
   'Tamaño máximo de cada archivo de soporte, en megabytes.'),
  ('mime_adjuntos_permitidos',
   '["application/pdf","image/jpeg","image/png","image/webp"]'::jsonb,
   'Tipos de archivo aceptados como soporte.'),
  ('remitente_nombre', '"Talento Humano · CAC Santa Bárbara"'::jsonb,
   'Nombre que aparece como remitente de las notificaciones.'),
  ('remitente_correo', '"notificaciones@cacsantabarbara.co"'::jsonb,
   'Dirección verificada en Resend desde la que salen los correos.'),
  ('mfa_habilitado', 'false'::jsonb,
   'Reservado: activa el segundo factor cuando la clínica lo requiera.'),
  ('escalar_coordinador_horas', '24'::jsonb,
   'Horas sin decisión del coordinador antes de alertar a Talento Humano.')
on conflict (clave) do nothing;
