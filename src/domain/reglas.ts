/**
 * Reglas de negocio de permisos y vacaciones.
 *
 * Capa de dominio pura: no importa React ni Supabase, así que se puede probar
 * con Vitest sin levantar nada. Toda decisión del negocio vive aquí y las
 * pantallas solo la muestran.
 */

import {
  aISO,
  contarDiasCalendario,
  contarDiasHabiles,
  desdeISO,
  siguienteDiaHabil,
  sumarDias,
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
  /**
   * `true`: el motivo resta domingos y festivos, como vacaciones (p. ej. luto,
   * 5 días hábiles por la Ley 1280 de 2009). Por defecto cuenta calendario,
   * que es como se han medido siempre los demás permisos.
   */
  enDiasHabiles?: boolean
}): DuracionPermiso {
  const { fechaInicio, fechaFin, horaSalida, horaRegreso } = params
  const horasPorJornada = params.horasPorJornada ?? 8

  const dias = params.enDiasHabiles
    ? contarDiasHabiles(fechaInicio, fechaFin)
    : contarDiasCalendario(fechaInicio, fechaFin)

  if (dias === 1 && horaSalida && horaRegreso) {
    const horas = diferenciaHoras(horaSalida, horaRegreso)
    return {
      horas: redondear(horas),
      dias: redondear(horas / horasPorJornada),
    }
  }

  return {
    horas: redondear(dias * horasPorJornada),
    dias,
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

function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales
  return Math.round(n * f) / f
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
  /** Documento que se adjunta al enviar la solicitud; `null` si no aplica. */
  previo: { obligatorio: boolean; mensaje: string } | null
  /** Documento que se entrega al regresar; `null` si no aplica. */
  posterior: { obligatorio: boolean; fechaLimite: FechaISO | null; mensaje: string } | null
}

/**
 * Decide qué soportes exige una solicitud y en qué momento.
 *
 * Los dos momentos son independientes y **pueden coincidir**: una cita médica
 * puede pedir la orden al solicitar y la constancia de asistencia al regresar.
 * Antes esta función devolvía un único `momento` y salía en cuanto encontraba
 * el previo, así que el posterior quedaba ignorado en silencio y esa
 * combinación era imposible por mucho que se configurara en Administración.
 *
 * El umbral de días solo afecta al soporte posterior: es lo que permite pedir
 * la constancia únicamente cuando el ausentismo pasa de cierta duración.
 */
export function evaluarSoporte(params: {
  requiereSoportePrevio: boolean
  requiereSoportePosterior: boolean
  umbralDias?: number | null
  diasPermiso: number
  fechaFin: FechaISO
  plazoDiasHabiles?: number
  /**
   * Plazo propio del motivo. Manda sobre el global porque los plazos legales
   * son muy distintos entre sí: tres días hábiles para transcribir una
   * incapacidad y un mes para el certificado electoral (Ley 403 de 1997).
   */
  plazoDelMotivo?: number | null
  /** `false` cuenta el plazo en días calendario, como los plazos largos. */
  plazoEnHabiles?: boolean
}): ExigenciaSoporte {
  const previo = params.requiereSoportePrevio
    ? {
        obligatorio: true,
        mensaje: 'Este motivo exige adjuntar el soporte al momento de solicitar.',
      }
    : null

  if (!params.requiereSoportePosterior) return { previo, posterior: null }

  const umbral = params.umbralDias ?? null
  const superaUmbral = umbral === null || params.diasPermiso > umbral

  return {
    previo,
    posterior: {
      obligatorio: superaUmbral,
      fechaLimite: superaUmbral ? fechaLimiteSoporte(params) : null,
      mensaje: superaUmbral
        ? umbral === null
          ? 'Al regresar deberás adjuntar el soporte correspondiente.'
          : `El ausentismo supera ${umbral} días: al regresar deberás adjuntar copia de la asistencia médica, la incapacidad o la historia clínica.`
        : `Si el ausentismo llega a superar ${umbral} días, deberás adjuntar el soporte al regresar.`,
    },
  }
}

/**
 * Fecha tope para entregar el soporte posterior.
 *
 * Se cuenta desde el día siguiente al regreso. En hábiles por defecto —así se
 * expresan los plazos internos— y en calendario cuando la norma habla de meses,
 * porque «un mes» no significa «treinta días hábiles» en ninguna parte.
 */
export function fechaLimiteSoporte(params: {
  fechaFin: FechaISO
  plazoDelMotivo?: number | null
  plazoEnHabiles?: boolean
  plazoDiasHabiles?: number
}): FechaISO {
  const plazo = params.plazoDelMotivo ?? params.plazoDiasHabiles ?? 5
  const enHabiles = params.plazoEnHabiles ?? true

  return enHabiles
    ? sumarDiasHabiles(params.fechaFin, plazo)
    : aISO(sumarDias(desdeISO(params.fechaFin), plazo))
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

// -----------------------------------------------------------------------------
// Las tres reglas duras del TH-F-005
//
// Son la excepción declarada al criterio general de la aplicación —«las reglas
// de antelación avisan y marcan extemporánea, nunca bloquean»—. Talento Humano
// pidió expresamente que en vacaciones sí impidan enviar, porque a diferencia
// de un permiso, unas vacaciones nunca son urgentes ni imprevistas: se planean.
// La excepción vale **solo** para vacaciones; permisos y cesantías siguen
// avisando, que es justo lo que permite registrar una calamidad ya ocurrida.
// -----------------------------------------------------------------------------

/** Días **corridos** de antelación, contando sábados, domingos y festivos. */
export const VACACIONES_ANTELACION_DIAS = 20

/** Mínimo de días a disfrutar en una solicitud normal. */
export const VACACIONES_DIAS_MINIMOS = 6

/**
 * Mínimo de días de descanso real cuando además se piden días compensados.
 *
 * Sube de 6 a 8: los compensados se pagan en vez de disfrutarse, y la regla
 * existe para que compensar no acabe vaciando el descanso.
 */
export const VACACIONES_DIAS_MINIMOS_CON_COMPENSADOS = 8

/**
 * Hasta cuándo se puede radicar unas vacaciones que empiezan en `fechaInicio`.
 *
 * Se cuenta en días corridos hacia atrás, no hábiles: es lo que pidió Talento
 * Humano y lo que hace que la fecha sea fácil de comprobar en un calendario.
 */
export function fechaLimiteRadicacion(
  fechaInicio: FechaISO,
  dias = VACACIONES_ANTELACION_DIAS
): FechaISO {
  return aISO(sumarDias(desdeISO(fechaInicio), -dias))
}

/** La primera fecha de inicio que hoy todavía admite la antelación mínima. */
export function primeraFechaDeInicioValida(
  hoy: FechaISO,
  dias = VACACIONES_ANTELACION_DIAS
): FechaISO {
  return aISO(sumarDias(desdeISO(hoy), dias))
}

export interface AntelacionVacaciones {
  /** `false` cuando la fecha de inicio está demasiado cerca: impide enviar. */
  cumple: boolean
  diasDeAntelacion: number
  /** Último día en que se pudo radicar para ese inicio. */
  fechaLimite: FechaISO
  /** La primera fecha de inicio que sí sería válida radicando hoy. */
  primeraValida: FechaISO
}

export function evaluarAntelacionVacaciones(params: {
  fechaInicio: FechaISO
  hoy: FechaISO
  dias?: number
}): AntelacionVacaciones {
  const dias = params.dias ?? VACACIONES_ANTELACION_DIAS
  // `contarDiasCalendario` cuenta ambos extremos; aquí interesa la distancia
  // entre las dos fechas, así que se descuenta uno.
  const diasDeAntelacion = contarDiasCalendario(params.hoy, params.fechaInicio) - 1

  return {
    cumple: diasDeAntelacion >= dias,
    diasDeAntelacion,
    fechaLimite: fechaLimiteRadicacion(params.fechaInicio, dias),
    primeraValida: primeraFechaDeInicioValida(params.hoy, dias),
  }
}

/**
 * Días que le quedan pendientes por disfrutar.
 *
 * Los compensados **también descuentan**: se pagan en vez de disfrutarse, así
 * que dejan de estar pendientes. Restar solo los días a disfrutar —la lectura
 * literal de «corresponden − a disfrutar»— dejaría los compensados contados
 * como saldo vivo y el colaborador creería que aún los puede tomar.
 */
export function diasPendientesDeDisfrutar(params: {
  diasCorresponden?: number | null
  diasADisfrutar?: number | null
  diasCompensados?: number | null
}): number | null {
  if (params.diasCorresponden == null) return null

  const consumidos = (params.diasADisfrutar ?? 0) + (params.diasCompensados ?? 0)
  return redondear(Math.max(0, params.diasCorresponden - consumidos))
}

// -----------------------------------------------------------------------------
// Qué fechas admite cada motivo
// -----------------------------------------------------------------------------

/**
 * Lo que el dominio necesita saber de un motivo para decidir.
 *
 * Es un subconjunto de `permisos_tipos` a propósito: así estas funciones se
 * pueden probar con un objeto literal, sin arrastrar la fila entera ni la
 * dependencia de Supabase.
 */
export interface ReglasDelMotivo {
  nombre?: string
  diasMaxRetroactivo?: number | null
  diasMaxFuturo?: number | null
  duracionMaximaDias?: number | null
  duracionMinimaDias?: number | null
  permiteHoras?: boolean
  diasCalendario?: boolean
  maxPorPeriodo?: number | null
  periodoControl?: 'ninguno' | 'mes' | 'semestre' | 'anio'
}

export interface RangoFechas {
  min: FechaISO
  max: FechaISO | null
  /** Explica el límite en el idioma del colaborador, no en el del esquema. */
  ayuda: string
}

/**
 * Ventana de fechas que acepta un motivo.
 *
 * Es la regla que faltaba y que más ruido generaba en la práctica. El
 * formulario solo sabía «no antes de hoy, salvo calamidad y luto», así que:
 * una incapacidad expedida el viernes no se podía registrar el lunes, y un
 * permiso para dentro de tres años se aceptaba sin pestañear.
 *
 * Cada motivo declara ahora cuánto admite hacia atrás y hacia adelante. Al
 * contrario que la antelación, esto **sí** acota el selector: una fecha fuera
 * de rango no es una solicitud extemporánea, es un dato equivocado.
 */
export function rangoFechasPermitido(
  reglas: ReglasDelMotivo | null | undefined,
  hoy: FechaISO
): RangoFechas {
  // Sin motivo elegido todavía no se puede acotar nada: se deja el
  // comportamiento conservador de siempre.
  if (!reglas) {
    return { min: hoy, max: null, ayuda: 'Elige primero el motivo para ver las fechas que admite.' }
  }

  const retro = reglas.diasMaxRetroactivo ?? 0
  const futuro = reglas.diasMaxFuturo ?? null

  const min = retro > 0 ? aISO(sumarDias(desdeISO(hoy), -retro)) : hoy
  const max = futuro !== null ? aISO(sumarDias(desdeISO(hoy), futuro)) : null

  const partes: string[] = []
  partes.push(
    retro > 0
      ? `Admite registrar hasta ${retro} día${retro === 1 ? '' : 's'} hacia atrás.`
      : 'No admite fechas anteriores a hoy.'
  )
  if (futuro !== null) partes.push(`Como máximo, ${futuro} días hacia adelante.`)

  return { min, max, ayuda: partes.join(' ') }
}

export interface AvisoDuracion {
  excede: boolean
  mensaje: string | null
}

/**
 * Contrasta la duración pedida contra el tope del motivo.
 *
 * Advierte y deja continuar: la prórroga de una incapacidad supera el tope con
 * toda normalidad, y bloquearla obligaría a partirla en dos solicitudes que
 * después nadie sabe que eran la misma.
 */
export function evaluarDuracion(
  reglas: ReglasDelMotivo | null | undefined,
  dias: number
): AvisoDuracion {
  const tope = reglas?.duracionMaximaDias ?? null
  if (tope === null || dias <= tope) return { excede: false, mensaje: null }

  return {
    excede: true,
    mensaje: `Este motivo contempla hasta ${tope} día${tope === 1 ? '' : 's'} y estás pidiendo ${redondear(dias, 1)}. Puedes enviarla, pero Talento Humano tendrá que sustentar la diferencia.`,
  }
}

export interface AvisoCupo {
  excedido: boolean
  usados: number
  mensaje: string | null
}

/** Etiqueta del periodo al que pertenece una fecha, según el control del motivo. */
export function periodoDe(fecha: FechaISO, control: ReglasDelMotivo['periodoControl']): string {
  const [anio, mes] = fecha.split('-').map(Number)

  switch (control) {
    case 'mes':
      return `${anio}-${String(mes).padStart(2, '0')}`
    case 'semestre':
      return `${anio}-S${mes <= 6 ? 1 : 2}`
    case 'anio':
      return String(anio)
    default:
      return 'sin-control'
  }
}

/**
 * ¿Queda cupo del motivo en el periodo?
 *
 * El día de la familia es semestral (Ley 1857 de 2017, art. 3) y hasta ahora el
 * único control era que alguien se acordara. Se cuentan solo las solicitudes que
 * siguen vivas: una rechazada o cancelada no consume el beneficio.
 */
export function evaluarCupo(params: {
  reglas: ReglasDelMotivo | null | undefined
  fechaInicio: FechaISO
  /** Fechas de inicio de las solicitudes vigentes del mismo motivo. */
  previas: FechaISO[]
}): AvisoCupo {
  const { reglas } = params
  const cupo = reglas?.maxPorPeriodo ?? null
  const control = reglas?.periodoControl ?? 'ninguno'

  if (cupo === null || control === 'ninguno') {
    return { excedido: false, usados: 0, mensaje: null }
  }

  const periodo = periodoDe(params.fechaInicio, control)
  const usados = params.previas.filter((f) => periodoDe(f, control) === periodo).length

  const nombrePeriodo =
    control === 'mes' ? 'este mes' : control === 'semestre' ? 'este semestre' : 'este año'

  if (usados < cupo) {
    return {
      excedido: false,
      usados,
      mensaje:
        usados === 0
          ? null
          : `Ya usaste este beneficio ${usados} vez${usados === 1 ? '' : 'ces'} ${nombrePeriodo}; el cupo es de ${cupo}.`,
    }
  }

  return {
    excedido: true,
    usados,
    mensaje: `Ya agotaste el cupo de este motivo ${nombrePeriodo} (${usados} de ${cupo}). Talento Humano tendrá que autorizarlo como excepción.`,
  }
}
