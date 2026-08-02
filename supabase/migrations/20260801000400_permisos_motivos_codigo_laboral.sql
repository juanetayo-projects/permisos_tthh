-- =============================================================================
-- PERMISOS TTHH — Motivos que faltaban frente al Código Sustantivo del Trabajo
-- =============================================================================
-- Las cinco categorías se dejan tal cual: son las casillas impresas del
-- TH-F-002 y añadir una sexta desalinearía la aplicación del formato que firma
-- Calidad. Lo que faltaba estaba un nivel más abajo, en los motivos:
--
--   · El art. 57 num. 6 CST enumera cuatro situaciones y solo dos estaban
--     modeladas. Faltaban el desempeño de cargos transitorios de forzosa
--     aceptación y las comisiones sindicales.
--   · «Licencia de maternidad o paternidad» era un solo motivo para seis
--     licencias con duración, soporte y titular distintos. Con un único motivo
--     el indicador de ausentismo no puede distinguir 18 semanas de 2.
--   · El Decreto 1072 de 2015 obliga a separar el ausentismo por enfermedad
--     general del de origen laboral. Con una sola «Incapacidad médica» esa
--     separación no existía, y es justo la que pide la ARL.
--   · Ser jurado de votación no es lo mismo que votar: la Ley 1475 de 2011 da
--     un día compensatorio y la Ley 403 de 1997, media jornada.
--
-- Los motivos nuevos entran desactivados salvo los que sustituyen a uno que se
-- retira, para que Talento Humano los active tras dar el visto bueno. La
-- decisión de qué se activa es suya, no del código.
-- -----------------------------------------------------------------------------

insert into public.permisos_tipos
  (categoria_id, nombre, remunerado_por_defecto, requiere_soporte_previo,
   requiere_soporte_posterior, soporte_obligatorio_desde_dias, ruta_aprobacion,
   exento_antelacion, dias_calendario, naturaleza, genera_ausentismo,
   fundamento_legal, dias_max_retroactivo, dias_max_futuro, duracion_maxima_dias,
   permite_horas, plazo_soporte_dias, plazo_soporte_habiles, max_por_periodo,
   periodo_control, interrumpe_otros, prioridad, descripcion, orden, activo)
select c.id, v.nombre, v.remunerado, false, false, null, v.ruta,
       v.exento, v.calendario, v.naturaleza, v.ausentismo, v.fundamento,
       v.retro, v.futuro, v.max_dias, v.horas, v.plazo, v.habiles, v.cupo,
       v.periodo, v.interrumpe, v.prioridad, v.descripcion, v.orden, v.activo
