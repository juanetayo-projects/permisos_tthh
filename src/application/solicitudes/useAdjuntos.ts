import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'
import { subirSoporte, urlFirmadaSoporte } from './api'

export interface Adjunto {
  id: string
  momento: 'previo' | 'posterior'
  nombre_archivo: string
  ruta_storage: string
  mime: string | null
  tamano_bytes: number | null
  created_at: string
  documento_id: number | null
  /** Documento de la matriz al que corresponde; null en los adjuntos antiguos. */
  documento: { id: number; codigo: string; nombre: string } | null
}

export function useAdjuntos(solicitudId: string | undefined) {
  return useQuery({
    queryKey: ['adjuntos', solicitudId],
    enabled: Boolean(solicitudId),
    queryFn: async (): Promise<Adjunto[]> => {
      const { data, error } = await supabase
        .from('permisos_adjuntos')
        .select(
          'id, momento, nombre_archivo, ruta_storage, mime, tamano_bytes, created_at, ' +
            'documento_id, documento:permisos_documentos(id, codigo, nombre)'
        )
        .eq('solicitud_id', solicitudId!)
        .is('deleted_at', null)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as Adjunto[]
    },
  })
}

/** Ventana de la firma para lo que se queda en pantalla, en segundos. */
const VIGENCIA_PREVIEW = 600

/**
 * URLs firmadas de los adjuntos, para pintarlos incrustados.
 *
 * Se refrescan antes de caducar: una vista previa que lleva diez minutos
 * abierta seguiría mostrando la imagen ya cargada, pero al abrir el modal el
 * navegador vuelve a pedir el archivo y recibiría un 400.
 */
export function useUrlsAdjuntos(adjuntos: Adjunto[] | undefined) {
  const rutas = (adjuntos ?? []).map((a) => a.ruta_storage)

  return useQuery({
    queryKey: ['urls-adjuntos', rutas],
    enabled: rutas.length > 0,
    staleTime: (VIGENCIA_PREVIEW - 60) * 1000,
    refetchInterval: (VIGENCIA_PREVIEW - 60) * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const firmadas = await Promise.all(
        rutas.map(async (r) => [r, await urlFirmadaSoporte(r, VIGENCIA_PREVIEW)] as const)
      )
      return Object.fromEntries(firmadas)
    },
  })
}

/**
 * Abre un soporte en una pestaña nueva.
 *
 * El bucket es privado porque son datos de salud (Ley 1581), así que se pide
 * una URL firmada de 60 s en el momento de abrirlo. La pestaña se abre *antes*
 * de esperar la firma para que Safari y Firefox no la traten como emergente
 * bloqueada: el clic y la apertura tienen que ocurrir en el mismo gesto.
 */
export async function abrirSoporte(ruta: string): Promise<void> {
  const pestana = window.open('', '_blank', 'noopener,noreferrer')

  try {
    const url = await urlFirmadaSoporte(ruta)
    if (pestana) pestana.location.href = url
    else window.location.href = url
  } catch (e) {
    pestana?.close()
    throw e
  }
}

/**
 * Entrega de un documento de la lista de soportes posteriores.
 *
 * Sube el archivo y, **solo cuando ya no falta ningún obligatorio**, pasa la
 * solicitud a `SOPORTE_EN_VALIDACION`. Antes cualquier archivo cerraba el paso,
 * así que un motivo que exige registro de defunción y prueba de parentesco se
 * daba por entregado con el primero de los dos y Talento Humano tenía que
 * devolverlo para pedir el que faltaba.
 *
 * Con la pelota en el lado de TH el colaborador ya no puede escribir —la policy
 * solo se lo permite en `PENDIENTE_SOPORTE`—, y por eso el cambio de estado va
 * al final y no antes de la subida.
 */
export function useEntregarSoporte() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      solicitudId: string
      archivo: File
      usuarioId: string
      maxMB?: number
      documentoId?: number | null
      /** `true` cuando este archivo completa los documentos obligatorios. */
      completa: boolean
    }) => {
      await subirSoporte({
        solicitudId: params.solicitudId,
        archivo: params.archivo,
        momento: 'posterior',
        usuarioId: params.usuarioId,
        maxMB: params.maxMB,
        documentoId: params.documentoId,
      })

      if (!params.completa) return

      const { error: errorDetalle } = await supabase
        .from('permisos_detalle_permiso')
        .update({ soporte_posterior_entregado: true })
        .eq('solicitud_id', params.solicitudId)

      if (errorDetalle) throw errorDetalle

      const { error } = await supabase
        .from('permisos_solicitudes')
        .update({ estado: 'SOPORTE_EN_VALIDACION', observacion_decision: null })
        .eq('id', params.solicitudId)

      if (error) throw error
    },
    onSuccess: (_d, params) => {
      void qc.invalidateQueries({ queryKey: ['adjuntos', params.solicitudId] })
      void qc.invalidateQueries({ queryKey: ['solicitud'] })
      void qc.invalidateQueries({ queryKey: ['solicitudes'] })
    },
  })
}
