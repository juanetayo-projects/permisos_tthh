/**
 * Ausencias que se cruzan entre sí.
 *
 * El motor daba por hecho que los permisos no se tocan. En una clínica se tocan
 * todo el tiempo, y el Código Sustantivo del Trabajo tiene una respuesta
 * concreta para cada caso:
 *
 *   · **Incapacidad durante vacaciones** → la incapacidad manda: las vacaciones
 *     son descanso y una incapacidad no lo es, así que el periodo se suspende y
 *     los días no disfrutados quedan pendientes (art. 187 CST y doctrina
 *     reiterada del Ministerio del Trabajo).
 *   · **Incapacidad durante la licencia de luto** → igual: la licencia no
 *     absorbe la incapacidad que aparece dentro de ella.
 *   · **Calamidad durante vacaciones** → el descanso sigue corriendo. Se
 *     registra como antecedente y no parte el periodo, salvo que derive en
 *     incapacidad, que es un motivo distinto.
 *   · **Permiso dentro de un permiso** → no tiene sentido: es un error de
 *     digitación y se avisa como tal.
 *
 * Quien decide sigue siendo Talento Humano. Aquí se detecta el cruce y se
 * propone qué manda, con la prioridad que trae cada motivo. La aplicación
 * advierte; no parte periodos por su cuenta.
 */

import { contarDiasCalendario, contarDiasHabiles, type FechaISO } from './festivos'

/** Estados en los que una solicitud «ocupa» sus fechas y puede cruzarse. */
export const ESTADOS_VIGENTES = [
  'PENDIENTE_COORDINADOR',
  'APROBADA_COORDINADOR',
  'PENDIENTE_TH',
  'PENDIENTE_GERENCIA_TH',
  'APROBADA_TH',
  'PENDIENTE_SOPORTE',
  'SOPORTE_EN_VALIDACION',
  'FINALIZADA',
  'ARCHIVADA',
] as const

export interface PeriodoOcupado {
  id: string
  consecutivo: string | null
  estado: string
  fechaInicio: FechaISO
  fechaFin: FechaISO
  /** Nombre del motivo o «Vacaciones» cuando el trámite no tiene motivo. */
  motivo: string
  /** Prioridad del motivo; las vacaciones valen 10 por convención del catálogo. */
  prioridad: number
  /** El motivo puede interrumpir a otros ya autorizados. */
  interrumpeOtros: boolean
  esVacaciones: boolean
  /** Se cuenta por días calendario en vez de hábiles. */
  diasCalendario: boolean
}

/** Dos periodos se solapan si comparten al menos un día. */
export function seSolapan(
  a: { inicio: FechaISO; fin: FechaISO },
  b: { inicio: FechaISO; fin: FechaISO }
): boolean {
  return a.inicio <= b.fin && b.inicio <= a.fin
}

export type Resolucion = 'interrumpe' | 'convive' | 'duplicado'

export interface Cruce {
  periodo: PeriodoOcupado
  resolucion: Resolucion
  /** Primer día que dejaría de disfrutarse si se interrumpe. */
  fechaInterrupcion: FechaISO | null
  diasPendientes: number
  mensaje: string
}

export interface ResultadoSolapamiento {
  cruces: Cruce[]
  hayInterrupcion: boolean
  /** Frase única para la barra de avisos del formulario. */
  resumen: string | null
}

/**
 * Contrasta un periodo nuevo con los que ya ocupan esas fechas.
 *
 * Devuelve una resolución por cada cruce en vez de una sola conclusión: un
 * colaborador puede tener vacaciones y un permiso de media jornada en la misma
 * semana, y cada cruce se resuelve distinto.
 */
export function evaluarSolapamiento(params: {
  nuevo: {
    fechaInicio: FechaISO
    fechaFin: FechaISO
    motivo: string
    prioridad: number
    interrumpeOtros: boolean
  }
  ocupados: PeriodoOcupado[]
}): ResultadoSolapamiento {
  const { nuevo } = params

  const cruces = params.ocupados
    .filter((p) =>
      seSolapan(
        { inicio: nuevo.fechaInicio, fin: nuevo.fechaFin },
        { inicio: p.fechaInicio, fin: p.fechaFin }
      )
    )
    .map((periodo): Cruce => {
      // Solo interrumpe lo que empezó antes: si el periodo ocupado arranca el
      // mismo día o después, no hay nada disfrutado que suspender y lo que
      // procede es corregir una de las dos solicitudes.
      const puedeInterrumpir =
        nuevo.interrumpeOtros &&
        nuevo.prioridad > periodo.prioridad &&
        nuevo.fechaInicio > periodo.fechaInicio

      if (puedeInterrumpir) {
        const pendientes = diasNoDisfrutados({
          fechaInterrupcion: nuevo.fechaInicio,
          fechaFin: periodo.fechaFin,
          porCalendario: periodo.diasCalendario && !periodo.esVacaciones,
        })

        return {
          periodo,
          resolucion: 'interrumpe',
          fechaInterrupcion: nuevo.fechaInicio,
          diasPendientes: pendientes,
          mensaje: `${nuevo.motivo} empieza dentro de ${etiqueta(periodo)}. Talento Humano puede interrumpir ese periodo: quedarían ${pendientes} día${pendientes === 1 ? '' : 's'} por reprogramar.`,
        }
      }

      if (nuevo.prioridad === periodo.prioridad && nuevo.motivo === periodo.motivo) {
        return {
          periodo,
          resolucion: 'duplicado',
          fechaInterrupcion: null,
          diasPendientes: 0,
          mensaje: `Ya tienes ${etiqueta(periodo)} por el mismo motivo en esas fechas. Revisa si estás duplicando la solicitud.`,
        }
      }

      return {
        periodo,
        resolucion: 'convive',
        fechaInterrupcion: null,
        diasPendientes: 0,
        mensaje: `Estas fechas se cruzan con ${etiqueta(periodo)}. Se registra como antecedente y Talento Humano decidirá cómo se computa.`,
      }
    })

  const hayInterrupcion = cruces.some((c) => c.resolucion === 'interrumpe')

  return {
    cruces,
    hayInterrupcion,
    resumen:
      cruces.length === 0
        ? null
        : cruces.length === 1
          ? cruces[0].mensaje
          : `Estas fechas se cruzan con ${cruces.length} solicitudes tuyas. Revisa el detalle antes de enviar.`,
  }
}

function etiqueta(p: PeriodoOcupado): string {
  const nombre = p.esVacaciones ? 'un periodo de vacaciones' : `un permiso por ${p.motivo}`
  return p.consecutivo ? `${nombre} (${p.consecutivo})` : nombre
}

/**
 * Días que quedan sin disfrutar cuando se interrumpe un periodo.
 *
 * Se cuentan desde el día de la interrupción —ese ya no se disfruta— hasta el
 * final original, con el mismo criterio con que se contó el periodo: hábiles
 * para vacaciones, calendario para incapacidades y licencias.
 */
export function diasNoDisfrutados(params: {
  fechaInterrupcion: FechaISO
  fechaFin: FechaISO
  porCalendario?: boolean
}): number {
  if (params.fechaInterrupcion > params.fechaFin) return 0

  return params.porCalendario
    ? contarDiasCalendario(params.fechaInterrupcion, params.fechaFin)
    : contarDiasHabiles(params.fechaInterrupcion, params.fechaFin)
}
