-- =============================================================================
-- PERMISOS TTHH — 007 · Endurecimiento de funciones SECURITY DEFINER
-- Responde a los avisos del linter de seguridad de Supabase.
--
-- Las funciones de trigger no las invoca nadie por RPC: se les revoca EXECUTE
-- por completo. Las funciones predicado SÍ las necesita `authenticated`, porque
-- las expresiones de una policy RLS se evalúan con los privilegios de quien
-- consulta; a esas solo se les revoca `anon` y `public`.
-- =============================================================================

revoke all on function public.permisos_auditar()                  from public, anon, authenticated;
revoke all on function public.permisos_registrar_cambio_estado()   from public, anon, authenticated;
revoke all on function public.permisos_asignar_consecutivo()       from public, anon, authenticated;
revoke all on function public.permisos_touch_updated_at()          from public, anon, authenticated;
revoke all on function public.permisos_siguiente_consecutivo(text) from public, anon, authenticated;

revoke all on function public.permisos_rol()                       from public, anon;
revoke all on function public.permisos_es_admin()                  from public, anon;
revoke all on function public.permisos_es_th()                     from public, anon;
revoke all on function public.permisos_es_gerente_th()             from public, anon;
revoke all on function public.permisos_perfil_activo()             from public, anon;
revoke all on function public.permisos_areas_coordinadas()         from public, anon;
revoke all on function public.permisos_coordina_area(integer)      from public, anon;
revoke all on function public.permisos_puede_ver_soporte(text)     from public, anon;

grant execute on function public.permisos_rol()                    to authenticated;
grant execute on function public.permisos_es_admin()               to authenticated;
grant execute on function public.permisos_es_th()                  to authenticated;
grant execute on function public.permisos_es_gerente_th()          to authenticated;
grant execute on function public.permisos_perfil_activo()          to authenticated;
grant execute on function public.permisos_areas_coordinadas()      to authenticated;
grant execute on function public.permisos_coordina_area(integer)   to authenticated;
grant execute on function public.permisos_puede_ver_soporte(text)  to authenticated;

comment on table public.permisos_consecutivos is
  'RLS habilitado y sin policies a propósito: nadie accede directamente. Los '
  'números solo se generan desde permisos_siguiente_consecutivo(), que es '
  'SECURITY DEFINER.';
