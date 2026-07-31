import { supabase } from '@/infrastructure/supabase/client'
import { esDecisionNegativa, estadoAlEnviar, type Estado } from '@/domain/estados'
import type { FechaISO } from '@/domain/festivos'

/**
 * Coloca el texto de una decisión en la columna que le corresponde.
 *
 * `motivo_rechazo` se le muestra al solicitante en rojo y viaja en el correo
 * de rechazo; `observacion_decision` solo queda en el historial. Antes las dos
 * iban al mismo sitio y una solicitud autorizada con observación aparecía como
 * rechazada.
 *
 * Se escriben siempre las dos —una con el texto y la otra a `null`— para que
 * una solicitud que cambia de rumbo no arrastre el texto del paso anterior en
 * la columna equivocada.
 */
export function columnasDelTexto(estado: Estado, texto?: string | null) {
  const valor = texto?.trim() || null

  return esDecisionNegativa(estado)
    ? { motivo_rechazo: valor, observacion_decision: null }
    : { motivo_rechazo: null, observacion_decision: valor }
}

export type TipoNotificacion =
  | 'enviada'
  | 'aprobada_coordinador'
  | 'rechazada_coordinador'
  | 'pendiente_soporte'
  | 'finalizada'
  | 'rechazada_th'
  | 'perfil_validado'

/**
 * Traduce el estado de destino de una decisión al correo que corresponde.
 * `CANCELADA` y `ARCHIVADA` no tienen correo propio: cancelar es una acción
 * del propio solicitante y archivar es un paso administrativo sin novedad
 * para él.
 */
export function tipoNotificacionPara(destino: Estado): TipoNotificacion | null {
  switch (destino) {
    case 'PENDIENTE_TH':
      return 'aprobada_coordinador'
    case 'PENDIENTE_SOPORTE':
      return 'pendiente_soporte'
    case 'FINALIZADA':
      return 'finalizada'
    case 'RECHAZADA_COORDINADOR':
      return 'rechazada_coordinador'
    case 'RECHAZADA_TH':
      return 'rechazada_th'
    default:
      return null
  }
}

/**
 * Dispara el correo correspondiente vía la Edge Function `permisos-notificar`.
 *
 * Deliberadamente silenciosa: un correo que falla no debe impedir que el
 * coordinador o Talento Humano completen su decisión. El intento (o el
 * error) queda igualmente en `permisos_notificaciones` cuando sí se envía.
 */
export async function notificar(tipo: TipoNotificacion, solicitudId: string): Promise<void> {
  try {
    await supabase.functions.invoke('permisos-notificar', {
      body: { tipo, solicitud_id: solicitudId },
    })
  } catch (err) {
    console.error('No fue posible notificar por correo:', err)
  }
}

/**
 * Guarda el número de identificación en el perfil de quien solicita.
 *
 * El documento es obligatorio en el formato impreso, pero muchos perfiles
 * vienen sin él —los importados de Cambio de Turnos, por ejemplo—. En vez de
 * exigir un paso previo, se captura en la propia solicitud y se persiste, de
 * modo que solo haga falta escribirlo una vez.
 *
 * La policy `permisos_perfiles_update_propio` permite este cambio porque no
 * toca ni el rol ni el estado.
 */
export async function guardarDocumentoPropio(userId: string, documento: string): Promise<void> {
  const { error } = await supabase
    .from('permisos_perfiles')
    .update({ documento: documento.trim() })
    .eq('user_id', userId)

  if (error) throw error
}

export interface BaseSolicitud {
  tramite_id: number
  solicitante_id: string
  empresa_id: number | null
  area_id: number | null
  cargo_id: number | null
  coordinador_id: number | null
  fecha_inicio: FechaISO
  fecha_fin: FechaISO
  observaciones?: string | null
  extemporanea: boolean
}

export interface DetallePermiso {
  categoria_id: number | null
  tipo_id: number | null
  tipo_otro?: string | null
  hora_salida?: string | null
  hora_regreso?: string | null
  horas_permiso: number
  dias_permiso: number
  remunerado: boolean
  requiere_compensacion: boolean
  plan_compensacion?: string | null
  justificacion?: string | null
  requiere_soporte_posterior: boolean
  fecha_limite_soporte?: FechaISO | null
}

export interface DetalleVacaciones {
  dias_corresponden: number | null
  dias_a_disfrutar: number | null
  dias_pendientes: number | null
  fecha_reintegro: FechaISO | null
  dias_habiles_calculados: number
  declaracion_aceptada: boolean
  fecha_constancia: FechaISO
}

