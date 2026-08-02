import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'
import { columnasDelTexto } from './api'
import type { Estado } from '@/domain/estados'
import { ESTADOS_VIGENTES, type PeriodoOcupado } from '@/domain/concurrencia'

/**
 * Selección compartida por bandejas y listados.
 *
 * Los alias evitan que PostgREST tenga que adivinar la relación y hacen el
 * consumo en React mucho más legible que `permisos_detalle_permiso[0]`.
 */
const SELECT_SOLICITUD = `
  id, consecutivo, estado, extemporanea, fecha_solicitud, fecha_inicio, fecha_fin,
  motivo_rechazo, observacion_decision, coord_fecha, th_fecha, created_at, observaciones,
  interrumpida_por_id, fecha_interrupcion, dias_pendientes_reprogramar,
  reprograma_a_id, nota_interrupcion,
  tramite:permisos_tramites(id, codigo, nombre, codigo_formato, version_formato),
  solicitante:permisos_perfiles(user_id, nombre, correo, documento),
  area:areas(id, nombre),
  empresa:permisos_empresas(id, nombre),
  coordinador:coordinadores(id, nombre, cargo, correo, area:areas(id, nombre)),
  detalle_permiso:permisos_detalle_permiso(
    horas_permiso, dias_permiso, remunerado, justificacion, plan_compensacion,
    requiere_compensacion, hora_salida, hora_regreso, requiere_soporte_posterior,
    fecha_limite_soporte, soporte_posterior_entregado,
    categoria:permisos_categorias(id, nombre),
    tipo:permisos_tipos(
      id, nombre, ruta_aprobacion, naturaleza, genera_ausentismo, fundamento_legal,
      dias_calendario, interrumpe_otros, prioridad, soporte_obligatorio_desde_dias
    )
  ),
  detalle_vacaciones:permisos_detalle_vacaciones(
    dias_corresponden, dias_a_disfrutar, dias_pendientes, fecha_reintegro,
    dias_habiles_calculados, declaracion_aceptada, saldo_validado_en, saldo_observacion_th
  )
`

export interface SolicitudLista {
  id: string
  consecutivo: string | null
  estado: Estado
  extemporanea: boolean
  fecha_solicitud: string
  fecha_inicio: string
  fecha_fin: string
  motivo_rechazo: string | null
  observacion_decision: string | null
  coord_fecha: string | null
  th_fecha: string | null
  created_at: string
  observaciones: string | null
  /** Solicitud que interrumpió a esta; `null` mientras el periodo esté entero. */
  interrumpida_por_id: string | null
  fecha_interrupcion: string | null
  dias_pendientes_reprogramar: number | null
  reprograma_a_id: string | null
  nota_interrupcion: string | null
  tramite: { id: number; codigo: 'permiso' | 'vacaciones'; nombre: string; codigo_formato: string; version_formato: string } | null
  solicitante: { user_id: string; nombre: string; correo: string; documento: string | null } | null
  area: { id: number; nombre: string } | null
  empresa: { id: number; nombre: string } | null
  /** Jefe directo elegido al solicitar: es quien tiene que autorizar. */
  coordinador: {
    id: number
    nombre: string | null
    cargo: string | null
    correo: string
    area: { id: number; nombre: string } | null
  } | null
  detalle_permiso: {
    horas_permiso: number | null
    dias_permiso: number | null
    remunerado: boolean
    justificacion: string | null
    plan_compensacion: string | null
    requiere_compensacion: boolean
    hora_salida: string | null
    hora_regreso: string | null
    requiere_soporte_posterior: boolean
    fecha_limite_soporte: string | null
    soporte_posterior_entregado: boolean
    categoria: { id: number; nombre: string } | null
    tipo: {
      id: number
      nombre: string
      ruta_aprobacion: string
      naturaleza: 'permiso' | 'licencia' | 'incapacidad' | 'vacaciones' | 'tramite'
      genera_ausentismo: boolean
      fundamento_legal: string | null
      dias_calendario: boolean
      interrumpe_otros: boolean
      prioridad: number
      soporte_obligatorio_desde_dias: number | null
    } | null
  } | null
  detalle_vacaciones: {
    dias_corresponden: number | null
    dias_a_disfrutar: number | null
    dias_pendientes: number | null
    fecha_reintegro: string | null
    dias_habiles_calculados: number | null
    declaracion_aceptada: boolean
    saldo_validado_en: string | null
    saldo_observacion_th: string | null
  } | null
}

