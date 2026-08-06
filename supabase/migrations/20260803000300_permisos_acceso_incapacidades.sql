-- =============================================================================
-- PERMISOS TTHH — 034 · El módulo de Incapacidades entra en el reparto
--
-- El catálogo de módulos vive en el código, pero quién entra a cada uno vive en
-- `permisos_acceso_rol`. Un módulo nuevo no aparece en el menú de nadie hasta
-- que se le siembra su fila, así que va aquí.
--
-- Lo llevan quienes reportan: el jefe directo, que es el que se entera de la
-- ausencia el mismo día, y Talento Humano. **No** el colaborador: su propia
-- incapacidad la reporta su jefe, y dejarle el módulo le sugeriría lo
-- contrario. El administrador lo lleva por soporte.
--
-- `on conflict do nothing` para no pisar un reparto ya ajustado a mano.
-- =============================================================================

insert into public.permisos_acceso_rol (rol, modulo) values
  ('coordinador',   'incapacidades'),
  ('analista_th',   'incapacidades'),
  ('administrador', 'incapacidades')
on conflict (rol, modulo) do nothing;
