-- =============================================================================
-- PERMISOS TTHH — Diagnósticos relacionados (CIE10) de la incapacidad
-- =============================================================================
-- El certificado de incapacidad admite un diagnóstico principal y hasta tres
-- relacionados (Dx principal, Dx Rel-1, Dx Rel-2, Dx Rel-3). El principal ya
-- vivía en cie10_codigo desde 20260811000300_permisos_cie10.sql; aquí se
-- agregan los tres relacionados, cada uno contra el mismo catálogo
-- public.cie10 y opcionales.
-- -----------------------------------------------------------------------------

alter table public.permisos_detalle_permiso
  add column if not exists cie10_codigo_rel1 text references public.cie10 (codigo),
  add column if not exists cie10_codigo_rel2 text references public.cie10 (codigo),
  add column if not exists cie10_codigo_rel3 text references public.cie10 (codigo);

comment on column public.permisos_detalle_permiso.cie10_codigo is
  'Diagnóstico CIE10 principal de la incapacidad.';
comment on column public.permisos_detalle_permiso.cie10_codigo_rel1 is
  'Primer diagnóstico relacionado (CIE10) de la incapacidad, opcional.';
comment on column public.permisos_detalle_permiso.cie10_codigo_rel2 is
  'Segundo diagnóstico relacionado (CIE10) de la incapacidad, opcional.';
comment on column public.permisos_detalle_permiso.cie10_codigo_rel3 is
  'Tercer diagnóstico relacionado (CIE10) de la incapacidad, opcional.';