/**
 * Crea una solicitud y su detalle.
 *
 * El consecutivo y el código de verificación los asigna un trigger cuando el
 * estado deja de ser BORRADOR, así que un borrador no consume numeración.
 */
export async function crearSolicitud(params: {
  base: BaseSolicitud
  enviar: boolean
  rutaAprobacion?: 'coordinador_th' | 'gerente_th_directo'
  detallePermiso?: DetallePermiso
  detalleVacaciones?: DetalleVacaciones
}): Promise<{ id: string; consecutivo: string | null; estado: Estado }> {
  const estado: Estado = params.enviar
    ? estadoAlEnviar(params.rutaAprobacion ?? 'coordinador_th')
    : 'BORRADOR'

  const { data, error } = await supabase
    .from('permisos_solicitudes')
    .insert({ ...params.base, estado })
    .select('id, consecutivo, estado')
    .single()

  if (error) throw error

  const solicitudId = data.id as string

  try {
    if (params.detallePermiso) {
      const { error: e } = await supabase
        .from('permisos_detalle_permiso')
        .insert({ solicitud_id: solicitudId, ...params.detallePermiso })
      if (e) throw e
    }

    if (params.detalleVacaciones) {
      const { error: e } = await supabase
        .from('permisos_detalle_vacaciones')
        .insert({ solicitud_id: solicitudId, ...params.detalleVacaciones })
      if (e) throw e
    }
  } catch (err) {
    // Sin transacciones desde el cliente: si el detalle falla, la cabecera
    // quedaría huérfana. Se marca como borrada para que no aparezca en ninguna
    // bandeja ni cuente en las métricas.
    await supabase
      .from('permisos_solicitudes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', solicitudId)
    throw err
  }

  if (params.enviar) await notificar('enviada', solicitudId)

  return {
    id: solicitudId,
    consecutivo: data.consecutivo as string | null,
    estado: data.estado as Estado,
  }
}

/** Cambia el estado de una solicitud dejando constancia del motivo. */
export async function cambiarEstado(params: {
  id: string
  estado: Estado
  motivo?: string | null
  campos?: Record<string, unknown>
}): Promise<void> {
  const { error } = await supabase
    .from('permisos_solicitudes')
    .update({
      estado: params.estado,
      ...columnasDelTexto(params.estado, params.motivo),
      ...params.campos,
    })
    .eq('id', params.id)

  if (error) throw error
}

const MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export class ErrorArchivo extends Error {}

/**
 * Sube un soporte al bucket privado.
 *
 * La ruta es `{solicitud_id}/{momento}/{archivo}` porque las policies de
 * Storage resuelven el permiso a partir del primer segmento.
 */
export async function subirSoporte(params: {
  solicitudId: string
  archivo: File
  momento: 'previo' | 'posterior'
  usuarioId: string
  maxMB?: number
}): Promise<void> {
  const maxBytes = (params.maxMB ?? 10) * 1024 * 1024

  if (params.archivo.size > maxBytes) {
    throw new ErrorArchivo(`El archivo supera el máximo de ${params.maxMB ?? 10} MB.`)
  }
  if (!MIME_PERMITIDOS.includes(params.archivo.type)) {
    throw new ErrorArchivo('Solo se aceptan archivos PDF, JPG, PNG o WEBP.')
  }

  const nombreSeguro = params.archivo.name.replace(/[^\w.-]+/g, '_')
  const ruta = `${params.solicitudId}/${params.momento}/${Date.now()}_${nombreSeguro}`

  const { error: errorSubida } = await supabase.storage
    .from('soportes-permisos')
    .upload(ruta, params.archivo, { contentType: params.archivo.type, upsert: false })

  if (errorSubida) throw errorSubida

  const { error } = await supabase.from('permisos_adjuntos').insert({
    solicitud_id: params.solicitudId,
    momento: params.momento,
    nombre_archivo: params.archivo.name,
    ruta_storage: ruta,
    mime: params.archivo.type,
    tamano_bytes: params.archivo.size,
    subido_por: params.usuarioId,
  })

  if (error) throw error
}

/**
 * URL temporal para ver un soporte.
 *
 * Caduca pronto a propósito: son datos de salud (Ley 1581), y una URL de
 * Storage sin caducar es un enlace público a la historia clínica de alguien.
 * Sesenta segundos bastan para abrirla en otra pestaña; las vistas previas,
 * que se quedan en pantalla, piden una ventana algo mayor.
 */
export async function urlFirmadaSoporte(ruta: string, segundos = 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from('soportes-permisos')
    .createSignedUrl(ruta, segundos)

  if (error) throw error
  return data.signedUrl
}
