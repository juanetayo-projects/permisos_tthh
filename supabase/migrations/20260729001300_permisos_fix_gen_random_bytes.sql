-- =============================================================================
-- PERMISOS TTHH — 013 · Corrige el trigger que asigna el consecutivo
--
-- ⚠️ Fallo bloqueante detectado al probar el flujo de punta a punta.
--
-- `permisos_asignar_consecutivo()` llamaba a `gen_random_bytes(9)`, que vive en
-- la extensión **pgcrypto**. En Supabase pgcrypto se instala en el esquema
-- `extensions`, y la función declara `set search_path = public`, así que la
-- llamada fallaba con:
--
--     ERROR: function gen_random_bytes(integer) does not exist
--
-- Efecto: **toda** solicitud reventaba al salir de BORRADOR, es decir, al
-- enviarse. No se detectó antes porque el error solo aparece al insertar una
-- solicitud real, no al compilar ni al navegar.
--
-- Se califica el esquema explícitamente. Deliberadamente NO se amplía el
-- `search_path` a `extensions`: mantenerlo acotado a `public` es justo lo que
-- impide que alguien anteponga un esquema propio y secuestre la resolución de
-- nombres dentro de una función `security definer`.
-- =============================================================================

create or replace function public.permisos_asignar_consecutivo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefijo text;
  v_anio    int := extract(year from now() at time zone 'America/Bogota');
  v_num     int;
begin
  if new.estado = 'BORRADOR' or new.consecutivo is not null then
    return new;
  end if;

  select case codigo when 'vacaciones' then 'VA' else 'PL' end
    into v_prefijo
    from public.permisos_tramites
   where id = new.tramite_id;

  insert into public.permisos_consecutivos (prefijo, anio, ultimo)
  values (coalesce(v_prefijo, 'PL'), v_anio, 1)
  on conflict (prefijo, anio) do update set ultimo = permisos_consecutivos.ultimo + 1
  returning ultimo into v_num;

  new.consecutivo := format('%s-%s-%s', coalesce(v_prefijo, 'PL'), v_anio, lpad(v_num::text, 5, '0'));
  new.codigo_verificacion := encode(extensions.gen_random_bytes(9), 'hex');

  return new;
end;
$$;
