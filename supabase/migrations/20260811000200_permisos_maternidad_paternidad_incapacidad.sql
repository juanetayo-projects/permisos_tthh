-- =============================================================================
-- PERMISOS TTHH — Maternidad y paternidad pasan a reportarse como incapacidad
-- =============================================================================
-- Igual que una incapacidad médica: a la colaboradora o al colaborador no se
-- les puede pedir que soliciten por adelantado una licencia que depende de un
-- hecho (el parto) que aún no ha ocurrido, y Talento Humano no «autoriza» una
-- licencia de maternidad, solo la registra. Se reportan igual que hoy se
-- reporta una incapacidad médica: las radica el jefe directo desde
-- «Reportar una incapacidad», entran directas a la bandeja de Talento Humano
-- sin pasar por su visto bueno, y la persona titular carga los soportes
-- después.
--
-- El cambio de `naturaleza` es lo único que hace falta para que hereden la
-- pantalla y la ruta de aprobación: `ReporteIncapacidad.tsx` ya filtra los
-- motivos por `naturaleza = 'incapacidad'`, y `SolicitudPermiso.tsx` ya
-- excluye esa naturaleza de su propio selector.
-- -----------------------------------------------------------------------------

update public.permisos_tipos
   set naturaleza = 'incapacidad',
       ruta_aprobacion = 'th_directo'
 where nombre in ('Licencia de maternidad', 'Licencia de paternidad');

-- -----------------------------------------------------------------------------
-- Duración legal fija vs. duración variable con tope
-- -----------------------------------------------------------------------------
-- Maternidad (126 días) y paternidad (14 días) tienen una duración exacta que
-- fija la ley: no se pregunta, se calcula desde la fecha de inicio. El resto
-- de incapacidades (enfermedad común, accidente de trabajo, enfermedad
-- laboral) tienen una duración variable con un tope: ahí sí hace falta pedir
-- el número de días. Es un dato de la fila y no un nombre hardcodeado en el
-- código, siguiendo el mismo criterio que el resto de reglas por motivo.
alter table public.permisos_tipos
  add column if not exists duracion_en_dias_fija boolean not null default false;

comment on column public.permisos_tipos.duracion_en_dias_fija is
  'Si es true, el formulario de incapacidad no pide fecha fin ni número de '
  'días: usa duracion_maxima_dias tal cual y calcula la fecha fin. Hoy solo '
  'aplica a licencia de maternidad (126) y paternidad (14).';

update public.permisos_tipos
   set duracion_en_dias_fija = true
 where nombre in ('Licencia de maternidad', 'Licencia de paternidad');

-- -----------------------------------------------------------------------------
-- Documentos exigidos en maternidad/paternidad
-- -----------------------------------------------------------------------------
-- Se suma el certificado de licencia (mismo documento que usa cualquier otra
-- incapacidad, `certificado_incapacidad`) y la historia clínica, que hasta
-- ahora no se pedían para estos dos motivos. El registro civil/certificado de
-- nacido vivo ya estaba exigido desde la migración 20260801000400 y no se
-- toca.
insert into public.permisos_tipos_documentos
  (tipo_id, documento_id, momento, obligatorio, desde_dias, nota, orden)
select t.id, d.id, v.momento, true, null, v.nota, v.orden
from (values
  ('Licencia de maternidad', 'certificado_incapacidad', 'previo',
   'Certificado o licencia expedida por la EPS.', 3),
  ('Licencia de maternidad', 'historia_clinica', 'posterior',
   'Epicrisis o resumen de la atención del parto.', 4),

  ('Licencia de paternidad', 'certificado_incapacidad', 'previo',
   'Certificado o licencia expedida por la EPS.', 2),
  ('Licencia de paternidad', 'historia_clinica', 'posterior',
   'Epicrisis o resumen de la atención del parto.', 3)
) as v(tipo, documento, momento, nota, orden)
join public.permisos_tipos t on t.nombre = v.tipo
join public.permisos_documentos d on d.codigo = v.documento
on conflict (tipo_id, documento_id, momento)
  do update set obligatorio = true, nota = excluded.nota;

-- -----------------------------------------------------------------------------
-- Soporte por duración, para toda incapacidad de duración variable
-- -----------------------------------------------------------------------------
-- Hasta ahora la historia clínica era opcional en incapacidad médica,
-- accidente de trabajo y enfermedad laboral. Pasa a ser obligatoria, pero
-- solo cuando la incapacidad supera 2 días — el mismo mecanismo de umbral que
-- ya usa «Cita médica» (`desde_dias`, evaluado en `documentosDelMomento()`).
-- De 1 o 2 días basta con el certificado que ya es obligatorio siempre.
update public.permisos_tipos_documentos td
   set obligatorio = true,
       desde_dias = 2,
       nota = 'Obligatoria cuando la incapacidad supera 2 días; puede '
              'reemplazarse por el radicado ante la EPS/ARL con el '
              'diagnóstico CIE10.'
  from public.permisos_tipos t, public.permisos_documentos d
 where td.tipo_id = t.id
   and td.documento_id = d.id
   and d.codigo = 'historia_clinica'
   and td.momento = 'posterior'
   and t.naturaleza = 'incapacidad'
   and t.nombre in ('Incapacidad médica', 'Incapacidad por accidente de trabajo',
                     'Incapacidad por enfermedad laboral');
