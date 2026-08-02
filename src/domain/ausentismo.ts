/**
 * Indicadores de ausentismo.
 *
 * El dashboard mide **solicitudes** —cuántas entran, cuántas se aprueban, qué
 * tarda el flujo—. Esto mide otra cosa: **tiempo no laborado**. Son preguntas
 * distintas y por eso viven en módulos distintos; mezclarlas produce el informe
 * que no sirve para ninguna de las dos.
 *
 * Las fórmulas siguen la GTC 3701 y los indicadores mínimos de la Resolución
 * 0312 de 2019, que es lo que audita la ARL. Se calculan sobre la lista ya
 * filtrada: funciones puras, sin React ni Supabase.
 */

import type { CodigoTramite } from './tramites'

export interface FilaAusentismo {
  solicitud_id: string
  consecutivo: string | null
  estado: string
  extemporanea: boolean
  solicitante_id: string
  colaborador: string
  documento: string | null
  area_id: number | null
  area: string | null
  cargo_id: number | null
  cargo: string | null
  empresa_id: number | null
  empresa: string | null
  coordinador: string | null
  tramite: CodigoTramite
  categoria_id: number | null
  categoria: string | null
  tipo_id: number | null
  motivo: string | null
  naturaleza: 'permiso' | 'licencia' | 'incapacidad' | 'vacaciones' | 'tramite'
  remunerado: boolean
  fecha_solicitud: string
  fecha_inicio: string
  fecha_fin: string
  anio: number
  mes: number
  dias: number
  horas: number
}

/**
 * Base de cálculo del periodo.
 *
 * `colaboradores` es la plantilla, no la gente que faltó: dividir por quienes
 * se ausentaron daría siempre un índice cercano al máximo y no diría nada.
 */
export interface BaseCalculo {
  colaboradores: number
  mesesDelPeriodo: number
  diasHabilesMes: number
  horasJornada: number
}

export interface IndicadoresAusentismo {
  eventos: number
  colaboradoresConAusencia: number
  diasPerdidos: number
  horasPerdidas: number
  /** Horas que la plantilla debía trabajar en el periodo. */
  horasProgramadas: number
  /** (horas perdidas / horas programadas) × 100 — GTC 3701. */
  porcentajeTiempoPerdido: number | null
  /** (eventos / horas programadas) × 240.000 — GTC 3701. */
  indiceFrecuencia: number | null
  /** (días perdidos / horas programadas) × 240.000 — GTC 3701. */
  indiceSeveridad: number | null
  /** Días perdidos por evento. */
  duracionMedia: number | null
  /** Solo incapacidades y licencias: es lo que reporta la Resolución 0312. */
  diasPorCausaMedica: number
  porcentajeCausaMedica: number | null
  /** Ausencias sin la antelación del formato. */
  eventos_extemporaneos: number
}

const HORAS_BASE_GTC = 240_000

export function calcularIndicadores(
  filas: FilaAusentismo[],
  base: BaseCalculo
): IndicadoresAusentismo {
  const diasPerdidos = suma(filas.map((f) => Number(f.dias) || 0))
  const horasPerdidas = suma(filas.map((f) => Number(f.horas) || 0))

  const horasProgramadas =
    base.colaboradores * base.mesesDelPeriodo * base.diasHabilesMes * base.horasJornada

  const causaMedica = filas.filter(
    (f) => f.naturaleza === 'incapacidad' || f.naturaleza === 'licencia'
  )
  const diasCausaMedica = suma(causaMedica.map((f) => Number(f.dias) || 0))

  const conBase = horasProgramadas > 0

  return {
    eventos: filas.length,
    colaboradoresConAusencia: new Set(filas.map((f) => f.solicitante_id)).size,
    diasPerdidos: redondear(diasPerdidos, 1),
    horasPerdidas: redondear(horasPerdidas, 1),
    horasProgramadas,
    porcentajeTiempoPerdido: conBase ? redondear((horasPerdidas / horasProgramadas) * 100, 2) : null,
    indiceFrecuencia: conBase
      ? redondear((filas.length / horasProgramadas) * HORAS_BASE_GTC, 1)
      : null,
    indiceSeveridad: conBase
      ? redondear((diasPerdidos / horasProgramadas) * HORAS_BASE_GTC, 1)
      : null,
    duracionMedia: filas.length ? redondear(diasPerdidos / filas.length, 1) : null,
    diasPorCausaMedica: redondear(diasCausaMedica, 1),
    porcentajeCausaMedica: diasPerdidos
      ? redondear((diasCausaMedica / diasPerdidos) * 100, 1)
      : null,
    eventos_extemporaneos: filas.filter((f) => f.extemporanea).length,
  }
}

// -----------------------------------------------------------------------------
// Desgloses
// -----------------------------------------------------------------------------

export interface FilaAgrupada {
  clave: string
  etiqueta: string
  /** Segunda línea de la tabla: cargo, área o lo que ubique la fila. */
  detalle: string | null
  eventos: number
  dias: number
  horas: number
  diasCausaMedica: number
  colaboradores: number
  extemporaneas: number
}

