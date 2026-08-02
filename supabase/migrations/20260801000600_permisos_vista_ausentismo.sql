-- =============================================================================
-- PERMISOS TTHH — Vista de ausentismo
-- =============================================================================
-- El dashboard mide **solicitudes**: cuántas se pidieron, cuántas se aprobaron,
-- cuánto tarda el flujo. Talento Humano necesita medir otra cosa: **tiempo no
-- laborado**, por colaborador y por área. Son preguntas distintas y por eso no
-- comparten pantalla.
--
-- Tres decisiones que esta vista toma y conviene tener presentes al leer los
-- números:
--
--   1. Solo cuenta lo que efectivamente se ausenta: `genera_ausentismo` deja
--      fuera los trámites (retiro parcial de cesantías), las comisiones
--      sindicales y las capacitaciones institucionales, donde el colaborador
--      está cumpliendo una función, no faltando.
--   2. Un periodo suspendido cuenta hasta el día en que se interrumpió, no
--      hasta su fecha original. Sumar el periodo completo contaba dos veces los
--      mismos días: una en las vacaciones y otra en la incapacidad que las
--      partió.
--   3. Cuenta desde el visto bueno, no desde el archivo: lo que está autorizado
--      ya se ausentó, aunque falte cerrar el papeleo del soporte.
-- -----------------------------------------------------------------------------

create or replace view public.permisos_v_ausentismo
with (security_invoker = true)
as
select
  s.id                                    as solicitud_id,
  s.consecutivo,
  s.estado,
  s.extemporanea,

  s.solicitante_id,
  p.nombre                                as colaborador,
  p.documento,
  p.correo,

  s.area_id,
  a.nombre                                as area,
  s.cargo_id,
  cg.nombre                               as cargo,
  s.empresa_id,
  e.nombre                                as empresa,
  s.coordinador_id,
  co.nombre                               as coordinador,

  tr.codigo                               as tramite,
  cat.id                                  as categoria_id,
  cat.nombre                              as categoria,
  ti.id                                   as tipo_id,
  ti.nombre                               as motivo,
  coalesce(ti.naturaleza,
           case when tr.codigo = 'vacaciones' then 'vacaciones' else 'permiso' end)
                                          as naturaleza,
  coalesce(dp.remunerado, true)           as remunerado,

  s.fecha_solicitud,
  s.fecha_inicio,
  -- Fin efectivo: un periodo suspendido termina la víspera de la interrupción.
  case
    when s.estado = 'SUSPENDIDA' and s.fecha_interrupcion is not null
      then s.fecha_interrupcion - 1
    else s.fecha_fin
  end                                     as fecha_fin,
  extract(year  from s.fecha_inicio)::int as anio,
  extract(month from s.fecha_inicio)::int as mes,

  -- Días y horas. Las vacaciones no tienen detalle de permiso, así que se toman
  -- de su propio detalle y se convierten a horas con la jornada configurada.
  case
    when tr.codigo = 'vacaciones'
      then coalesce(dv.dias_a_disfrutar, dv.dias_habiles_calculados, 0)
    else coalesce(dp.dias_permiso, 0)
  end::numeric                            as dias,
  case
    when tr.codigo = 'vacaciones'
      then coalesce(dv.dias_a_disfrutar, dv.dias_habiles_calculados, 0)
           * coalesce((select (valor #>> '{}')::numeric
                         from public.permisos_config where clave = 'horas_jornada'), 8)
    else coalesce(dp.horas_permiso, 0)
  end::numeric                            as horas,

  s.interrumpida_por_id,
  s.dias_pendientes_reprogramar,
  s.created_at
from public.permisos_solicitudes s
join public.permisos_tramites   tr  on tr.id = s.tramite_id
join public.permisos_perfiles   p   on p.user_id = s.solicitante_id
left join public.areas          a   on a.id = s.area_id
left join public.cargos         cg  on cg.id = s.cargo_id
left join public.permisos_empresas e on e.id = s.empresa_id
left join public.coordinadores  co  on co.id = s.coordinador_id
left join public.permisos_detalle_permiso    dp on dp.solicitud_id = s.id
left join public.permisos_detalle_vacaciones dv on dv.solicitud_id = s.id
left join public.permisos_tipos       ti  on ti.id = dp.tipo_id
left join public.permisos_categorias  cat on cat.id = dp.categoria_id
where s.deleted_at is null
  and s.estado in ('APROBADA_TH', 'PENDIENTE_SOPORTE', 'SOPORTE_EN_VALIDACION',
                   'SUSPENDIDA', 'FINALIZADA', 'ARCHIVADA')
  -- Los trámites y el tiempo de representación no son ausentismo.
  and coalesce(ti.genera_ausentismo, true);

comment on view public.permisos_v_ausentismo is
  'Una fila por ausencia efectiva. Hereda RLS de permisos_solicitudes gracias a '
  'security_invoker: el coordinador ve su área y Talento Humano, todo.';

grant select on public.permisos_v_ausentismo to authenticated;
