-- =============================================================================
-- PERMISOS TTHH — 016 · La auditoría debe conocer la clave de cada tabla
--
-- ⚠️ Segundo fallo bloqueante de la misma ruta, detectado al probar el flujo.
--
-- `permisos_auditar()` resolvía el identificador del registro con
-- `coalesce(id, user_id)`. Las tablas de detalle —`permisos_detalle_permiso` y
-- `permisos_detalle_vacaciones`— no tienen ninguna de las dos: su clave
-- primaria es `solicitud_id`. Resultado: `registro_id` quedaba NULL y la
-- inserción en `permisos_auditoria` violaba el NOT NULL.
--
--     ERROR: null value in column "registro_id" violates not-null constraint
--
-- Efecto: TODA solicitud fallaba al guardar su detalle, es decir, al crearse.
--
-- Se añaden `solicitud_id` y `clave` al coalesce y, como último recurso, el
-- hash de la fila, para que ninguna tabla futura vuelva a romper la auditoría
-- por no llamar `id` a su clave primaria.
--
-- De paso se corrige el retorno en DELETE: devolvía `new`, que en un trigger
-- AFTER DELETE es NULL.
-- =============================================================================

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
  v_fuente   jsonb;
begin
  if tg_op = 'DELETE' then
    v_antes   := to_jsonb(old);
    v_despues := null;
    v_fuente  := v_antes;
  elsif tg_op = 'UPDATE' then
    v_antes   := to_jsonb(old);
    v_despues := to_jsonb(new);
    v_fuente  := v_despues;

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
    v_fuente  := v_despues;
  end if;

  v_id := coalesce(
    v_fuente ->> 'id',
    v_fuente ->> 'user_id',
    v_fuente ->> 'solicitud_id',
    v_fuente ->> 'clave',
    md5(v_fuente::text)
  );

  select correo into v_correo
    from public.permisos_perfiles where user_id = auth.uid();

  insert into public.permisos_auditoria
    (tabla, registro_id, accion, actor_id, actor_correo, datos_antes, datos_despues, campos_cambiados)
  values
    (tg_table_name, v_id, tg_op, auth.uid(), v_correo, v_antes, v_despues, v_campos);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
