-- =============================================================================
-- PERMISOS TTHH — Estado intermedio: soporte entregado, a la espera de TH
-- =============================================================================
-- `PENDIENTE_SOPORTE` mezclaba dos situaciones muy distintas: la solicitud a la
-- que le falta el documento —la pelota la tiene el colaborador— y aquella cuyo
-- documento ya está entregado y espera revisión —la pelota la tiene Talento
-- Humano—. Se distinguían solo por un booleano del detalle, así que la bandeja
-- de TH mostraba también las que no puede tocar y nadie sabía a quién le tocaba
-- mover.
--
-- Con `SOPORTE_EN_VALIDACION` cada estado tiene un único responsable, y aparece
-- el camino de vuelta: si el documento no sirve, TH lo devuelve y el
-- colaborador sube otro.
-- -----------------------------------------------------------------------------

alter table public.permisos_solicitudes
  drop constraint if exists permisos_solicitudes_estado_check;

alter table public.permisos_solicitudes
  add constraint permisos_solicitudes_estado_check check (
    estado = any (array[
      'BORRADOR',
      'PENDIENTE_COORDINADOR',
      'APROBADA_COORDINADOR',
      'PENDIENTE_TH',
      'PENDIENTE_GERENCIA_TH',
      'APROBADA_TH',
      'PENDIENTE_SOPORTE',
      'SOPORTE_EN_VALIDACION',
      'FINALIZADA',
      'ARCHIVADA',
      'RECHAZADA_COORDINADOR',
      'RECHAZADA_TH',
      'CANCELADA',
      'VENCIDA'
    ])
  );

-- -----------------------------------------------------------------------------
-- El colaborador sale de PENDIENTE_SOPORTE al entregar; a partir de ahí la
-- solicitud es de Talento Humano y él ya no puede tocarla.
-- -----------------------------------------------------------------------------
drop policy if exists permisos_solicitudes_update_propia on public.permisos_solicitudes;
create policy permisos_solicitudes_update_propia on public.permisos_solicitudes
  for update to authenticated
  using (
    solicitante_id = auth.uid()
    and estado in ('BORRADOR', 'PENDIENTE_COORDINADOR', 'APROBADA_COORDINADOR',
                   'PENDIENTE_TH', 'PENDIENTE_GERENCIA_TH', 'PENDIENTE_SOPORTE')
  )
  with check (solicitante_id = auth.uid());

-- -----------------------------------------------------------------------------
-- El historial nombra el paso nuevo
-- -----------------------------------------------------------------------------
create or replace function public.permisos_registrar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
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
      when new.estado = 'PENDIENTE_SOPORTE' and tg_op = 'UPDATE' and old.estado = 'SOPORTE_EN_VALIDACION'
        then 'Soporte devuelto por Talento Humano'
      when new.estado = 'PENDIENTE_SOPORTE' then 'Visto bueno de Talento Humano, pendiente de soporte'
      when new.estado = 'SOPORTE_EN_VALIDACION' then 'Soporte entregado por el colaborador'
      when new.estado in ('APROBADA_TH', 'FINALIZADA') then 'Visto bueno de Talento Humano'
      when new.estado like 'RECHAZADA%' then 'Rechazada'
      when new.estado = 'CANCELADA' then 'Cancelada por el solicitante'
      when new.estado = 'VENCIDA' then 'Vencida sin decisión'
      when new.estado = 'ARCHIVADA' then 'Archivada'
      else 'Cambio de estado'
    end,
    auth.uid(),
    v_nombre,
    case
      when new.estado like 'RECHAZADA%' or new.estado = 'CANCELADA' then new.motivo_rechazo
      else new.observacion_decision
    end
  );

  return new;
end;
$function$;