from (values
  -- ---------------------------------------------------------------- Salud ---
  ('Salud', 'Incapacidad por accidente de trabajo', true, 'coordinador_th',
   true, true, 'incapacidad', true,
   'Decreto 1072 de 2015, libro 2 parte 2 título 4 · Ley 1562 de 2012. La '
   'califica y la paga la ARL, no la EPS.',
   30, 30, 180, false, 3, true, null, 'ninguno', true, 30,
   'Se separa de la incapacidad por enfermedad general porque el indicador de '
   'ausentismo laboral y el reporte a la ARL exigen distinguirlas.', 13, true),

  ('Salud', 'Incapacidad por enfermedad laboral', true, 'coordinador_th',
   true, true, 'incapacidad', true,
   'Ley 1562 de 2012, art. 4 · Decreto 1477 de 2014 (tabla de enfermedades '
   'laborales).',
   30, 30, 180, false, 3, true, null, 'ninguno', true, 30,
   null, 14, true),

  ('Salud', 'Licencia de maternidad', true, 'coordinador_th',
   false, true, 'licencia', true,
   'Art. 236 CST · Ley 1822 de 2017 · Ley 2114 de 2021: 18 semanas, con al '
   'menos una semana antes de la fecha probable de parto.',
   30, 300, 126, false, 30, false, null, 'ninguno', true, 25,
   'Sustituye al motivo genérico «Licencia de maternidad o paternidad».', 15, true),

  ('Salud', 'Licencia de paternidad', true, 'coordinador_th',
   false, true, 'licencia', true,
   'Art. 236 par. 1 CST · Ley 2114 de 2021: 2 semanas remuneradas por la EPS.',
   30, 300, 14, false, 30, false, null, 'ninguno', true, 25,
   null, 16, true),

  ('Salud', 'Licencia parental compartida', true, 'coordinador_th',
   false, true, 'licencia', true,
   'Art. 236 par. 2 CST, adicionado por la Ley 2114 de 2021: la madre cede '
   'hasta 6 de las últimas semanas de su licencia al otro progenitor.',
   30, 300, 42, false, 30, false, null, 'ninguno', true, 25,
   null, 17, false),

  ('Salud', 'Licencia parental flexible de tiempo parcial', true, 'coordinador_th',
   false, true, 'licencia', true,
   'Art. 236 par. 3 CST, adicionado por la Ley 2114 de 2021: cambia semanas de '
   'licencia por trabajo de medio tiempo por el doble de tiempo.',
   30, 300, null, false, 30, false, null, 'ninguno', false, 20,
   'Requiere acuerdo escrito con el empleador y aviso a la EPS.', 18, false),

  ('Salud', 'Licencia por aborto o parto prematuro', true, 'coordinador_th',
   true, true, 'licencia', true,
   'Art. 237 CST: descanso remunerado de 2 a 4 semanas según prescripción '
   'médica.',
   30, 60, 28, false, 15, true, null, 'ninguno', true, 25,
   null, 19, false),

  ('Salud', 'Licencia por adopción', true, 'coordinador_th',
   false, true, 'licencia', true,
   'Art. 236 par. 4 CST: la misma licencia de maternidad, contada desde la '
   'entrega oficial del menor.',
   30, 300, 126, false, 30, false, null, 'ninguno', true, 25,
   null, 20, false),

  ('Salud', 'Control prenatal', true, 'coordinador_th',
   false, false, 'permiso', true,
   'Art. 236 CST · Resolución 3280 de 2018: asistencia a los controles del '
   'programa de atención materno perinatal.',
   1, 270, 1, true, 5, true, null, 'ninguno', false, 5,
   null, 21, true),

  ('Salud', 'Donación de sangre', true, 'coordinador_th',
   false, false, 'permiso', true,
   'Ley 1805 de 2016, art. 9: medio día de descanso remunerado el día de la '
   'donación o dentro del mes siguiente.',
   1, 60, 1, true, 30, false, null, 'ninguno', false, 0,
   null, 22, true),

  ('Salud', 'Acompañamiento a cita médica de familiar a cargo', false, 'coordinador_th',
   false, false, 'permiso', true,
   'Art. 57 num. 6 CST · Ley 1857 de 2017: permiso concedido por el empleador '
   'para acompañar a un familiar dependiente.',
   1, 180, 1, true, 5, true, null, 'ninguno', false, 0,
   null, 23, true),

  -- ------------------------------------------------------------- Personal ---
  ('Personal', 'Jurado de votación', true, 'coordinador_th',
   false, false, 'permiso', true,
   'Ley 1475 de 2011, art. 5: día compensatorio remunerado dentro de los 45 '
   'días siguientes a la votación. No se acumula con el de la Ley 403.',
   30, 60, 1, false, 45, false, null, 'ninguno', false, 0,
   null, 24, true),

  ('Personal', 'Citación judicial o administrativa', true, 'coordinador_th',
   false, false, 'permiso', true,
   'Art. 57 num. 6 CST · Ley 1564 de 2012: comparecencia obligatoria ante '
   'autoridad judicial o administrativa.',
   5, 180, 2, true, 5, true, null, 'ninguno', false, 5,
   null, 25, true),

  ('Personal', 'Cargo transitorio de forzosa aceptación', true, 'coordinador_th',
   false, false, 'permiso', true,
   'Art. 57 num. 6 CST: desempeño de cargos oficiales transitorios de forzosa '
   'aceptación.',
   5, 180, 5, false, 10, true, null, 'ninguno', false, 5,
   null, 26, true),

  ('Personal', 'Formación o estudio', false, 'coordinador_th',
   false, false, 'permiso', true,
   'Art. 21 Ley 50 de 1990: espacios dedicados a capacitación y actividades '
   'formativas dentro de la jornada.',
   0, 180, 2, true, 5, true, null, 'ninguno', false, 0,
   null, 27, true),

  ('Personal', 'Permiso no remunerado', false, 'coordinador_th',
   false, false, 'permiso', true,
   'Art. 57 num. 6 CST: permiso concedido por el empleador con descuento de '
   'nómina. Requiere acuerdo expreso sobre el descuento.',
   0, 180, 30, true, null, true, null, 'ninguno', false, 0,
   null, 28, true),

  -- ---------------------------------------------------------- Empresarial ---
  ('Empresarial', 'Comisión sindical', true, 'coordinador_th',
   false, false, 'permiso', false,
   'Art. 57 num. 6 CST · Convenio 135 de la OIT: permiso para el desempeño de '
   'comisiones sindicales inherentes a la organización.',
   0, 180, 5, true, 5, true, null, 'ninguno', false, 0,
   'No cuenta como ausentismo: es tiempo de representación reconocido por la '
   'ley.', 29, true),

  ('Empresarial', 'Capacitación institucional', true, 'coordinador_th',
   false, false, 'permiso', false,
   'Actividad programada por la clínica. El colaborador está cumpliendo una '
   'función de la empresa.',
   0, 365, null, true, null, true, null, 'ninguno', false, 0,
   null, 30, true)
) as v(categoria, nombre, remunerado, ruta, exento, calendario, naturaleza,
       ausentismo, fundamento, retro, futuro, max_dias, horas, plazo, habiles,
       cupo, periodo, interrumpe, prioridad, descripcion, orden, activo)
