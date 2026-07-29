-- =============================================================================
-- PERMISOS TTHH — 011 · Duración del periodo completo de vacaciones
--
-- La app calcula la fecha final del disfrute a partir de los días hábiles que
-- el colaborador va a tomar. El periodo completo son 15 días hábiles, pero se
-- deja como parámetro para que Administración lo ajuste sin desplegar.
-- =============================================================================

insert into public.permisos_config (clave, valor, descripcion) values
  ('dias_vacaciones_periodo_completo', '15'::jsonb,
   'Días hábiles del periodo completo de vacaciones. La app calcula la fecha final a partir de este valor cuando el colaborador toma el periodo entero.')
on conflict (clave) do update
  set valor = excluded.valor, descripcion = excluded.descripcion;
