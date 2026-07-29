-- =============================================================================
-- PERMISOS TTHH — 006 · Storage de soportes
-- Los soportes contienen datos de salud: bucket PRIVADO, acceso solo por URL
-- firmada de corta duración. Ley 1581 de 2012 (habeas data).
-- Convención de rutas: {solicitud_id}/{momento}/{archivo}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'soportes-permisos',
  'soportes-permisos',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Quién puede ver un soporte: su dueño, el coordinador del área y Talento Humano.
create or replace function public.permisos_puede_ver_soporte(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.permisos_solicitudes s
     where s.id::text = split_part(p_ruta, '/', 1)
       and s.deleted_at is null
       and (
         s.solicitante_id = auth.uid()
         or public.permisos_coordina_area(s.area_id)
         or public.permisos_es_th()
       )
  );
$$;

drop policy if exists permisos_soportes_select on storage.objects;
create policy permisos_soportes_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'soportes-permisos'
    and public.permisos_puede_ver_soporte(name)
  );

-- Solo el solicitante sube soportes a su propia solicitud.
drop policy if exists permisos_soportes_insert on storage.objects;
create policy permisos_soportes_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'soportes-permisos'
    and exists (
      select 1 from public.permisos_solicitudes s
       where s.id::text = split_part(name, '/', 1)
         and s.solicitante_id = auth.uid()
         and s.deleted_at is null
    )
  );

-- Borrar un soporte solo es posible mientras la solicitud siga en borrador.
drop policy if exists permisos_soportes_delete on storage.objects;
create policy permisos_soportes_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'soportes-permisos'
    and exists (
      select 1 from public.permisos_solicitudes s
       where s.id::text = split_part(name, '/', 1)
         and s.solicitante_id = auth.uid()
         and s.estado = 'BORRADOR'
    )
  );
