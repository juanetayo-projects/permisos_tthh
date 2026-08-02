-- =============================================================================
-- PERMISOS TTHH — Qué documento exige cada motivo, y en qué momento
-- =============================================================================
-- El modelo anterior solo sabía *si* hacía falta un soporte, con dos booleanos.
-- Nunca supo *cuál*: el colaborador leía «adjunta el soporte» y subía lo que
-- creía, Talento Humano lo devolvía, y el trámite daba una vuelta completa por
-- una diferencia que estaba clara desde el principio.
--
-- La exigencia documental de un permiso es un catálogo con nombre propio, y en
-- Colombia además tiene norma: la incapacidad la expide la EPS o la ARL, el
-- luto se prueba con el registro civil de defunción y el parentesco (Ley 1280
-- de 2009), y el certificado electoral tiene un mes de plazo (Ley 403 de 1997).
--
-- Se modela en tres piezas:
--   permisos_documentos          — el catálogo (qué documentos existen)
--   permisos_tipos_documentos    — la matriz (qué exige cada motivo y cuándo)
--   permisos_adjuntos.documento_id — qué documento es cada archivo entregado
-- -----------------------------------------------------------------------------

create table if not exists public.permisos_documentos (
  id           serial primary key,
  codigo       text not null unique,
  nombre       text not null,
  descripcion  text,
  norma        text,
  activo       boolean not null default true,
  orden        integer not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.permisos_documentos is
  'Catálogo de documentos soporte. El código es estable y legible para poder '
  'referenciarlo desde las migraciones sin depender de identificadores '
  'generados.';

comment on column public.permisos_documentos.norma is
  'Norma que exige el documento. Se le muestra al colaborador para que sepa por '
  'qué se le pide, y a Talento Humano para sustentarlo.';

-- -----------------------------------------------------------------------------
-- Matriz motivo × documento × momento
-- -----------------------------------------------------------------------------
-- `momento` reutiliza el vocabulario de permisos_adjuntos: 'previo' es al
-- solicitar y 'posterior' al regresar. Un mismo documento puede aparecer en los
-- dos momentos con exigencias distintas: de la cita médica se pide la orden al
-- solicitar y la constancia de asistencia al volver.
create table if not exists public.permisos_tipos_documentos (
  id            serial primary key,
  tipo_id       integer not null references public.permisos_tipos (id) on delete cascade,
  documento_id  integer not null references public.permisos_documentos (id),
  momento       text not null check (momento in ('previo', 'posterior')),
  obligatorio   boolean not null default true,
  -- Umbral propio: hay documentos que solo se exigen si la ausencia pasa de
  -- cierta duración. Duplicarlo aquí permite que dos documentos del mismo
  -- motivo tengan umbrales distintos.
  desde_dias    numeric(5, 2),
  nota          text,
  orden         integer not null default 0,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (tipo_id, documento_id, momento)
);

comment on table public.permisos_tipos_documentos is
  'Qué documentos exige cada motivo y en qué momento. Es la fuente única: el '
  'formulario, la validación de Talento Humano y el informe leen de aquí.';

create index if not exists permisos_tipos_documentos_tipo_idx
  on public.permisos_tipos_documentos (tipo_id) where activo;

-- -----------------------------------------------------------------------------
-- Cada archivo entregado sabe qué documento es
-- -----------------------------------------------------------------------------
-- Sin esto, una solicitud con tres documentos exigidos y un archivo adjunto no
-- se podía cerrar: nadie sabía cuál de los tres había llegado.
alter table public.permisos_adjuntos
  add column if not exists documento_id integer references public.permisos_documentos (id);

comment on column public.permisos_adjuntos.documento_id is
  'Documento de la matriz al que corresponde el archivo. Puede ser null en los '
  'adjuntos anteriores a esta versión y en los que se suben como «otro».';

-- -----------------------------------------------------------------------------
-- Catálogo de documentos
-- -----------------------------------------------------------------------------
insert into public.permisos_documentos (codigo, nombre, descripcion, norma, orden) values
  ('orden_cita_medica', 'Orden o cita médica programada',
   'Orden de servicio, autorización de la EPS o soporte de la cita agendada.',
   'Art. 57 num. 6 CST', 1),

  ('constancia_asistencia_medica', 'Constancia de asistencia a la cita',
   'Certificado de asistencia expedido por la IPS el día de la atención.',
   'Art. 57 num. 6 CST', 2),

  ('certificado_incapacidad', 'Certificado de incapacidad',
   'Incapacidad expedida por la EPS o la ARL, transcrita cuando la expide un '
   'particular.',
   'Arts. 227 y 228 CST · Decreto 780 de 2016', 3),

  ('historia_clinica', 'Epicrisis o resumen de historia clínica',
   'Solo cuando la incapacidad o la constancia no permiten sustentar la '
   'ausencia. Es información sensible: se guarda en el bucket privado.',
   'Ley 1581 de 2012, art. 5 · dato sensible', 4),

  ('certificado_nacido_vivo', 'Certificado de nacido vivo o registro civil de nacimiento',
   'Acredita el nacimiento para la licencia de maternidad o paternidad.',
   'Arts. 236 y 239 CST · Ley 1822 de 2017', 5),

  ('certificado_medico_prenatal', 'Certificado médico de estado de embarazo',
   'Indica la fecha probable de parto y habilita el inicio de la licencia.',
   'Art. 236 CST', 6),

  ('registro_defuncion', 'Registro civil de defunción',
   'Documento que acredita el fallecimiento. Si no está expedido, se acepta el '
   'certificado de defunción y se completa después.',
   'Ley 1280 de 2009', 7),

  ('prueba_parentesco', 'Documento que acredita el parentesco',
   'Registro civil de nacimiento o de matrimonio, o declaración de unión '
   'marital, según el grado que invoca la licencia de luto.',
   'Ley 1280 de 2009', 8),

  ('prueba_calamidad', 'Prueba de la calamidad',
   'Denuncia, informe de bomberos, constancia de la entidad o cualquier '
   'documento que acredite el hecho invocado.',
   'Art. 57 num. 6 CST · calamidad «debidamente comprobada»', 9),

  ('certificado_electoral', 'Certificado electoral',
   'Lo expide la Registraduría el día de la votación.',
   'Ley 403 de 1997, art. 3 · Ley 815 de 2003', 10),

  ('constancia_institucion_educativa', 'Constancia de la institución educativa',
   'Acredita la citación o la actividad escolar del menor a cargo.',
   'Ley 1857 de 2017, art. 3', 11),

  ('citacion_autoridad', 'Citación de la autoridad judicial o administrativa',
   'Oficio o boleta de citación que obliga a comparecer.',
   'Art. 57 num. 6 CST · Ley 1564 de 2012', 12),

  ('constancia_comparecencia', 'Constancia de comparecencia',
   'La expide el despacho o la entidad al terminar la diligencia.',
   'Art. 57 num. 6 CST', 13),

  ('carta_sindicato', 'Comunicación del sindicato',
   'Solicitud del permiso sindical suscrita por la organización.',
   'Art. 57 num. 6 CST · Convenio 135 OIT', 14),

  ('acto_designacion', 'Acto de designación o nombramiento',
   'Acredita el cargo transitorio de forzosa aceptación (jurado de votación, '
   'testigo, perito).',
   'Art. 57 num. 6 CST', 15),

  ('solicitud_retiro_cesantias', 'Solicitud de retiro parcial de cesantías',
   'Formato de la administradora de cesantías, diligenciado y firmado.',
   'Art. 102 CST · Ley 1071 de 2006', 16),

  ('soporte_destinacion_cesantias', 'Soporte de la destinación',
   'Promesa de compraventa, certificado de tradición, matrícula o recibo de '
   'matrícula: prueba que el retiro se destina a vivienda o educación.',
   'Art. 102 CST · Ley 1071 de 2006', 17),

  ('certificado_estudio', 'Certificado de la institución educativa',
   'Constancia de matrícula, horario o citación a la actividad académica.',
   'Art. 21 Ley 50 de 1990', 18),

  ('constancia_donacion', 'Constancia de donación de sangre',
   'La expide el banco de sangre el día de la donación.',
   'Ley 1805 de 2016, art. 9', 19),

  ('otro_soporte', 'Otro documento',
   'Cualquier soporte adicional que respalde la solicitud.',
   null, 99)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Matriz para los motivos que ya existen
-- -----------------------------------------------------------------------------
insert into public.permisos_tipos_documentos
  (tipo_id, documento_id, momento, obligatorio, desde_dias, nota, orden)
select t.id, d.id, v.momento, v.obligatorio, v.desde_dias, v.nota, v.orden
from (values
  -- motivo, documento, momento, obligatorio, desde_dias, nota, orden
  ('Cita médica', 'orden_cita_medica', 'previo', false, null,
   'Si ya tienes la orden, adjúntala: agiliza la autorización.', 1),
  ('Cita médica', 'constancia_asistencia_medica', 'posterior', true, 2,
   'Obligatoria cuando el ausentismo supera 2 días.', 2),
  ('Cita médica', 'historia_clinica', 'posterior', false, 2,
   'Alternativa a la constancia cuando la IPS no la expide.', 3),

  ('Incapacidad médica', 'certificado_incapacidad', 'previo', true, null,
   'Sin el certificado la ausencia no se puede registrar como incapacidad.', 1),
  ('Incapacidad médica', 'historia_clinica', 'posterior', false, null,
   'Solo si Talento Humano lo solicita para la transcripción ante la EPS.', 2),

  ('Licencia de maternidad o paternidad', 'certificado_medico_prenatal', 'previo', false, null,
   'Para la licencia de maternidad que se inicia antes del parto.', 1),
  ('Licencia de maternidad o paternidad', 'certificado_nacido_vivo', 'posterior', true, null,
   'Registro civil de nacimiento dentro de los 30 días siguientes.', 2),

  ('Votaciones', 'certificado_electoral', 'posterior', true, null,
   'Tienes un mes desde la votación para entregarlo (Ley 403 de 1997).', 1),

  ('Deberes de acudiente', 'constancia_institucion_educativa', 'posterior', true, null,
   null, 1),

  ('Calamidad doméstica', 'prueba_calamidad', 'posterior', true, null,
   'La norma exige que la calamidad esté «debidamente comprobada».', 1),

  ('Luto', 'registro_defuncion', 'posterior', true, null,
   'Si aún no está expedido, entrega el certificado de defunción y completa '
   'después el registro civil.', 1),
  ('Luto', 'prueba_parentesco', 'posterior', true, null,
   'Acredita el grado de parentesco que invoca la licencia.', 2),

  ('Solicitud de cesantías', 'solicitud_retiro_cesantias', 'previo', true, null,
   null, 1),
  ('Solicitud de cesantías', 'soporte_destinacion_cesantias', 'previo', true, null,
   'Vivienda o educación: el retiro parcial solo procede para esos destinos.', 2)
) as v(tipo, documento, momento, obligatorio, desde_dias, nota, orden)
join public.permisos_tipos t on t.nombre = v.tipo
join public.permisos_documentos d on d.codigo = v.documento
on conflict (tipo_id, documento_id, momento) do nothing;

-- -----------------------------------------------------------------------------
-- Los booleanos del motivo se derivan de la matriz
-- -----------------------------------------------------------------------------
-- `requiere_soporte_previo` y `requiere_soporte_posterior` siguen existiendo
-- porque el formulario y las reglas los consultan, pero dejan de mantenerse a
-- mano: pasan a ser el resumen de la matriz. Así no puede haber un motivo que
-- diga «no pide soporte» y tenga tres documentos obligatorios configurados.
create or replace function public.permisos_sincronizar_flags_soporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo integer := coalesce(new.tipo_id, old.tipo_id);
begin
  update public.permisos_tipos t
     set requiere_soporte_previo = exists (
           select 1 from public.permisos_tipos_documentos td
            where td.tipo_id = t.id and td.momento = 'previo'
              and td.obligatorio and td.activo
         ),
         requiere_soporte_posterior = exists (
           select 1 from public.permisos_tipos_documentos td
            where td.tipo_id = t.id and td.momento = 'posterior' and td.activo
         )
   where t.id = v_tipo;

  return null;
end;
$$;

drop trigger if exists permisos_tipos_documentos_sincroniza on public.permisos_tipos_documentos;
create trigger permisos_tipos_documentos_sincroniza
  after insert or update or delete on public.permisos_tipos_documentos
  for each row execute function public.permisos_sincronizar_flags_soporte();

-- Es un trigger, no una API. Postgres concede EXECUTE a `public` por defecto y
-- PostgREST la publicaba en /rest/v1/rpc, de modo que cualquiera sin sesión
-- podía invocar una función SECURITY DEFINER. El trigger sigue disparando: se
-- ejecuta en el contexto de la tabla, no por este permiso.
revoke all on function public.permisos_sincronizar_flags_soporte()
  from public, anon, authenticated;

-- Primera sincronización para las filas recién insertadas.
update public.permisos_tipos t set
  requiere_soporte_previo = exists (
    select 1 from public.permisos_tipos_documentos td
     where td.tipo_id = t.id and td.momento = 'previo' and td.obligatorio and td.activo
  ),
  requiere_soporte_posterior = exists (
    select 1 from public.permisos_tipos_documentos td
     where td.tipo_id = t.id and td.momento = 'posterior' and td.activo
  );

-- -----------------------------------------------------------------------------
-- RLS: catálogo de lectura general, escritura del administrador
-- -----------------------------------------------------------------------------
alter table public.permisos_documentos        enable row level security;
alter table public.permisos_tipos_documentos  enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['permisos_documentos', 'permisos_tipos_documentos']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.permisos_es_admin()) with check (public.permisos_es_admin())',
      t || '_admin', t
    );
  end loop;
end;
$$;