export interface FiltroSolicitudes {
  estados?: Estado[]
  soloPropias?: boolean
  areaIds?: number[]
  tramiteCodigo?: 'permiso' | 'vacaciones'
  desde?: string
  hasta?: string
}

/**
 * Lista de solicitudes.
 *
 * No se filtra por rol desde el cliente: de eso se encarga RLS. Aquí solo se
 * acota lo que cada pantalla necesita mostrar.
 */
export function useSolicitudes(filtro: FiltroSolicitudes, usuarioId?: string) {
  return useQuery({
    queryKey: ['solicitudes', filtro, usuarioId],
    queryFn: async (): Promise<SolicitudLista[]> => {
      let q = supabase
        .from('permisos_solicitudes')
        .select(SELECT_SOLICITUD)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (filtro.estados?.length) q = q.in('estado', filtro.estados)
      if (filtro.soloPropias && usuarioId) q = q.eq('solicitante_id', usuarioId)
      if (filtro.areaIds?.length) q = q.in('area_id', filtro.areaIds)
      if (filtro.desde) q = q.gte('fecha_inicio', filtro.desde)
      if (filtro.hasta) q = q.lte('fecha_inicio', filtro.hasta)

      const { data, error } = await q
      if (error) throw error

      const lista = (data ?? []) as unknown as SolicitudLista[]
      return filtro.tramiteCodigo
        ? lista.filter((s) => s.tramite?.codigo === filtro.tramiteCodigo)
        : lista
    },
  })
}

