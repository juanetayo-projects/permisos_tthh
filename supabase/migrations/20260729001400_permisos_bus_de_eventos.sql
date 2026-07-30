-- =============================================================================
-- PERMISOS TTHH — 014 · Bus de eventos
--
-- La tabla `permisos_eventos` existía desde el esquema inicial, pero el único
-- emisor (dentro del trigger de historial) solo cubría tres casos y ni siquiera
-- contemplaba `PENDIENTE_TH`, que es el estado real al que pasa una solicitud
-- cuando la autoriza el jefe directo. En la práctica, la mejora 6 de la
-- arquitectura —"bus de eventos desde el día uno"— estaba a medias.
--
-- Aquí se conecta de verdad, con un emisor único que cubre todas las
-- transiciones y también los adjuntos. Los eventos son el punto de extensión
-- para automatizaciones futuras (recordatorios, IA, integración con nómina)
-- sin tener que refactorizar el flujo: basta con leer esta tabla.
--
-- La migración 015 retira el emisor antiguo para que no haya duplicados.
-- =============================================================================

create or replace function public.permisos_emitir_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
begin
  if tg_table_name = 'permisos_adjuntos' then
    insert into public.permisos_eventos (tipo, agregado_id, payload, actor_id)
    values ('DocumentoAdjunto', new.solicitud_id::text,
            jsonb_build_object('solicitud_id', new.solicitud_id, 'momento', new.momento,
                               'nombre_archivo', new.nombre_archivo),
            auth.uid());
    return new;
  end if;

  -- permisos_solicitudes
  if tg_op = 'INSERT' then
    v_tipo := case when new.estado = 'BORRADOR' then null else 'SolicitudCreada' end;
  elsif new.estado is distinct from old.estado then
    v_tipo := case new.estado
      when 'PENDIENTE_COORDINADOR'  then 'SolicitudCreada'
      when 'PENDIENTE_GERENCIA_TH'  then 'SolicitudCreada'
      when 'PENDIENTE_TH'           then 'SolicitudAprobada'
      when 'APROBADA_TH'            then 'SolicitudAprobada'
      when 'PENDIENTE_SOPORTE'      then 'SolicitudAprobada'
      when 'FINALIZADA'             then 'SolicitudFinalizada'
      when 'RECHAZADA_COORDINADOR'  then 'SolicitudRechazada'
      when 'RECHAZADA_TH'           then 'SolicitudRechazada'
      when 'CANCELADA'              then 'SolicitudCancelada'
      when 'VENCIDA'                then 'SolicitudVencida'
      when 'ARCHIVADA'              then 'SolicitudArchivada'
      else null
    end;
  end if;

  if v_tipo is null then return new; end if;

  insert into public.permisos_eventos (tipo, agregado_id, payload, actor_id)
  values (v_tipo, new.id::text,
          jsonb_build_object(
            'solicitud_id', new.id,
            'consecutivo', new.consecutivo,
            'estado_anterior', case when tg_op = 'UPDATE' then old.estado else null end,
            'estado', new.estado,
            'tramite_id', new.tramite_id,
            'solicitante_id', new.solicitante_id,
            'area_id', new.area_id,
            'motivo', new.motivo_rechazo),
          auth.uid());

  return new;
end;
$$;

drop trigger if exists permisos_solicitudes_eventos on public.permisos_solicitudes;
create trigger permisos_solicitudes_eventos
  after insert or update on public.permisos_solicitudes
  for each row execute function public.permisos_emitir_evento();

drop trigger if exists permisos_adjuntos_eventos on public.permisos_adjuntos;
create trigger permisos_adjuntos_eventos
  after insert on public.permisos_adjuntos
  for each row execute function public.permisos_emitir_evento();
