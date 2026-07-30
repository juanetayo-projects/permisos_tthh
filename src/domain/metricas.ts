import type { Estado } from './estados'
import { contarDiasHabiles, type FechaISO } from './festivos'

/**
 * Agregaciones del dashboard.
 *
 * Son funciones puras sobre la lista ya filtrada: no conocen React ni
 * Supabase, así que se pueden probar sin levantar nada. El volumen de una
 * clínica (cientos de solicitudes al año) hace innecesario agregar en la base
 * de datos, y calcular en el cliente permite que los filtros respondan al
 * instante sin ida y vuelta al servidor.
 */

export interface SolicitudMetrica {
  estado: Estado
  extemporanea: boolean
  fecha_solicitud: string
  fecha_inicio: string
  fecha_fin: string
  coord_fecha: string | null
  th_fecha: string | null
  created_at: string
  area: { id: number; nombre: string } | null
  empresa: { id: number; nombre: string } | null
  tramite: { codigo: 'permiso' | 'vacaciones' } | null
  detalle_permiso: {
    horas_permiso: number | null
    dias_permiso: number | null
    categoria: { id: number; nombre: string } | null
    tipo: { id: number; nombre: string } | null
  } | null
  detalle_vacaciones: { dias_a_disfrutar: number | null } | null
}

const EN_TRAMITE: Estado[] = [
  'PENDIENTE_COORDINADOR',
  'PENDIENTE_TH',
  'PENDIENTE_GERENCIA_TH',
  'PENDIENTE_SOPORTE',
]
const APROBADAS: Estado[] = ['APROBADA_TH', 'FINALIZADA', 'ARCHIVADA', 'PENDIENTE_SOPORTE']
const RECHAZADAS: Estado[] = ['RECHAZADA_COORDINADOR', 'RECHAZADA_TH']

export interface Kpis {
  total: number
  enTramite: number
  aprobadas: number
  rechazadas: number
  extemporaneas: number
  horasAusentismo: number
  diasVacaciones: number
  /** Días hábiles promedio entre el envío y la decisión final. */
  cicloPromedio: number | null
  tasaAprobacion: number | null
  soportesPendientes: number
}

export function calcularKpis(lista: SolicitudMetrica[]): Kpis {
  const aprobadas = lista.filter((s) => APROBADAS.includes(s.estado))
  const rechazadas = lista.filter((s) => RECHAZADAS.includes(s.estado))
  const decididas = [...aprobadas, ...rechazadas]

  const ciclos = decididas
    .map((s) => {
      const fin = s.th_fecha ?? s.coord_fecha
      if (!fin) return null
      return contarDiasHabiles(s.created_at.slice(0, 10) as FechaISO, fin.slice(0, 10) as FechaISO)
    })
    .filter((d): d is number => d !== null)

  return {
    total: lista.length,
    enTramite: lista.filter((s) => EN_TRAMITE.includes(s.estado)).length,
    aprobadas: aprobadas.length,
    rechazadas: rechazadas.length,
    extemporaneas: lista.filter((s) => s.extemporanea).length,
    horasAusentismo: redondear(
      lista
        .filter((s) => APROBADAS.includes(s.estado))
        .reduce((t, s) => t + (s.detalle_permiso?.horas_permiso ?? 0), 0)
    ),
    diasVacaciones: redondear(
      lista
        .filter((s) => APROBADAS.includes(s.estado))
        .reduce((t, s) => t + (s.detalle_vacaciones?.dias_a_disfrutar ?? 0), 0)
    ),
    cicloPromedio: ciclos.length ? redondear(ciclos.reduce((a, b) => a + b, 0) / ciclos.length, 1) : null,
    tasaAprobacion: decididas.length ? redondear((aprobadas.length / decididas.length) * 100) : null,
    soportesPendientes: lista.filter((s) => s.estado === 'PENDIENTE_SOPORTE').length,
  }
}

function redondear(n: number, decimales = 0): number {
  const f = 10 ** decimales
  return Math.round(n * f) / f
}

export const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const

export interface PuntoTendencia {
  mes: string
  indice: number
  permisos: number
  vacaciones: number
  total: number
}