join public.permisos_categorias c on c.nombre = v.categoria
on conflict (categoria_id, nombre) do nothing;

-- -----------------------------------------------------------------------------
-- El motivo genérico de maternidad/paternidad se retira
-- -----------------------------------------------------------------------------
-- No se borra: las solicitudes ya radicadas apuntan a él y deben seguir
-- leyéndose. Se desactiva, que es como esta aplicación jubila un catálogo.
update public.permisos_tipos
   set activo = false,
       descripcion = 'Reemplazado por «Licencia de maternidad» y «Licencia de '
                     'paternidad», que tienen duración y soporte distintos.'
 where nombre = 'Licencia de maternidad o paternidad';

-- La incapacidad que ya existía es la de enfermedad general: se nombra.
update public.permisos_tipos
   set descripcion = 'Incapacidad de origen común expedida por la EPS. Las de '
                     'origen laboral tienen motivo propio porque se reportan a '
                     'la ARL y se miden aparte.'
 where nombre = 'Incapacidad médica';

-- «Votaciones» convive con «Jurado de votación»: son beneficios distintos.
update public.permisos_tipos
   set descripcion = 'Media jornada de descanso compensatorio por ejercer el '
                     'sufragio (Ley 403 de 1997). Si además fuiste jurado, usa '
                     '«Jurado de votación»: son beneficios distintos y no se '
                     'acumulan.'
 where nombre = 'Votaciones';

-- -----------------------------------------------------------------------------
-- Documentos de los motivos nuevos
-- -----------------------------------------------------------------------------
insert into public.permisos_tipos_documentos
  (tipo_id, documento_id, momento, obligatorio, desde_dias, nota, orden)
select t.id, d.id, v.momento, v.obligatorio, null, v.nota, v.orden
from (values
  ('Incapacidad por accidente de trabajo', 'certificado_incapacidad', 'previo', true,
   'Incapacidad expedida o transcrita por la ARL.', 1),
  ('Incapacidad por accidente de trabajo', 'historia_clinica', 'posterior', false,
   'Para el reporte del accidente ante la ARL cuando lo soliciten.', 2),

  ('Incapacidad por enfermedad laboral', 'certificado_incapacidad', 'previo', true,
   null, 1),
  ('Incapacidad por enfermedad laboral', 'historia_clinica', 'posterior', false,
   null, 2),

  ('Licencia de maternidad', 'certificado_medico_prenatal', 'previo', true,
   'Indica la fecha probable de parto y habilita el inicio de la licencia.', 1),
  ('Licencia de maternidad', 'certificado_nacido_vivo', 'posterior', true,
   'Registro civil de nacimiento dentro de los 30 días siguientes al parto.', 2),

  ('Licencia de paternidad', 'certificado_nacido_vivo', 'previo', true,
   'La licencia se cuenta desde el nacimiento y la EPS la exige para el pago.', 1),

  ('Licencia parental compartida', 'certificado_nacido_vivo', 'previo', true, null, 1),
  ('Licencia parental flexible de tiempo parcial', 'certificado_nacido_vivo', 'previo', true, null, 1),
  ('Licencia por aborto o parto prematuro', 'certificado_incapacidad', 'previo', true,
   'Certificado médico que prescribe el descanso y su duración.', 1),
  ('Licencia por adopción', 'certificado_nacido_vivo', 'previo', true,
   'Acta de entrega del menor expedida por el ICBF o la autoridad competente.', 1),

  ('Control prenatal', 'constancia_asistencia_medica', 'posterior', true, null, 1),
  ('Donación de sangre', 'constancia_donacion', 'posterior', true, null, 1),
  ('Acompañamiento a cita médica de familiar a cargo', 'constancia_asistencia_medica',
   'posterior', true, 'A nombre del familiar acompañado.', 1),

  ('Jurado de votación', 'acto_designacion', 'previo', false,
   'Notificación de la Registraduría, si ya la recibiste.', 1),
  ('Jurado de votación', 'certificado_electoral', 'posterior', true,
   'Constancia de haber ejercido como jurado.', 2),

  ('Citación judicial o administrativa', 'citacion_autoridad', 'previo', true, null, 1),
  ('Citación judicial o administrativa', 'constancia_comparecencia', 'posterior', true, null, 2),

  ('Cargo transitorio de forzosa aceptación', 'acto_designacion', 'previo', true, null, 1),
  ('Cargo transitorio de forzosa aceptación', 'constancia_comparecencia', 'posterior', true, null, 2),

  ('Formación o estudio', 'certificado_estudio', 'previo', false, null, 1),
  ('Formación o estudio', 'certificado_estudio', 'posterior', true,
   'Constancia de asistencia a la actividad académica.', 2),

  ('Comisión sindical', 'carta_sindicato', 'previo', true, null, 1)
) as v(tipo, documento, momento, obligatorio, nota, orden)
join public.permisos_tipos t on t.nombre = v.tipo
join public.permisos_documentos d on d.codigo = v.documento
on conflict (tipo_id, documento_id, momento) do nothing;
