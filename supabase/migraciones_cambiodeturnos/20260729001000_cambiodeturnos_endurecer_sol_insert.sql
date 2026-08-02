-- =============================================================================
-- CAMBIO DE TURNOS — Endurecimiento de `sol_insert`
--
-- ⚠️ Esta migración toca una tabla de **otra aplicación** (Cambio de Turnos).
-- Se versiona aquí porque el hallazgo surgió al compartir el proyecto Supabase
-- entre ambas apps (decisión D2) y para dejar el rastro de la corrección.
--
-- Contexto: al compartir el proyecto, `auth.users` es común a las dos apps. La
-- policy de inserción solo exigía `solicitante_id = auth.uid()`, así que un
-- usuario que solo pertenece a Permisos podía crear por API una solicitud de
-- cambio de turno, pese a no tener perfil en esa aplicación. Leer datos ajenos
-- nunca fue posible: todas las policies de SELECT ya lo excluían.
--
-- Se añade la exigencia de tener fila en `profiles`. Se comprueba únicamente la
-- existencia y **no** el campo `activo`, para no alterar el comportamiento del
-- único perfil inactivo que existe hoy. Las condiciones de identidad originales
-- se conservan intactas.
--
-- Reversión: recrear la policy sin la primera condición del AND.
-- =============================================================================

drop policy if exists sol_insert on public.solicitudes;

create policy sol_insert on public.solicitudes
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid())
    and (
      solicitante_id = auth.uid()
      or correo_solicitante = (select profiles.correo from public.profiles where profiles.id = auth.uid())
      or is_admin()
    )
  );
