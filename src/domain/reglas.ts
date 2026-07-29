/**
 * Reglas de negocio de permisos y vacaciones.
 *
 * Capa de dominio pura: no importa React ni Supabase, así que se puede probar
 * con Vitest sin levantar nada. Toda decisión del negocio vive aquí y las
 * pantallas solo la muestran.
 */

import {
  contarDiasCalendario,
  contarDiasHabiles,
  desdeISO,
  siguienteDiaHabil,
  sumarDiasHabiles,
  type FechaISO,
} from './festivos'

// -----------------------------------------------------------------------------
// Permisos — TH-F-002
// -----------------------------------------------------------------------------

export interface DuracionPermiso {
  horas: number
  dias: number
}

/**
 * Duración de un permiso.
 *
 * Si hay horas de salida y regreso el mismo día, se cuenta en horas y se
 * expresa también en jornadas de 8 h, que es como lo lee Talento Humano.
 * Si el permiso abarca varios días, manda el número de días.
 */
export function calcularDuracion(params: {
  fechaInicio: FechaISO
  fechaFin: FechaISO
  horaSalida?: string | null
  horaRegreso?: string | null
  horasPorJornada?: number
}): DuracionPermiso {
  const { fechaInicio, fechaFin, horaSalida, horaRegreso } = params
  const horasPorJornada = params.horasPorJornada ?? 8

  const diasCalendario = contarDiasCalendario(fechaInicio, fechaFin)

  if (diasCalendario === 1 && horaSalida && horaRegreso) {
    const horas = diferenciaHoras(horaSalida, horaRegreso)
    return {
      horas: redondear(horas),
      dias: redondear(horas / horasPorJornada),
    }
  }

  return {
    horas: redondear(diasCalendario * horasPorJornada),
    dias: diasCalendario,
  }
}

