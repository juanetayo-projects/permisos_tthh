-- =============================================================================
-- PERMISOS TTHH — Separar la observación de una decisión del motivo de rechazo
-- =============================================================================
-- El diálogo de decisión ofrece un campo de texto en los dos casos: obligatorio
-- al rechazar («causa del rechazo») y opcional al autorizar («observación»).
-- Los dos acababan en `motivo_rechazo`, así que una solicitud AUTORIZADA con
-- observación se le mostraba al solicitante en un recuadro rojo de «Causa del
-- rechazo». Es el peor error posible en este flujo: dice justo lo contrario de
-- lo que pasó.
--
-- La observación pasa a su propia columna. El historial sigue guardando el
-- texto de cada paso, tomándolo de la columna que corresponda.
-- -----------------------------------------------------------------------------

alter table public.permisos_solicitudes
  add column if not exists observacion_decision text;

comment on column public.permisos_solicitudes.observacion_decision is
  'Anotación opcional de quien autoriza. Nunca es una causa de rechazo: eso '
  'vive en motivo_rechazo y se le pinta en rojo al solicitante.';

comment on column public.permisos_solicitudes.motivo_rechazo is
  'Solo para RECHAZADA_* y CANCELADA. Se muestra al solicitante y viaja en el '
  'correo de rechazo.';

-- -----------------------------------------------------------------------------
-- El historial toma el texto de la columna que corresponda al paso
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
    -- Una solicitud que avanza no arrastra el motivo de un rechazo anterior.
    case
      when new.estado like 'RECHAZADA%' or new.estado = 'CANCELADA' then new.motivo_rechazo
      else new.observacion_decision
    end
  );

  -- Los eventos los emite permisos_emitir_evento(); aqui solo trazabilidad.
  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- Corrección de los datos ya escritos
-- -----------------------------------------------------------------------------
-- Todo `motivo_rechazo` en una solicitud que no está rechazada ni cancelada es
-- en realidad la observación de quien autorizó: se mueve a su sitio. El trigger
-- de historial no se dispara aquí porque está declarado `update of estado`.
update public.permisos_solicitudes
   set observacion_decision = motivo_rechazo,
       motivo_rechazo = null
 where motivo_rechazo is not null
   and estado not like 'RECHAZADA%'
   and estado <> 'CANCELADA';
