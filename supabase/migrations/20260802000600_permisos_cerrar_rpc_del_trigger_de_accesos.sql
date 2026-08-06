-- =============================================================================
-- PERMISOS TTHH — 031 · La función del trigger no se expone por RPC
--
-- Lo destapó el linter de Supabase justo después de aplicar la migración 030.
--
-- `permisos_proteger_acceso_admin()` es una función de trigger, pero al
-- crearse heredó el EXECUTE por defecto de `public`, así que quedaba colgando
-- en `/rest/v1/rpc/` y llamable **incluso sin sesión**. Invocarla a mano
-- fallaría —no hay contexto de trigger que leer—, pero una función
-- SECURITY DEFINER al alcance del rol `anon` no tiene por qué estar ahí.
--
-- El trigger no pierde nada: corre como propietario de la función y no
-- necesita este permiso.
-- =============================================================================

revoke all on function public.permisos_proteger_acceso_admin()
  from public, anon, authenticated;

comment on function public.permisos_proteger_acceso_admin() is
  'Solo para el trigger de permisos_acceso_rol. Sin EXECUTE para nadie: no es una RPC.';