function agrupar(
  filas: FilaAusentismo[],
  clave: (f: FilaAusentismo) => { clave: string; etiqueta: string; detalle: string | null }
): FilaAgrupada[] {
  const mapa = new Map<string, FilaAgrupada & { ids: Set<string> }>()

  for (const f of filas) {
    const k = clave(f)
    const actual = mapa.get(k.clave) ?? {
      clave: k.clave,
      etiqueta: k.etiqueta,
      detalle: k.detalle,
      eventos: 0,
      dias: 0,
      horas: 0,
      diasCausaMedica: 0,
      colaboradores: 0,
      extemporaneas: 0,
      ids: new Set<string>(),
    }

    actual.eventos += 1
    actual.dias += Number(f.dias) || 0
    actual.horas += Number(f.horas) || 0
    if (f.naturaleza === 'incapacidad' || f.naturaleza === 'licencia') {
      actual.diasCausaMedica += Number(f.dias) || 0
    }
    if (f.extemporanea) actual.extemporaneas += 1
    actual.ids.add(f.solicitante_id)

    mapa.set(k.clave, actual)
  }

  return [...mapa.values()]
    .map(({ ids, ...f }) => ({
      ...f,
      colaboradores: ids.size,
      dias: redondear(f.dias, 1),
      horas: redondear(f.horas, 1),
      diasCausaMedica: redondear(f.diasCausaMedica, 1),
    }))
    .sort((a, b) => b.dias - a.dias || b.eventos - a.eventos)
}

/** Control por colaborador: es la pregunta que abre casi siempre Talento Humano. */
export function porColaborador(filas: FilaAusentismo[]): FilaAgrupada[] {
  return agrupar(filas, (f) => ({
    clave: f.solicitante_id,
    etiqueta: f.colaborador,
    detalle: [f.cargo, f.area].filter(Boolean).join(' · ') || null,
  }))
}

export function porArea(filas: FilaAusentismo[]): FilaAgrupada[] {
  return agrupar(filas, (f) => ({
    clave: String(f.area_id ?? 'sin-area'),
    etiqueta: f.area ?? 'Sin área',
    detalle: null,
  }))
}

export function porMotivo(filas: FilaAusentismo[]): FilaAgrupada[] {
  return agrupar(filas, (f) => ({
    clave: String(f.tipo_id ?? f.tramite),
    etiqueta: f.motivo ?? (f.tramite === 'vacaciones' ? 'Vacaciones' : 'Sin motivo'),
    detalle: f.categoria,
  }))
}

export function porCargo(filas: FilaAusentismo[]): FilaAgrupada[] {
  return agrupar(filas, (f) => ({
    clave: String(f.cargo_id ?? 'sin-cargo'),
    etiqueta: f.cargo ?? 'Sin cargo',
    detalle: null,
  }))
}

export function porNaturaleza(filas: FilaAusentismo[]): FilaAgrupada[] {
  return agrupar(filas, (f) => ({
    clave: f.naturaleza,
    etiqueta: ETIQUETA_NATURALEZA[f.naturaleza] ?? f.naturaleza,
    detalle: null,
  }))
}

export const ETIQUETA_NATURALEZA: Record<string, string> = {
  permiso: 'Permiso del empleador',
  licencia: 'Licencia de ley',
  incapacidad: 'Incapacidad',
  vacaciones: 'Vacaciones',
  tramite: 'Trámite',
}

export interface PuntoMes {
  mes: string
  indice: number
  eventos: number
  dias: number
}

export const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const

/** Serie mensual con los doce meses, incluidos los que están en cero. */
export function porMes(filas: FilaAusentismo[], anio: number): PuntoMes[] {
  const base: PuntoMes[] = MESES_CORTOS.map((mes, i) => ({
    mes,
    indice: i,
    eventos: 0,
    dias: 0,
  }))

  for (const f of filas) {
    if (f.anio !== anio) continue
    const p = base[f.mes - 1]
    if (!p) continue
    p.eventos += 1
    p.dias += Number(f.dias) || 0
  }

  return base.map((p) => ({ ...p, dias: redondear(p.dias, 1) }))
}

/**
 * Mapa de calor área × mes en días perdidos.
 *
 * Devuelve la matriz completa, ceros incluidos: un hueco en blanco se lee como
 * «sin datos» y aquí un cero significa «nadie faltó», que es otra cosa.
 */
export function mapaCalorAreaMes(
  filas: FilaAusentismo[],
  anio: number
): { areas: string[]; celdas: { area: string; mesIndice: number; mes: string; valor: number }[]; maximo: number } {
  const areas = [...new Set(filas.map((f) => f.area ?? 'Sin área'))].sort()
  const acumulado = new Map<string, number>()

  for (const f of filas) {
    if (f.anio !== anio) continue
    const clave = `${f.area ?? 'Sin área'}|${f.mes - 1}`
    acumulado.set(clave, (acumulado.get(clave) ?? 0) + (Number(f.dias) || 0))
  }

  const celdas = areas.flatMap((area) =>
    MESES_CORTOS.map((mes, m) => ({
      area,
      mesIndice: m,
      mes,
      valor: redondear(acumulado.get(`${area}|${m}`) ?? 0, 1),
    }))
  )

  return { areas, celdas, maximo: Math.max(1, ...celdas.map((c) => c.valor)) }
}

/** Años presentes en los datos, del más reciente al más antiguo. */
export function aniosDisponibles(filas: FilaAusentismo[]): number[] {
  const anios = new Set(filas.map((f) => f.anio))
  anios.add(new Date().getFullYear())
  return [...anios].sort((a, b) => b - a)
}

function suma(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0)
}

function redondear(n: number, decimales = 0): number {
  const f = 10 ** decimales
  return Math.round(n * f) / f
}
