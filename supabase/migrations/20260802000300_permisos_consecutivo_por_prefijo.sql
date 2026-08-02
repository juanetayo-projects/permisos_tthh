-- =============================================================================
-- PERMISOS TTHH — El consecutivo vuelve a salir del prefijo del trámite
-- =============================================================================
-- ⚠️ Regresión detectada al añadir el tercer trámite.
--
-- El esquema original leía `prefijo_consecutivo` de `permisos_tramites`, que es
-- justo para lo que existe esa columna. La migración 013 —la que corrigió
-- `gen_random_bytes` -- reescribió la función entera y de paso cableó el
-- prefijo a un `CASE codigo when 'vacaciones' then 'VA' else 'PL' end`.
--
-- Con dos trámites nadie lo notó. Con el de cesantías, cuyo prefijo es `CE`, la
-- numeración habría salido `PL-2026-000xx`: un retiro de cesantías indistinguible
-- de un permiso en la carpeta de Talento Humano, y el contador de permisos
-- inflado con documentos que no lo son.
--
-- Se conserva lo que la 013 sí arregló: `extensions.gen_random_bytes`, con el
-- `search_path` acotado a `public` a propósito.
-- -----------------------------------------------------------------------------

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

  select prefijo_consecutivo into v_prefijo
    from public.permisos_tramites where id = new.tramite_id;

  insert into public.permisos_consecutivos (prefijo, anio, ultimo)
  values (coalesce(v_prefijo, 'PL'), v_anio, 1)
  on conflict (prefijo, anio) do update set ultimo = permisos_consecutivos.ultimo + 1
  returning ultimo into v_num;

  new.consecutivo := format('%s-%s-%s', coalesce(v_prefijo, 'PL'), v_anio, lpad(v_num::text, 5, '0'));

  -- pgcrypto vive en el esquema `extensions`; el search_path acotado a `public`
  -- es deliberado, así que la llamada se califica.
  new.codigo_verificacion := encode(extensions.gen_random_bytes(9), 'hex');
  new.enviada_en := coalesce(new.enviada_en, now());

  return new;
end;
$$;

revoke all on function public.permisos_asignar_consecutivo() from public, anon, authenticated;