/** Serie mensual del año indicado, con los 12 meses aunque estén vacíos. */
export function tendenciaMensual(lista: SolicitudMetrica[], anio: number): PuntoTendencia[] {
  const base: PuntoTendencia[] = MESES.map((mes, i) => ({
    mes,
    indice: i,
    permisos: 0,
    vacaciones: 0,
    total: 0,
  }))

  for (const s of lista) {
    const f = new Date(`${s.fecha_inicio}T00:00:00`)
    if (f.getFullYear() !== anio) continue
    const p = base[f.getMonth()]
    if (s.tramite?.codigo === 'vacaciones') p.vacaciones += 1
    else p.permisos += 1
    p.total += 1
  }

  return base
}

export interface Segmento {
  nombre: string
  valor: number
}

/** Distribución por categoría del formato, ordenada de mayor a menor. */
export function porCategoria(lista: SolicitudMetrica[]): Segmento[] {
  const mapa = new Map<string, number>()

  for (const s of lista) {
    const nombre =
      s.tramite?.codigo === 'vacaciones'
        ? 'Vacaciones'
        : (s.detalle_permiso?.categoria?.nombre ?? 'Sin categoría')
    mapa.set(nombre, (mapa.get(nombre) ?? 0) + 1)
  }

  return [...mapa.entries()]
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor)
}

export function porTipo(lista: SolicitudMetrica[], limite = 10): Segmento[] {
  const mapa = new Map<string, number>()

  for (const s of lista) {
    const nombre =
      s.tramite?.codigo === 'vacaciones'
        ? 'Periodo de vacaciones'
        : (s.detalle_permiso?.tipo?.nombre ?? 'Sin motivo')
    mapa.set(nombre, (mapa.get(nombre) ?? 0) + 1)
  }

  return [...mapa.entries()]
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limite)
}

export interface FilaRanking {
  areaId: number | null
  area: string
  solicitudes: number
  horas: number
  dias: number
  extemporaneas: number
}

/** Ranking de áreas por número de solicitudes. */
export function rankingAreas(lista: SolicitudMetrica[]): FilaRanking[] {
  const mapa = new Map<string, FilaRanking>()

  for (const s of lista) {
    const area = s.area?.nombre ?? 'Sin área'
    const fila = mapa.get(area) ?? {
      areaId: s.area?.id ?? null,
      area,
      solicitudes: 0,
      horas: 0,
      dias: 0,
      extemporaneas: 0,
    }

    fila.solicitudes += 1
    fila.horas += s.detalle_permiso?.horas_permiso ?? 0
    fila.dias += s.detalle_vacaciones?.dias_a_disfrutar ?? s.detalle_permiso?.dias_permiso ?? 0
    if (s.extemporanea) fila.extemporaneas += 1

    mapa.set(area, fila)
  }

  return [...mapa.values()]
    .map((f) => ({ ...f, horas: redondear(f.horas), dias: redondear(f.dias, 1) }))
    .sort((a, b) => b.solicitudes - a.solicitudes)
}

export interface CeldaCalor {
  area: string
  mesIndice: number
  mes: string
  valor: number
}

/**
 * Mapa de calor área × mes.
 *
 * Devuelve la matriz completa, incluidos los ceros: un hueco en blanco se lee
 * como "sin datos" y aquí un cero significa "ninguna solicitud", que es
 * información distinta.
 */
export function mapaCalorAreaMes(
  lista: SolicitudMetrica[],
  anio: number
): { areas: string[]; celdas: CeldaCalor[]; maximo: number } {
  const areas = [...new Set(lista.map((s) => s.area?.nombre ?? 'Sin área'))].sort()
  const acumulado = new Map<string, number>()

  for (const s of lista) {
    const f = new Date(`${s.fecha_inicio}T00:00:00`)
    if (f.getFullYear() !== anio) continue
    const clave = `${s.area?.nombre ?? 'Sin área'}|${f.getMonth()}`
    acumulado.set(clave, (acumulado.get(clave) ?? 0) + 1)
  }

  const celdas: CeldaCalor[] = []
  for (const area of areas) {
    for (let m = 0; m < 12; m += 1) {
      celdas.push({
        area,
        mesIndice: m,
        mes: MESES[m],
        valor: acumulado.get(`${area}|${m}`) ?? 0,
      })
    }
  }

  return { areas, celdas, maximo: Math.max(1, ...celdas.map((c) => c.valor)) }
}

/** Años presentes en los datos, del más reciente al más antiguo. */
export function aniosDisponibles(lista: SolicitudMetrica[]): number[] {
  const anios = new Set(lista.map((s) => Number(s.fecha_inicio.slice(0, 4))))
  anios.add(new Date().getFullYear())
  return [...anios].sort((a, b) => b - a)
}
