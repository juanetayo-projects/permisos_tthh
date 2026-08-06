-- =============================================================================
-- PERMISOS TTHH — 033 · La incapacidad deja de ser un permiso
--
-- Una incapacidad no se pide: se reporta. Modelarla como un motivo del TH-F-002
-- obligaba al colaborador a solicitar por adelantado una ausencia que ya
-- ocurrió y que además no depende de que nadie se la autorice —la expide la EPS
-- o la ARL—. Y la pedía **el propio colaborador**, que en una incapacidad es
-- justo quien no está.
--
-- Cambia quién reporta y por dónde entra:
--
--   · La reporta **el jefe directo**, que es quien se entera de la ausencia el
--     mismo día. Por eso hace falta abrir el `insert`: hasta ahora nadie podía
--     crear una solicitud a nombre de otra persona.
--   · Entra directa a la bandeja de **Talento Humano**. No pasa por la
--     autorización del jefe: la acaba de radicar él, y pedirle que se autorice
--     a sí mismo es un paso vacío.
--   · El **soporte lo carga el colaborador**, no el jefe. La certificación es
--     suya y la policy de Storage ya ata la ruta del archivo a
--     `solicitante_id`; por eso la solicitud nace a nombre del colaborador y el
--     jefe queda registrado aparte, en `reportada_por`.
-- =============================================================================

-- ------------------------------------------------- La ruta que faltaba
-- `gerente_th_directo` manda a PENDIENTE_GERENCIA_TH, que es la bandeja de
-- cesantías. La incapacidad necesita la de Talento Humano, que es otra.
alter table public.permisos_tipos
  drop constraint if exists permisos_tipos_ruta_aprobacion_check;

alter table public.permisos_tipos
  add constraint permisos_tipos_ruta_aprobacion_check
  check (ruta_aprobacion in ('coordinador_th', 'gerente_th_directo', 'th_directo'));

-- ------------------------------------------------------- El trámite propio
insert into public.permisos_tramites
  (codigo, nombre, prefijo_consecutivo, codigo_formato, version_formato, proceso,
   nota_pie, antelacion_minima, unidad_antelacion, orden)
values
  ('incapacidad', 'Reporte de incapacidad', 'IN', 'TH-F-002', '02',
   'TALENTO HUMANO',
   'La incapacidad la reporta el jefe directo el mismo día en que conoce la ausencia. El colaborador dispone del plazo configurado para cargar la certificación expedida por la EPS o la ARL.',
   0, 'horas', 4)
on conflict (codigo) do nothing;

-- Los motivos de incapacidad dejan de ofrecerse en el formulario de permisos y
-- pasan a entrar directos a Talento Humano.
update public.permisos_tipos
   set ruta_aprobacion = 'th_directo'
 where naturaleza = 'incapacidad';

-- ------------------------------------ Quién reportó, cuando no es el titular
alter table public.permisos_solicitudes
  add column if not exists reportada_por uuid references auth.users (id);

comment on column public.permisos_solicitudes.reportada_por is
  'Quién radicó la solicitud cuando no es el propio solicitante. Hoy solo lo '
  'usan las incapacidades, que reporta el jefe directo.';

-- ------------------------------------------ Las incapacidades ya radicadas
-- Se mueven al trámite nuevo para que no sigan mezcladas con los permisos en
-- bandejas y reportes. El consecutivo antiguo se conserva: renumerar rompería
-- la trazabilidad de un documento que ya circuló firmado.
update public.permisos_solicitudes s
   set tramite_id = (select id from public.permisos_tramites where codigo = 'incapacidad')
  from public.permisos_detalle_permiso dp
  join public.permisos_tipos t on t.id = dp.tipo_id
 where dp.solicitud_id = s.id
   and t.naturaleza = 'incapacidad'
   and s.tramite_id = (select id from public.permisos_tramites where codigo = 'permiso');

-- -----------------------------------------------------------------------------
-- El jefe directo puede radicar a nombre de su gente
--
-- Se abre lo justo: **solo** para el trámite de incapacidad y **solo** sobre
-- alguien cuyo servicio coordine quien la radica. Una apertura general del
-- `insert` dejaría que cualquiera fabricase solicitudes a nombre de terceros,
-- que es exactamente lo que la policy original impedía.
--
-- `reportada_por` se obliga a ser quien está autenticado: sin eso, el jefe
-- podría radicar apuntando a otro y el historial mentiría sobre quién reportó.
-- -----------------------------------------------------------------------------
drop policy if exists permisos_solicitudes_insert on public.permisos_solicitudes;
create policy permisos_solicitudes_insert on public.permisos_solicitudes
  for insert to authenticated
  with check (
    public.permisos_perfil_activo()
    and (
      solicitante_id = auth.uid()
      or (
        reportada_por = auth.uid()
        and tramite_id = (select id from public.permisos_tramites where codigo = 'incapacidad')
        and (
          public.permisos_coordina_area(area_id)
          or public.permisos_es_th()
        )
      )
    )
  );

-- El detalle sigue a su cabecera: quien pudo crear la solicitud tiene que poder
-- escribir su detalle, o la cabecera se queda huérfana y se borra sola.
do $$
declare
  t text;
begin
  foreach t in array array['permisos_detalle_permiso', 'permisos_detalle_vacaciones']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (exists (select 1 from public.permisos_solicitudes s
                         where s.id = %I.solicitud_id
                           and (s.solicitante_id = auth.uid()
                                or s.reportada_por = auth.uid()
                                or public.permisos_coordina_area(s.area_id)
                                or public.permisos_es_th())))
         with check (exists (select 1 from public.permisos_solicitudes s
                              where s.id = %I.solicitud_id
                                and (s.solicitante_id = auth.uid()
                                     or s.reportada_por = auth.uid()
                                     or public.permisos_coordina_area(s.area_id)
                                     or public.permisos_es_th())))',
      t || '_write', t, t, t
    );
  end loop;
end;
$$;