/** Diferencia en horas entre dos `HH:MM`. Nunca devuelve negativos. */
export function diferenciaHoras(salida: string, regreso: string): number {
  const minutos = aMinutos(regreso) - aMinutos(salida)
  return minutos <= 0 ? 0 : minutos / 60
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

// -----------------------------------------------------------------------------
// Antelación
// -----------------------------------------------------------------------------

export interface ResultadoAntelacion {
  /** Horas reales de antelación entre la solicitud y el inicio del permiso. */
  horasAntelacion: number
  diasAntelacion: number
  /** `true` cuando no alcanza el mínimo del formato. */
  extemporanea: boolean
  /** El tipo está exento (calamidad, luto, incapacidad): nunca es extemporánea. */
  exenta: boolean
  mensaje: string | null
}

/**
 * Evalúa la regla de antelación.
 *
 * Es deliberadamente una **advertencia y no un bloqueo**: los propios ejemplos
 * que entregó el cliente la incumplen (una solicitud del 30/03 para un permiso
 * el 31/03), y una calamidad o un luto no pueden planearse con 48 horas.
 * La solicitud se marca `extemporanea` para poder medir el cumplimiento en el
 * dashboard, pero se envía igual.
 */
export function evaluarAntelacion(params: {
  fechaInicio: FechaISO
  horaSalida?: string | null
  ahora?: Date
  antelacionMinima: number
  unidad: 'horas' | 'dias'
  exento?: boolean
}): ResultadoAntelacion {
  const ahora = params.ahora ?? new Date()

  const inicio = desdeISO(params.fechaInicio)
  if (params.horaSalida) {
    const [h, m] = params.horaSalida.split(':').map(Number)
    inicio.setUTCHours(h ?? 0, m ?? 0, 0, 0)
  }

  const horasAntelacion = (inicio.getTime() - ahora.getTime()) / 3_600_000
  const diasAntelacion = horasAntelacion / 24

  if (params.exento) {
    return {
      horasAntelacion: redondear(horasAntelacion),
      diasAntelacion: redondear(diasAntelacion),
      extemporanea: false,
      exenta: true,
      mensaje: 'Este motivo está exento de la regla de antelación.',
    }
  }

  const minimoEnHoras =
    params.unidad === 'dias' ? params.antelacionMinima * 24 : params.antelacionMinima
  const extemporanea = horasAntelacion < minimoEnHoras

  return {
    horasAntelacion: redondear(horasAntelacion),
    diasAntelacion: redondear(diasAntelacion),
    extemporanea,
    exenta: false,
    mensaje: extemporanea ? mensajeExtemporanea(horasAntelacion, params) : null,
  }
}

function mensajeExtemporanea(
  horas: number,
  params: { antelacionMinima: number; unidad: 'horas' | 'dias' }
): string {
  const unidadTexto = params.unidad === 'dias' ? 'días' : 'horas'

  if (horas < 0) {
    return `La fecha ya pasó. El formato exige ${params.antelacionMinima} ${unidadTexto} de antelación; la solicitud quedará marcada como extemporánea.`
  }

  const restante =
    params.unidad === 'dias'
      ? `${Math.floor(horas / 24)} días`
      : `${Math.floor(horas)} horas`

  return `Faltan ${restante} para el inicio y el formato exige ${params.antelacionMinima} ${unidadTexto}. Puedes enviarla, pero quedará marcada como extemporánea.`
}

// -----------------------------------------------------------------------------
// Soportes
// -----------------------------------------------------------------------------

export interface ExigenciaSoporte {
  requerido: boolean
  momento: 'previo' | 'posterior' | null
  obligatorio: boolean
  fechaLimite: FechaISO | null
  mensaje: string | null
}

/**
 * Decide si una solicitud exige soporte y cuándo.
 *
 * El caso que motivó el estado `PENDIENTE_SOPORTE`: una cita médica autorizada
 * cuyo ausentismo supera los 2 días obliga al colaborador a entregar después
 * copia de la asistencia, la incapacidad o la historia clínica.
 */
export function evaluarSoporte(params: {
  requiereSoportePrevio: boolean
  requiereSoportePosterior: boolean
  umbralDias?: number | null
  diasPermiso: number
  fechaFin: FechaISO
  plazoDiasHabiles?: number
}): ExigenciaSoporte {
  if (params.requiereSoportePrevio) {
    return {
      requerido: true,
      momento: 'previo',
      obligatorio: true,
      fechaLimite: null,
      mensaje: 'Este motivo exige adjuntar el soporte al momento de solicitar.',
    }
  }

  if (!params.requiereSoportePosterior) {
    return { requerido: false, momento: null, obligatorio: false, fechaLimite: null, mensaje: null }
  }

  const umbral = params.umbralDias ?? null
  const superaUmbral = umbral === null || params.diasPermiso > umbral
  const plazo = params.plazoDiasHabiles ?? 5

  return {
    requerido: true,
    momento: 'posterior',
    obligatorio: superaUmbral,
    fechaLimite: superaUmbral ? sumarDiasHabiles(params.fechaFin, plazo) : null,
    mensaje: superaUmbral
      ? umbral === null
        ? 'Al regresar deberás adjuntar el soporte correspondiente.'
        : `El ausentismo supera ${umbral} días: al regresar deberás adjuntar copia de la asistencia médica, la incapacidad o la historia clínica.`
      : `Si el ausentismo llega a superar ${umbral} días, deberás adjuntar el soporte al regresar.`,
  }
}

// -----------------------------------------------------------------------------
// Vacaciones — TH-F-005
// -----------------------------------------------------------------------------

export interface CalculoVacaciones {
  diasHabiles: number
  diasCalendario: number
  fechaReintegro: FechaISO
  /** Diferencia contra lo que digitó el colaborador; 0 si coincide. */
  diferenciaConDigitado: number
  coincide: boolean
  advertencia: string | null
}

/**
 * Calcula los días hábiles del periodo y la fecha de reintegro.
 *
 * Verificado contra el ejemplo del propio formato: del 2 al 9 de enero de 2026
 * hay 6 días hábiles y el reintegro cae el martes 13, porque el lunes 12 es el
 * festivo de Reyes trasladado por Ley Emiliani.
 *
 * Los saldos los digita el colaborador y los valida Talento Humano contra
 * nómina (decisión D11): esta función **advierte** de la diferencia, no la
 * corrige ni impide continuar.
 */
export function calcularVacaciones(params: {
  fechaInicio: FechaISO
  fechaFin: FechaISO
  diasADisfrutar?: number | null
}): CalculoVacaciones {
  const diasHabiles = contarDiasHabiles(params.fechaInicio, params.fechaFin)
  const diasCalendario = contarDiasCalendario(params.fechaInicio, params.fechaFin)
  const fechaReintegro = siguienteDiaHabil(params.fechaFin)

  const digitado = params.diasADisfrutar ?? null
  const diferencia = digitado === null ? 0 : redondear(digitado - diasHabiles)
  const coincide = digitado === null || diferencia === 0

  return {
    diasHabiles,
    diasCalendario,
    fechaReintegro,
    diferenciaConDigitado: diferencia,
    coincide,
    advertencia: coincide
      ? null
      : `El periodo seleccionado tiene ${diasHabiles} días hábiles y registraste ${digitado}. Talento Humano validará el saldo contra nómina antes de aprobar.`,
  }
}

/** Coherencia de los saldos digitados: corresponden = a disfrutar + pendientes. */
export function validarSaldos(params: {
  diasCorresponden?: number | null
  diasADisfrutar?: number | null
  diasPendientes?: number | null
}): { coherente: boolean; advertencia: string | null } {
  const { diasCorresponden, diasADisfrutar, diasPendientes } = params

  if (diasCorresponden == null || diasADisfrutar == null || diasPendientes == null) {
    return { coherente: true, advertencia: null }
  }

  const suma = redondear(diasADisfrutar + diasPendientes)
  if (suma === redondear(diasCorresponden)) return { coherente: true, advertencia: null }

  return {
    coherente: false,
    advertencia: `Los días a disfrutar (${diasADisfrutar}) más los pendientes (${diasPendientes}) suman ${suma}, y registraste ${diasCorresponden} días que corresponden.`,
  }
}