export function useSolicitud(id: string | undefined) {
  return useQuery({
    queryKey: ['solicitud', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<SolicitudLista> => {
      const { data, error } = await supabase
        .from('permisos_solicitudes')
        .select(SELECT_SOLICITUD)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as unknown as SolicitudLista
    },
  })
}

/**
 * Periodos del colaborador que ya ocupan fechas.
 *
 * Se consulta al vuelo mientras se llena el formulario, así que trae lo mínimo
 * para decidir un cruce y no la solicitud entera. Se excluyen los borradores:
 * un borrador no ocupa nada porque puede no llegar a enviarse nunca.
 */
export function usePeriodosOcupados(usuarioId: string | undefined, excluirId?: string) {
  return useQuery({
    queryKey: ['periodos-ocupados', usuarioId, excluirId],
    enabled: Boolean(usuarioId),
    staleTime: 30_000,
    queryFn: async (): Promise<PeriodoOcupado[]> => {
      let q = supabase
        .from('permisos_solicitudes')
        .select(
          `id, consecutivo, estado, fecha_inicio, fecha_fin,
           tramite:permisos_tramites(codigo),
           detalle_permiso:permisos_detalle_permiso(
             tipo:permisos_tipos(nombre, prioridad, interrumpe_otros, dias_calendario)
           )`
        )
        .eq('solicitante_id', usuarioId!)
        .is('deleted_at', null)
        .in('estado', [...ESTADOS_VIGENTES])

      if (excluirId) q = q.neq('id', excluirId)

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map((s) => {
        const fila = s as unknown as {
          id: string
          consecutivo: string | null
          estado: string
          fecha_inicio: string
          fecha_fin: string
          tramite: { codigo: string } | null
          detalle_permiso: {
            tipo: {
              nombre: string
              prioridad: number
              interrumpe_otros: boolean
              dias_calendario: boolean
            } | null
          } | null
        }

        const esVacaciones = fila.tramite?.codigo === 'vacaciones'
        const tipo = fila.detalle_permiso?.tipo ?? null

        return {
          id: fila.id,
          consecutivo: fila.consecutivo,
          estado: fila.estado,
          fechaInicio: fila.fecha_inicio,
          fechaFin: fila.fecha_fin,
          motivo: esVacaciones ? 'Vacaciones' : (tipo?.nombre ?? 'Sin motivo'),
          // Las vacaciones no están en el catálogo de motivos, así que su
          // prioridad se fija aquí: por encima de un permiso corriente y por
          // debajo de una incapacidad, que es justo lo que dice el art. 187.
          prioridad: esVacaciones ? 10 : (tipo?.prioridad ?? 0),
          interrumpeOtros: esVacaciones ? false : (tipo?.interrumpe_otros ?? false),
          esVacaciones,
          diasCalendario: esVacaciones ? false : (tipo?.dias_calendario ?? false),
        }
      })
    },
  })
}

/** Periodos suspendidos con días por reprogramar, para avisar en el formulario. */
export function usePeriodosSuspendidos(usuarioId: string | undefined) {
  return useQuery({
    queryKey: ['periodos-suspendidos', usuarioId],
    enabled: Boolean(usuarioId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permisos_solicitudes')
        .select(
          'id, consecutivo, fecha_inicio, fecha_fin, fecha_interrupcion, dias_pendientes_reprogramar, tramite:permisos_tramites(codigo)'
        )
        .eq('solicitante_id', usuarioId!)
        .eq('estado', 'SUSPENDIDA')
        .is('reprograma_a_id', null)
        .is('deleted_at', null)

      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * Interrumpe un periodo y lo enlaza con la solicitud que lo partió.
 *
 * Va por RPC y no por tres updates sueltos: hacerlo desde el cliente dejaba
 * estados a medias en cuanto uno fallaba —el periodo suspendido sin vínculo, o
 * el vínculo sin los días pendientes—.
 */
export function useInterrumpir() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      solicitudId: string
      interruptoraId: string | null
      fecha: string
      diasPendientes: number
      nota?: string | null
    }) => {
      const { error } = await supabase.rpc('permisos_interrumpir', {
        p_solicitud: params.solicitudId,
        p_interruptora: params.interruptoraId,
        p_fecha: params.fecha,
        p_dias_pendientes: params.diasPendientes,
        p_nota: params.nota ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['solicitudes'] })
      void qc.invalidateQueries({ queryKey: ['solicitud'] })
      void qc.invalidateQueries({ queryKey: ['historial'] })
      void qc.invalidateQueries({ queryKey: ['periodos-ocupados'] })
      void qc.invalidateQueries({ queryKey: ['periodos-suspendidos'] })
    },
  })
}

export interface EventoHistorial {
  id: number
  estado_anterior: string | null
  estado_nuevo: string
  accion: string
  actor_nombre: string | null
  motivo: string | null
  created_at: string
}

export function useHistorial(solicitudId: string | undefined) {
  return useQuery({
    queryKey: ['historial', solicitudId],
    enabled: Boolean(solicitudId),
    queryFn: async (): Promise<EventoHistorial[]> => {
      const { data, error } = await supabase
        .from('permisos_historial')
        .select('id, estado_anterior, estado_nuevo, accion, actor_nombre, motivo, created_at')
        .eq('solicitud_id', solicitudId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Aplica una decisión y refresca las bandejas afectadas. */
export function useDecidir() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      ids: string[]
      estado: Estado
      motivo?: string | null
      campos?: Record<string, unknown>
    }) => {
      const { error } = await supabase
        .from('permisos_solicitudes')
        .update({
          estado: params.estado,
          ...columnasDelTexto(params.estado, params.motivo),
          ...params.campos,
        })
        .in('id', params.ids)

      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['solicitudes'] })
      void qc.invalidateQueries({ queryKey: ['solicitud'] })
      void qc.invalidateQueries({ queryKey: ['historial'] })
    },
  })
}
