-- =============================================================================
-- PERMISOS TTHH — La incapacidad pasa a ser autorreporte
-- =============================================================================
-- Talento Humano decidió que el jefe directo deje de radicar la incapacidad de
-- su gente: solo puede registrar la suya propia, igual que cualquier otro
-- trámite de la aplicación. Quien la sufre la registra, y sigue entrando
-- directa a la bandeja de Talento Humano sin pasar por la autorización del
-- jefe -la incapacidad ya ocurrió y nadie tiene que autorizarla-.
--
-- Tres cambios:
--   · El módulo «Incapacidades» se abre a todos los roles: antes solo lo
--     llevaban el jefe directo, Talento Humano y el administrador.
--   · El `insert` de `permisos_solicitudes` deja de admitir que alguien
--     radique a nombre de otro (`reportada_por`): esa puerta era exclusiva de
--     la incapacidad reportada por el jefe, y con el autorreporte sobra.
--   · «Incapacidad por enfermedad laboral» se desactiva: el punto 8 del ajuste
--     pedido por Talento Humano retira esa casilla del formulario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- El módulo entra en el reparto de todos los roles
-- -----------------------------------------------------------------------------
insert into public.permisos_acceso_rol (rol, modulo) values
  ('colaborador',     'incapacidades'),
  ('coordinador_sst', 'incapacidades'),
  ('gerente_th',       'incapacidades')
on conflict (rol, modulo) do nothing;

-- -----------------------------------------------------------------------------
-- Nadie radica ya a nombre de otro
--
-- La única puerta que abría `reportada_por` era la del jefe directo radicando
-- la incapacidad de su gente. Con el autorreporte, `solicitante_id = auth.uid()`
-- ya cubre el único caso legítimo, para los cuatro trámites.
-- -----------------------------------------------------------------------------
drop policy if exists permisos_solicitudes_insert on public.permisos_solicitudes;
create policy permisos_solicitudes_insert on public.permisos_solicitudes
  for insert to authenticated
  with check (
    public.permisos_perfil_activo()
    and solicitante_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- Se retira «Incapacidad por enfermedad laboral»
--
-- No se borra: las solicitudes ya radicadas apuntan a ella y deben seguir
-- leyéndose. Se desactiva, que es como esta aplicación jubila un catálogo.
-- -----------------------------------------------------------------------------
update public.permisos_tipos
   set activo = false,
       descripcion = 'Retirada del formulario: Talento Humano dejó de '
                     'ofrecerla como origen distinto de «Incapacidad por '
                     'accidente de trabajo».'
 where nombre = 'Incapacidad por enfermedad laboral';

-- -----------------------------------------------------------------------------
-- El pie del formato ya no describe al jefe directo reportando
-- -----------------------------------------------------------------------------
update public.permisos_tramites
   set nota_pie = 'Cada colaborador registra su propia incapacidad el mismo '
                  'día en que la EPS o la ARL se la expide. Entra directa a la '
                  'bandeja de Talento Humano, sin pasar por la autorización '
                  'del jefe directo.'
 where codigo = 'incapacidad';
