/**
 * Qué documentos exige una solicitud, en qué momento y cuáles faltan.
 *
 * Antes esto era un booleano y un mensaje genérico: «adjunta el soporte». El
 * colaborador subía lo que creía, Talento Humano lo devolvía y el trámite daba
 * una vuelta completa por una diferencia que estaba clara desde el principio.
 *
 * La matriz vive en `permisos_tipos_documentos` y aquí solo se interpreta. Capa
 * de dominio pura: ni React ni Supabase.
 */

import type { FechaISO } from './festivos'

export type MomentoSoporte = 'previo' | 'posterior'

/** Fila de la matriz motivo × documento × momento, ya resuelta con su documento. */
export interface DocumentoExigido {
  id: number
  documentoId: number
  codigo: string
  nombre: string
  descripcion: string | null
  norma: string | null
  momento: MomentoSoporte
  obligatorio: boolean
  /** Solo se exige si la ausencia supera estos días; `null` = siempre. */
  desdeDias: number | null
  nota: string | null
  orden: number
}

/** Documento de la lista, ya contrastado con lo que el colaborador entregó. */
export interface DocumentoConEstado extends DocumentoExigido {
  /** Exigible **en este caso concreto**, una vez aplicado el umbral de días. */
  exigible: boolean
  entregado: boolean
}

/**
 * Documentos que aplican a una solicitud en un momento dado.
 *
 * El umbral se evalúa aquí y no en la consulta porque depende de la duración,
 * que cambia mientras el colaborador rellena el formulario: de la cita médica
 * de dos horas no se pide constancia, y de la de tres días, sí.
 */
export function documentosDelMomento(params: {
  matriz: DocumentoExigido[]
  momento: MomentoSoporte
  diasPermiso: number
  /** Códigos de documento ya adjuntados a la solicitud. */
  entregados?: string[]
}): DocumentoConEstado[] {
  const entregados = new Set(params.entregados ?? [])

  return params.matriz
    .filter((d) => d.momento === params.momento)
    .map((d) => ({
      ...d,
      exigible: d.desdeDias === null || params.diasPermiso > d.desdeDias,
      entregado: entregados.has(d.codigo),
    }))
    .sort((a, b) => a.orden - b.orden)
}

export interface EstadoChecklist {
  documentos: DocumentoConEstado[]
  /** Obligatorios que aplican y todavía no se han entregado. */
  faltantes: DocumentoConEstado[]
  completo: boolean
  /** Frase lista para mostrar; `null` cuando no falta nada. */
  mensaje: string | null
}

/**
 * Estado de la lista de documentos de un momento.
 *
 * `completo` mira solo los obligatorios: un documento opcional que no se
 * entrega no puede impedir que se cierre el trámite, y esa distinción es
 * justamente la que no existía cuando todo era un único booleano.
 */
export function evaluarChecklist(params: {
  matriz: DocumentoExigido[]
  momento: MomentoSoporte
  diasPermiso: number
  entregados?: string[]
}): EstadoChecklist {
  const documentos = documentosDelMomento(params)
  const faltantes = documentos.filter((d) => d.exigible && d.obligatorio && !d.entregado)

  return {
    documentos,
    faltantes,
    completo: faltantes.length === 0,
    mensaje:
      faltantes.length === 0
        ? null
        : faltantes.length === 1
          ? `Falta un documento: ${faltantes[0].nombre}.`
          : `Faltan ${faltantes.length} documentos: ${faltantes.map((d) => d.nombre).join(', ')}.`,
  }
}

export interface AvisoVencimiento {
  vencido: boolean
  diasRestantes: number
  mensaje: string
}

/**
 * Cuánto queda para entregar el soporte posterior.
 *
 * Se cuenta en días calendario aunque el plazo se haya fijado en hábiles: la
 * fecha límite ya viene calculada, y lo que el colaborador necesita saber es
 * cuántos días de los suyos le quedan.
 */
export function avisoDeVencimiento(
  fechaLimite: FechaISO | null,
  hoy: FechaISO
): AvisoVencimiento | null {
  if (!fechaLimite) return null

  const dias = Math.round(
    (Date.parse(`${fechaLimite}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000
  )

  if (dias < 0) {
    return {
      vencido: true,
      diasRestantes: dias,
      mensaje: `El plazo para entregar el soporte venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}.`,
    }
  }

  return {
    vencido: false,
    diasRestantes: dias,
    mensaje:
      dias === 0
        ? 'Hoy vence el plazo para entregar el soporte.'
        : `Quedan ${dias} día${dias === 1 ? '' : 's'} para entregar el soporte.`,
  }
}
