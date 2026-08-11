-- =============================================================================
-- PERMISOS TTHH — pg_trgm fuera del esquema public
-- =============================================================================
-- El linter de seguridad de Supabase marca cualquier extensión instalada en
-- `public` (mezcla el catálogo de la extensión con las tablas de la app). Se
-- traslada al esquema `extensions`, que ya está en el `search_path` por
-- defecto del proyecto, así que el índice `cie10_nombre_trgm_idx` sigue
-- funcionando sin cambios.
-- -----------------------------------------------------------------------------

create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
