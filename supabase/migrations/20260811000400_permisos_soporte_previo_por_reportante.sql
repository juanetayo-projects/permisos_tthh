-- =============================================================================
-- PERMISOS TTHH — Quien reporta una incapacidad también puede adjuntar el
-- soporte previo, si ya lo tiene
-- =============================================================================
-- Hasta ahora solo `solicitante_id` podía subir a `soportes-permisos`. Tenía
-- sentido cuando el soporte siempre llegaba después, cargado por el propio
-- colaborador. Pero para una incapacidad que el jefe directo reporta el mismo
-- día -sobre todo maternidad/paternidad, donde suele tener ya el certificado
-- a mano-, pedirle que espere a que el colaborador lo suba es una vuelta
-- innecesaria. Se amplía la policy de insert para admitir también a quien
-- quedó registrado en `reportada_por` para esa solicitud puntual -no a
-- cualquier coordinador del área, que sería más de lo que hace falta-.
-- -----------------------------------------------------------------------------

drop policy if exists permisos_soportes_insert on storage.objects;
create policy permisos_soportes_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'soportes-permisos'
    and exists (
      select 1 from public.permisos_solicitudes s
       where s.id::text = split_part(name, '/', 1)
         and s.deleted_at is null
         and (s.solicitante_id = auth.uid() or s.reportada_por = auth.uid())
    )
  );
