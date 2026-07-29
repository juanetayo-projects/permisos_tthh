-- =============================================================================
-- PERMISOS TTHH — 003 · Trazabilidad ISO 9001
-- Historial BPM, auditoría inmutable, bitácora de correos y bus de eventos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Línea de tiempo de la solicitud (lo que ve el usuario)
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_historial (
  id               bigserial primary key,
  solicitud_id     uuid not null references public.permisos_solicitudes (id) on delete cascade,
  estado_anterior  text,
  estado_nuevo     text not null,
  accion           text not null,
  actor_id         uuid references auth.users (id),
  actor_nombre     text,
  motivo           text,
  ip               text,
  created_at       timestamptz not null default now()
);

create index if not exists permisos_historial_solicitud_idx
  on public.permisos_historial (solicitud_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Auditoría (lo que exige ISO 9001): usuario, fecha, hora, IP, antes y después
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_auditoria (
  id              bigserial primary key,
  tabla           text not null,
  registro_id     text not null,
  accion          text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id        uuid,
  actor_correo    text,
  ip              text,
  user_agent      text,
  datos_antes     jsonb,
  datos_despues   jsonb,
  campos_cambiados text[],
  motivo          text,
  created_at      timestamptz not null default now()
);

create index if not exists permisos_auditoria_tabla_idx
  on public.permisos_auditoria (tabla, registro_id, created_at desc);
create index if not exists permisos_auditoria_actor_idx
  on public.permisos_auditoria (actor_id, created_at desc);

comment on table public.permisos_auditoria is
  'Registro inmutable: UPDATE y DELETE están revocados incluso para el rol '
  'authenticated. Solo se inserta desde triggers.';

-- -----------------------------------------------------------------------------
-- Bitácora de correos enviados con Resend
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_notificaciones (
  id            uuid primary key default gen_random_uuid(),
  solicitud_id  uuid references public.permisos_solicitudes (id) on delete set null,
  destinatario  text not null,
  plantilla     text not null,
  asunto        text,
  estado        text not null default 'pendiente'
                  check (estado in ('pendiente', 'enviado', 'error')),
  resend_id     text,
  error         text,
  intentos      integer not null default 0,
  enviado_en    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists permisos_notificaciones_estado_idx
  on public.permisos_notificaciones (estado, created_at desc);

-- -----------------------------------------------------------------------------
-- Bus de eventos: habilita automatizaciones e IA sin refactorizar (mejora §9.6)
-- -----------------------------------------------------------------------------
create table if not exists public.permisos_eventos (
  id          bigserial primary key,
  tipo        text not null,
  agregado_id text,
  payload     jsonb not null default '{}'::jsonb,
  actor_id    uuid,
  procesado   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists permisos_eventos_pendientes_idx
  on public.permisos_eventos (tipo, created_at) where procesado = false;

-- -----------------------------------------------------------------------------
-- Trigger genérico de auditoría
-- -----------------------------------------------------------------------------
create or replace function public.permisos_auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes    jsonb;
  v_despues  jsonb;
  v_id       text;
  v_campos   text[];
  v_correo   text;
begin
  if tg_op = 'DELETE' then
    v_antes   := to_jsonb(old);
    v_despues := null;
    v_id      := coalesce((to_jsonb(old) ->> 'id'), (to_jsonb(old) ->> 'user_id'));
  elsif tg_op = 'UPDATE' then
    v_antes   := to_jsonb(old);
    v_despues := to_jsonb(new);
    v_id      := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(new) ->> 'user_id'));
    select array_agg(clave)
      into v_campos
      from jsonb_each(v_despues) as e(clave, valor)
     where v_antes -> clave is distinct from valor;

    -- Sin cambios reales: no se registra ruido en la auditoría.
    if v_campos is null or array_length(v_campos, 1) is null then
      return new;
    end if;
  else
    v_antes   := null;
    v_despues := to_jsonb(new);
    v_id      := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(new) ->> 'user_id'));
  end if;

  select correo into v_correo
    from public.permisos_perfiles where user_id = auth.uid();

  insert into public.permisos_auditoria
    (tabla, registro_id, accion, actor_id, actor_correo, datos_antes, datos_despues, campos_cambiados)
  values
    (tg_table_name, v_id, tg_op, auth.uid(), v_correo, v_antes, v_despues, v_campos);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'permisos_empresas', 'permisos_tramites', 'permisos_categorias', 'permisos_tipos',
    'permisos_perfiles', 'permisos_solicitudes', 'permisos_detalle_permiso',
    'permisos_detalle_vacaciones', 'permisos_adjuntos', 'permisos_config'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.permisos_auditar()',
      t || '_auditar', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Historial automático de cambios de estado + emisión de eventos
-- -----------------------------------------------------------------------------
create or replace function public.permisos_registrar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_evento text;
begin
  if tg_op = 'UPDATE' and old.estado is not distinct from new.estado then
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
      when new.estado = 'APROBADA_TH' then 'Visto bueno de Talento Humano'
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

  v_evento := case
    when tg_op = 'INSERT' and new.estado <> 'BORRADOR' then 'SolicitudCreada'
    when new.estado in ('APROBADA_COORDINADOR', 'APROBADA_TH') then 'SolicitudAprobada'
    when new.estado like 'RECHAZADA%' then 'SolicitudRechazada'
    else null
  end;

  if v_evento is not null then
    insert into public.permisos_eventos (tipo, agregado_id, payload, actor_id)
    values (
      v_evento,
      new.id::text,
      jsonb_build_object(
        'consecutivo', new.consecutivo,
        'estado', new.estado,
        'tramite_id', new.tramite_id,
        'solicitante_id', new.solicitante_id
      ),
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists permisos_solicitudes_historial on public.permisos_solicitudes;
create trigger permisos_solicitudes_historial
  after insert or update of estado on public.permisos_solicitudes
  for each row execute function public.permisos_registrar_cambio_estado();
