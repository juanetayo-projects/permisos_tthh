/**
 * Festivos de Colombia — cálculo puro, sin dependencias.
 *
 * Combina el Computus (algoritmo de Gauss para la Pascua) con la Ley 51 de 1983,
 * conocida como **Ley Emiliani**, que traslada al lunes siguiente los festivos
 * que no caen en lunes.
 *
 * Este cálculo es el que hace cuadrar el ejemplo del formato TH-F-005: 6 días de
 * vacaciones del 2 al 9 de enero de 2026 con reintegro el martes 13, porque el
 * lunes 12 es el festivo de Reyes trasladado.
 */

/** Fecha en formato ISO `YYYY-MM-DD`, que es como viaja a Postgres. */
export type FechaISO = string

const MS_POR_DIA = 86_400_000

/** Primer año en que el 13 de junio cuenta como festivo. */
const ANIO_INICIO_13_JUNIO = 2026

/** Construye una fecha en UTC para que el huso horario nunca corra un día. */
function fecha(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia))
}

export function aISO(d: Date): FechaISO {
  return d.toISOString().slice(0, 10)
}

export function desdeISO(iso: FechaISO): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return fecha(a, m, d)
}

export function sumarDias(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * MS_POR_DIA)
}

/** Domingo de Pascua por el algoritmo de Gauss (Computus gregoriano). */
function domingoDePascua(anio: number): Date {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return fecha(anio, mes, dia)
}

/** Traslada al lunes siguiente si no cae en lunes (Ley Emiliani). */
function trasladarALunes(d: Date): Date {
  const diaSemana = d.getUTCDay() // 0 domingo … 6 sábado
  if (diaSemana === 1) return d
  const faltan = (8 - diaSemana) % 7
  return sumarDias(d, faltan === 0 ? 0 : faltan)
}

const cacheFestivos = new Map<number, Set<FechaISO>>()

/** Conjunto de festivos colombianos del año dado, en formato ISO. */
export function festivosDe(anio: number): Set<FechaISO> {
  const enCache = cacheFestivos.get(anio)
  if (enCache) return enCache

  const pascua = domingoDePascua(anio)

  // Fijos: no se trasladan nunca.
  const fijos = [
    fecha(anio, 1, 1), // Año Nuevo
    fecha(anio, 5, 1), // Día del Trabajo
    fecha(anio, 7, 20), // Independencia
    fecha(anio, 8, 7), // Batalla de Boyacá
    fecha(anio, 12, 8), // Inmaculada Concepción
    fecha(anio, 12, 25), // Navidad
  ]

  // Festivo vigente a partir de 2026. Se trata como fijo en su fecha, sin
  // traslado por Ley Emiliani. En 2026 cae sábado, así que ese año no altera
  // ningún conteo de días hábiles; sí lo hará en los años en que caiga entre
  // lunes y viernes.
  if (anio >= ANIO_INICIO_13_JUNIO) {
    fijos.push(fecha(anio, 6, 13))
  }

  // Trasladables al lunes siguiente (Ley Emiliani).
  const trasladables = [
    fecha(anio, 1, 6), // Reyes Magos
    fecha(anio, 3, 19), // San José
    fecha(anio, 6, 29), // San Pedro y San Pablo
    fecha(anio, 8, 15), // Asunción de la Virgen
    fecha(anio, 10, 12), // Día de la Raza
    fecha(anio, 11, 1), // Todos los Santos
    fecha(anio, 11, 11), // Independencia de Cartagena
  ]

  // Relativos a la Pascua: Jueves y Viernes Santo no se trasladan.
  const juevesSanto = sumarDias(pascua, -3)
  const viernesSanto = sumarDias(pascua, -2)
  const relativosTrasladables = [
    sumarDias(pascua, 43), // Ascensión
    sumarDias(pascua, 64), // Corpus Christi
    sumarDias(pascua, 71), // Sagrado Corazón
  ]

  const conjunto = new Set<FechaISO>([
    ...fijos.map(aISO),
    ...trasladables.map((d) => aISO(trasladarALunes(d))),
    aISO(juevesSanto),
    aISO(viernesSanto),
    ...relativosTrasladables.map((d) => aISO(trasladarALunes(d))),
  ])

  cacheFestivos.set(anio, conjunto)
  return conjunto
}

export function esFestivo(f: Date | FechaISO): boolean {
  const d = typeof f === 'string' ? desdeISO(f) : f
  return festivosDe(d.getUTCFullYear()).has(aISO(d))
}

export function esFinDeSemana(f: Date | FechaISO): boolean {
  const d = typeof f === 'string' ? desdeISO(f) : f
  const dia = d.getUTCDay()
  return dia === 0 || dia === 6
}

/**
 * Día hábil = lunes a viernes que no sea festivo.
 *
 * Es el criterio que usa Talento Humano para contar vacaciones, y el que hace
 * cuadrar los datos del propio formato TH-F-005.
 */
export function esDiaHabil(f: Date | FechaISO): boolean {
  return !esFinDeSemana(f) && !esFestivo(f)
}

/** Días hábiles entre dos fechas, ambas inclusive. */
export function contarDiasHabiles(inicio: FechaISO, fin: FechaISO): number {
  const desde = desdeISO(inicio)
  const hasta = desdeISO(fin)
  if (hasta < desde) return 0

  let total = 0
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    if (esDiaHabil(d)) total += 1
  }
  return total
}

/** Días calendario entre dos fechas, ambas inclusive. */
export function contarDiasCalendario(inicio: FechaISO, fin: FechaISO): number {
  const desde = desdeISO(inicio)
  const hasta = desdeISO(fin)
  if (hasta < desde) return 0
  return Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA) + 1
}

/** Primer día hábil estrictamente posterior a la fecha dada. */
export function siguienteDiaHabil(desde: FechaISO): FechaISO {
  let d = sumarDias(desdeISO(desde), 1)
  while (!esDiaHabil(d)) d = sumarDias(d, 1)
  return aISO(d)
}

/**
 * Fecha en que se cumple el N-ésimo día hábil contando desde `inicio` inclusive.
 *
 * Es lo que necesita el formato de vacaciones: dado el primer día del disfrute
 * y cuántos días hábiles se van a tomar, cuál es el último día del periodo.
 * Si `inicio` no es hábil, el conteo empieza en el primer hábil siguiente.
 *
 * Verificado contra el ejemplo del TH-F-005: 6 días hábiles desde el 2 de enero
 * de 2026 terminan el 9 de enero.
 */
export function fechaFinPorDiasHabiles(inicio: FechaISO, diasHabiles: number): FechaISO {
  if (diasHabiles <= 0) return inicio

  let d = desdeISO(inicio)
  let contados = 0

  // Cota de seguridad: 15 días hábiles nunca abarcan más de un par de meses,
  // pero un dato absurdo no debe colgar el navegador.
  for (let i = 0; i < 400; i += 1) {
    if (esDiaHabil(d)) {
      contados += 1
      if (contados >= diasHabiles) return aISO(d)
    }
    d = sumarDias(d, 1)
  }

  return aISO(d)
}

/** Suma días hábiles a una fecha (para plazos de entrega de soportes). */
export function sumarDiasHabiles(desde: FechaISO, dias: number): FechaISO {
  let d = desdeISO(desde)
  let restantes = dias
  while (restantes > 0) {
    d = sumarDias(d, 1)
    if (esDiaHabil(d)) restantes -= 1
  }
  return aISO(d)
}
