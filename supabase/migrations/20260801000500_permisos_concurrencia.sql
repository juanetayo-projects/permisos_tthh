-- =============================================================================
-- PERMISOS TTHH — Qué pasa cuando algo ocurre durante un permiso ya autorizado
-- =============================================================================
-- El motor daba por hecho que las ausencias no se tocan entre sí. En la vida
-- real se tocan todo el tiempo, y el Código lo resuelve de una manera concreta:
--
--   · **Vacaciones interrumpidas por incapacidad.** Las vacaciones son descanso
--     y la incapacidad no lo es, así que la incapacidad las suspende y los días
--     no disfrutados quedan pendientes de reprogramar (art. 187 CST y doctrina
--     reiterada del Ministerio del Trabajo). Antes la aplicación cerraba las
--     vacaciones completas y el colaborador perdía los días.
--   · **Luto interrumpido por incapacidad.** Igual: la licencia de luto no
--     absorbe una incapacidad que aparece dentro de ella.
--   · **Calamidad durante vacaciones.** No suspende por sí sola —el descanso
--     sigue corriendo— salvo que derive en incapacidad. Se registra y queda
--     como antecedente, sin partir el periodo.
--
-- Quien decide es Talento Humano, no el sistema: la aplicación detecta el cruce,
-- propone qué manda según la prioridad del motivo y deja constancia. Ese es el
-- criterio de toda la aplicación —advertir, no bloquear— y aquí importa más que
-- en ningún otro sitio, porque partir un periodo tiene efecto en nómina.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Estado nuevo
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
      'SUSPENDIDA',
      'FINALIZADA',
      'ARCHIVADA',
      'RECHAZADA_COORDINADOR',
      'RECHAZADA_TH',
      'CANCELADA',
      'VENCIDA'
    ])
  );

-- -----------------------------------------------------------------------------
-- Trazabilidad de la interrupción
-- -----------------------------------------------------------------------------
alter table public.permisos_solicitudes
  add column if not exists interrumpida_por_id uuid
    references public.permisos_solicitudes (id),
  add column if not exists fecha_interrupcion date,
  add column if not exists dias_pendientes_reprogramar numeric(5, 1),
  add column if not exists reprograma_a_id uuid
    references public.permisos_solicitudes (id),
  add column if not exists nota_interrupcion text;

comment on column public.permisos_solicitudes.interrumpida_por_id is
  'Solicitud que interrumpió a esta. El vínculo va en los dos sentidos para que '
  'el detalle de cualquiera de las dos muestre la otra.';

comment on column public.permisos_solicitudes.fecha_interrupcion is
  'Primer día que ya no se disfruta. El periodo efectivo va de fecha_inicio a '
  'fecha_interrupcion - 1.';

comment on column public.permisos_solicitudes.dias_pendientes_reprogramar is
  'Días que quedaron sin disfrutar. Se calculan en el cliente con el mismo '
  'calendario de festivos que usa el resto de la aplicación —hábiles o '
  'calendario según el motivo— en vez de reimplementar la Ley Emiliani en SQL.';

comment on column public.permisos_solicitudes.reprograma_a_id is
  'Solicitud nueva que consume los días pendientes. Cierra el ciclo: sin ella, '
  'un periodo suspendido se queda para siempre en la lista de pendientes.';

create index if not exists permisos_solicitudes_suspendidas_idx
  on public.permisos_solicitudes (solicitante_id)
  where estado = 'SUSPENDIDA' and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Interrumpir: una sola operación, no tres updates sueltos desde el cliente
-- -----------------------------------------------------------------------------
-- Hacerlo en tres llamadas dejaba estados a medias en cuanto una fallaba: el
-- periodo suspendido sin vínculo, o el vínculo sin los días pendientes.
create or replace function public.permisos_interrumpir(
  p_solicitud        uuid,
  p_interruptora     uuid,
  p_fecha            date,
  p_dias_pendientes  numeric,
  p_nota             text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio date;
  v_fin    date;
begin
  if not (public.permisos_es_th()
          or public.permisos_coordina_area(
               (select area_id from public.permisos_solicitudes where id = p_solicitud))) then
    raise exception 'Solo Talento Humano o el jefe directo pueden interrumpir un permiso.'
      using errcode = '42501';
  end if;

  select fecha_inicio, fecha_fin into v_inicio, v_fin
    from public.permisos_solicitudes
   where id = p_solicitud and deleted_at is null
   for update;

  if v_inicio is null then
    raise exception 'La solicitud que se intenta interrumpir no existe.';
  end if;

  if p_fecha <= v_inicio then
    raise exception 'La interrupción debe empezar después del primer día del periodo. '
                    'Si el permiso no llegó a disfrutarse, cancélalo en vez de interrumpirlo.';
  end if;
  if p_fecha > v_fin then
    raise exception 'La interrupción cae fuera del periodo: no hay nada que suspender.';
  end if;

  update public.permisos_solicitudes
     set estado                      = 'SUSPENDIDA',
         interrumpida_por_id         = p_interruptora,
         fecha_interrupcion          = p_fecha,
         dias_pendientes_reprogramar = p_dias_pendientes,
         nota_interrupcion           = p_nota
   where id = p_solicitud;
end;
$$;

revoke all on function public.permisos_interrumpir(uuid, uuid, date, numeric, text) from public, anon;
grant execute on function public.permisos_interrumpir(uuid, uuid, date, numeric, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Reprogramar los días pendientes
-- -----------------------------------------------------------------------------
create or replace function public.permisos_reprogramar(
  p_suspendida  uuid,
  p_nueva       uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.permisos_es_th()
          or exists (select 1 from public.permisos_solicitudes
                      where id = p_suspendida and solicitante_id = auth.uid())) then
    raise exception 'No puedes reprogramar un periodo que no es tuyo.'
      using errcode = '42501';
  end if;

  update public.permisos_solicitudes
     set reprograma_a_id = p_nueva
   where id = p_suspendida and estado = 'SUSPENDIDA';
end;
$$;

revoke all on function public.permisos_reprogramar(uuid, uuid) from public, anon;
grant execute on function public.permisos_reprogramar(uuid, uuid) to authenticated;

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
      when new.estado = 'SUSPENDIDA' then 'Periodo interrumpido: quedan días por reprogramar'
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
      when new.estado = 'SUSPENDIDA' then new.nota_interrupcion
      else new.observacion_decision
    end
  );

  return new;
end;
$function$;
