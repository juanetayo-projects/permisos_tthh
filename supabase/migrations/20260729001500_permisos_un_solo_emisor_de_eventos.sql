-- =============================================================================
-- PERMISOS TTHH — 015 · Un único emisor de eventos
--
-- ⚠️ Defecto introducido por la migración 014 y detectado al probarla.
--
-- La 014 añadió `permisos_emitir_evento()`, pero `permisos_registrar_cambio_estado()`
-- **ya emitía eventos** desde la migración 003. Con los dos activos, un envío
-- de solicitud o un rechazo escribían el evento DOS VECES, lo que habría
-- duplicado cualquier automatización futura que se colgara del bus.
--
-- Se separan responsabilidades:
--   · `permisos_registrar_cambio_estado()` → solo la línea de tiempo (`permisos_historial`).
--   · `permisos_emitir_evento()`           → único responsable del bus.
--
-- De paso se completan dos etiquetas del historial que faltaban:
-- `PENDIENTE_SOPORTE` y `FINALIZADA` caían en el genérico "Cambio de estado".
--
-- Verificado tras el cambio: un envío seguido de un rechazo produce
-- exactamente un `SolicitudCreada` y un `SolicitudRechazada`.
-- =============================================================================

create or replace function public.permisos_registrar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado then
    return new;
  end if;

  select nombre into v_nombre
    from public.permisos_perfiles where user_id = auth.uid();

  insert into public.permisos_historial
    (solicitud_id, estado_anterior, estado_nuevo, accion, actor_id, actor_nombre, motivo)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.estado else null end,
    new.estado,
    case
      when tg_op = 'INSERT' and new.estado = 'BORRADOR' then 'Creación del borrador'
      when tg_op = 'INSERT' then 'Solicitud enviada'
      when new.estado in ('APROBADA_COORDINADOR', 'PENDIENTE_TH') then 'Autorizada por el jefe directo'
      when new.estado = 'PENDIENTE_SOPORTE' then 'Visto bueno de Talento Humano, pendiente de soporte'
      when new.estado in ('APROBADA_TH', 'FINALIZADA') then 'Visto bueno de Talento Humano'
      when new.estado like 'RECHAZADA%' then 'Rechazada'
      when new.estado = 'CANCELADA' then 'Cancelada por el solicitante'
      when new.estado = 'VENCIDA' then 'Vencida sin decisión'
      when new.estado = 'ARCHIVADA' then 'Archivada'
      else 'Cambio de estado'
    end,
    auth.uid(),
    v_nombre,
    new.motivo_rechazo
  );

  -- Los eventos los emite permisos_emitir_evento(); aquí solo trazabilidad.
  return new;
end;
$$;
