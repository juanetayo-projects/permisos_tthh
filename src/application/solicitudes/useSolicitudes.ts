import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'
import type { Estado } from '@/domain/estados'

/**
 * Selección compartida por bandejas y listados.
 *
 * Los alias evitan que PostgREST tenga que adivinar la relación y hacen el
 * consumo en React mucho más legible que `permisos_detalle_permiso[0]`.
 */
const SELECT_SOLICITUD = `
  id, consecutivo, estado, extemporanea, fecha_solicitud, fecha_inicio, fecha_fin,
  motivo_rechazo, coord_fecha, th_fecha, created_at, observaciones,
  tramite:permisos_tramites(id, codigo, nombre, codigo_formato, version_formato),
  solicitante:permisos_perfiles(user_id, nombre, correo, documento),
  area:areas(id, nombre),
  empresa:permisos_empresas(id, nombre),
  detalle_permiso:permisos_detalle_permiso(
    horas_permiso, dias_permiso, remunerado, justificacion, plan_compensacion,
    requiere_compensacion, hora_salida, hora_regreso, requiere_soporte_posterior,
    fecha_limite_soporte, soporte_posterior_entregado,
    categoria:permisos_categorias(id, nombre),
    tipo:permisos_tipos(id, nombre, ruta_aprobacion)
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
  coord_fecha: string | null
  th_fecha: string | null
  created_at: string
  observaciones: string | null
  tramite: { id: number; codigo: 'permiso' | 'vacaciones'; nombre: string; codigo_formato: string; version_formato: string } | null
  solicitante: { user_id: string; nombre: string; correo: string; documento: string | null } | null
  area: { id: number; nombre: string } | null
  empresa: { id: number; nombre: string } | null
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
    tipo: { id: number; nombre: string; ruta_aprobacion: string } | null
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
          motivo_rechazo: params.motivo ?? null,
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
