/**
 * Qué impide enviar una solicitud, y por qué.
 *
 * Antes cada formulario cortaba en el primer fallo y pintaba una frase suelta
 * al pie: «Selecciona la categoría y el motivo del permiso». El colaborador
 * corregía eso, volvía a enviar y aparecía el siguiente, uno por uno. Y sobre
 * todo: el mensaje decía *qué* faltaba pero nunca *por qué* se exigía, así que
 * lo que faltaba en el formato impreso —el cargo, por ejemplo— parecía un
 * capricho del sistema.
 *
 * Aquí se devuelven **todos** los problemas a la vez, cada uno con su causa y
 * su motivo, y la pantalla los muestra juntos en un modal. Capa de dominio
 * pura: se puede probar sin levantar React.
 */

import {
  VACACIONES_ANTELACION_DIAS,
  VACACIONES_DIAS_MINIMOS,
  VACACIONES_DIAS_MINIMOS_CON_COMPENSADOS,
  type AntelacionVacaciones,
} from './reglas'

/**
 * `dd/MM/yyyy`, como lo lee la clínica.
 *
 * Se reimplementa aquí en vez de importar `formatearFecha` de `lib/utils`:
 * ese módulo arrastra clsx y tailwind-merge, y esta capa no debe depender de
 * nada de presentación para poder probarse sin levantar React.
 */
function enLetra(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export interface Problema {
  /** Dónde mirar. Coincide con la etiqueta del campo en el formulario. */
  campo: string
  /** Qué falta o qué está mal. */
  causa: string
  /** Por qué se exige. Es lo que evita que la regla parezca un capricho. */
  motivo: string
}

/**
 * Datos de identificación comunes a los tres trámites.
 *
 * Empresa, servicio y cargo van impresos en el encabezado del formato y no son
 * decorativos: el servicio decide a qué jefe le llega la solicitud y el cargo
 * es el corte con el que Talento Humano lee el ausentismo. Se validan los tres
 * juntos porque los tres se llenan desde el perfil y fallan por lo mismo —un
 * perfil incompleto—, aunque el que se detectó vacío fuera el cargo.
 */
export interface Identificacion {
  documento: string
  empresaId: string
  areaId: string
  cargoId: string
}

function validarIdentificacion(d: Identificacion): Problema[] {
  const problemas: Problema[] = []

  if (!d.documento.trim()) {
    problemas.push({
      campo: 'N.° de identificación',
      causa: 'No indicaste tu número de documento.',
      motivo:
        'El formato lo imprime junto a tu nombre y es el dato con el que Talento Humano te ubica en nómina.',
    })
  }

  if (!d.empresaId) {
    problemas.push({
      campo: 'Empresa',
      causa: 'No seleccionaste la empresa.',
      motivo: 'Es una casilla del encabezado del formato: CAC Santa Bárbara, GE2 o Geriater.',
    })
  }

  if (!d.areaId) {
    problemas.push({
      campo: 'Servicio actual',
      causa: 'No seleccionaste el servicio.',
      motivo:
        'De él depende a qué jefe directo le llega la solicitud. Sin servicio, no hay a quién enviarla.',
    })
  }

  if (!d.cargoId) {
    problemas.push({
      campo: 'Cargo',
      causa: 'No seleccionaste el cargo.',
      motivo:
        'Va impreso en el formato y es uno de los cortes del informe de ausentismo: sin él, la ausencia no se puede agrupar por cargo.',
    })
  }

  return problemas
}

// -----------------------------------------------------------------------------
// Permiso — TH-F-002
// -----------------------------------------------------------------------------

export interface DatosPermiso extends Identificacion {
  tipoId: string
  justificacion: string
  /** El motivo exige soporte al solicitar y todavía no se adjuntó ninguno. */
  faltaSoportePrevio: boolean
  /** `true` cuando el trámite no pasa por el jefe directo. */
  vaDirectoAGerencia: boolean
  tieneCoordinador: boolean
}

export function validarPermiso(d: DatosPermiso): Problema[] {
  const problemas = validarIdentificacion(d)

  if (!d.tipoId) {
    problemas.push({
      campo: 'Motivo del permiso',
      causa: 'No elegiste la categoría y el motivo.',
      motivo:
        'El motivo decide qué documentos se te van a pedir, cuántos días admite y quién lo autoriza. Sin él, la solicitud no se puede clasificar.',
    })
  }

  if (!d.justificacion.trim()) {
    problemas.push({
      campo: 'Justificación del permiso',
      causa: 'No describiste el motivo.',
      motivo:
        'Es el texto que lee tu jefe directo para autorizar. Una solicitud sin justificación suele volver preguntando lo mismo.',
    })
  }

  if (d.faltaSoportePrevio) {
    problemas.push({
      campo: 'Soporte',
      causa: 'Falta adjuntar el soporte.',
      motivo:
        'Este motivo exige el documento al momento de solicitar, no al regresar: sin él Talento Humano no puede dar el visto bueno.',
    })
  }

  if (!d.vaDirectoAGerencia && !d.tieneCoordinador) {
    problemas.push({
      campo: 'Jefe directo que autoriza',
      causa: 'No seleccionaste quién debe autorizar.',
      motivo:
        'Es a quien le llega la solicitud y quien recibe el aviso por correo. Si queda vacía, no entra en ninguna bandeja.',
    })
  }

  return problemas
}

// -----------------------------------------------------------------------------
// Vacaciones — TH-F-005
// -----------------------------------------------------------------------------

/** Tope de días que corresponden y combinación fija al compensar en dinero. */
export const VACACIONES_DIAS_CORRESPONDEN_MAXIMO = 15
export const VACACIONES_COMPENSAR_DIAS_A_DISFRUTAR = 8
export const VACACIONES_COMPENSAR_DIAS_COMPENSADOS = 7

export interface DatosVacaciones extends Identificacion {
  diasADisfrutar: number | null
  declaracionAceptada: boolean
  tieneCoordinador: boolean
  /** Resultado de `evaluarAntelacionVacaciones`. Ausente = no se comprueba. */
  antelacion?: AntelacionVacaciones | null
  /** Días que corresponden del periodo, sin importar si compensa o no. */
  diasCorresponden?: number | null
  /** Cuántos días pide compensados en dinero; 0 o null si no compensa. */
  diasCompensados?: number | null
  /** Ya adjuntó la carta firmada que justifica los compensados. */
  tieneCartaCompensados?: boolean
}

export function validarVacaciones(d: DatosVacaciones): Problema[] {
  const problemas = validarIdentificacion(d)

  const compensados = d.diasCompensados ?? 0
  const compensa = compensados > 0
  const minimo = compensa ? VACACIONES_DIAS_MINIMOS_CON_COMPENSADOS : VACACIONES_DIAS_MINIMOS

  if (d.diasADisfrutar === null || d.diasADisfrutar <= 0) {
    problemas.push({
      campo: 'Días a disfrutar',
      causa: 'No indicaste cuántos días vas a tomar.',
      motivo:
        'Con ese dato la aplicación calcula la fecha final en días hábiles y la de reintegro; sin él no hay periodo que autorizar.',
    })
  } else if (d.diasADisfrutar < minimo) {
    problemas.push({
      campo: 'Días a disfrutar',
      causa: `Pediste ${d.diasADisfrutar} día${d.diasADisfrutar === 1 ? '' : 's'} y el mínimo son ${minimo}.`,
      motivo: compensa
        ? `Cuando además se compensan días en dinero, el descanso efectivo no puede bajar de ${VACACIONES_DIAS_MINIMOS_CON_COMPENSADOS} días. Sube los días a disfrutar o quita los compensados.`
        : `Talento Humano no tramita periodos de menos de ${VACACIONES_DIAS_MINIMOS} días. Para ausencias más cortas, usa una solicitud de permiso.`,
    })
  }

  if (d.diasCorresponden != null && d.diasCorresponden > VACACIONES_DIAS_CORRESPONDEN_MAXIMO) {
    problemas.push({
      campo: 'Días que corresponden',
      causa: `Registraste ${d.diasCorresponden} días y el máximo por solicitud son ${VACACIONES_DIAS_CORRESPONDEN_MAXIMO}.`,
      motivo:
        'El formato TH-F-005 no tramita periodos acumulados de más de un año. Si tienes más días pendientes, radica el resto en otra solicitud.',
    })
  }

  // Regla dura de Talento Humano: compensar en dinero solo se admite sobre un
  // periodo completo de 15 días, repartido siempre igual -8 de descanso
  // efectivo y 7 pagados-. No es un mínimo como el resto de vacaciones: es la
  // única combinación que se acepta.
  if (compensa && (d.diasCorresponden !== 15 || d.diasADisfrutar !== 8 || compensados !== 7)) {
    problemas.push({
      campo: 'Días a compensar',
      causa: `Para compensar en dinero, Talento Humano exige exactamente 15 días que corresponden, 8 a disfrutar y 7 a compensar (registraste ${d.diasCorresponden ?? '—'} / ${d.diasADisfrutar ?? '—'} / ${compensados}).`,
      motivo:
        'Es la única combinación que admite el formato TH-F-005 al compensar en dinero: no se acepta un reparto distinto ni sobre un periodo parcial.',
    })
  }

  // La antelación en vacaciones **bloquea**, a diferencia de la de permisos.
  // El mensaje da la fecha exacta hasta la que se pudo radicar y la primera
  // que sí sirve hoy: sin las dos, la persona no sabe qué corregir.
  if (d.antelacion && !d.antelacion.cumple) {
    problemas.push({
      campo: 'Fecha de inicio',
      causa:
        d.antelacion.diasDeAntelacion < 0
          ? 'La fecha de inicio ya pasó.'
          : `Faltan ${d.antelacion.diasDeAntelacion} días para el inicio y el formato exige ${VACACIONES_ANTELACION_DIAS} días corridos.`,
      motivo: `Para empezar ese día tenías que radicarla a más tardar el ${enLetra(d.antelacion.fechaLimite)}. Radicando hoy, la primera fecha de inicio posible es el ${enLetra(d.antelacion.primeraValida)}.`,
    })
  }

  if (compensa && !d.tieneCartaCompensados) {
    problemas.push({
      campo: 'Carta de días compensados',
      causa: 'No adjuntaste la carta que justifica los días compensados.',
      motivo:
        'Compensar días en dinero exige la solicitud escrita y firmada por el colaborador. Sin ella, Talento Humano no puede tramitarlo ante nómina.',
    })
  }

  if (!d.declaracionAceptada) {
    problemas.push({
      campo: 'Declaración de conformidad',
      causa: 'No aceptaste la declaración.',
      motivo:
        'El formato TH-F-005 la incluye firmada por el colaborador: es la constancia de que las vacaciones se solicitan y se gozan conforme al Código Sustantivo del Trabajo.',
    })
  }

  if (!d.tieneCoordinador) {
    problemas.push({
      campo: 'Jefe directo que autoriza',
      causa: 'No seleccionaste quién debe autorizar.',
      motivo:
        'Es a quien le llega la solicitud y quien recibe el aviso por correo. Si queda vacía, no entra en ninguna bandeja.',
    })
  }

  return problemas
}

// -----------------------------------------------------------------------------
// Incapacidad — TH-F-002
// -----------------------------------------------------------------------------

export interface DatosIncapacidad extends Identificacion {
  tipoId: string
  /** `true` cuando el motivo no tiene duración legal fija y hay que pedirla. */
  numeroDiasRequerido: boolean
  numeroDias: number
  tieneDxPrincipal: boolean
  /** Falta algún documento obligatorio de la matriz, sea «al solicitar» o «al volver». */
  faltanSoportesObligatorios: boolean
}

export function validarIncapacidad(d: DatosIncapacidad): Problema[] {
  const problemas = validarIdentificacion(d)

  if (!d.tipoId) {
    problemas.push({
      campo: 'Origen de la incapacidad',
      causa: 'No elegiste el origen.',
      motivo:
        'Separa la de enfermedad general de las de accidente de trabajo, que van a indicadores distintos y las paga la ARL, no la EPS.',
    })
  }

  if (d.numeroDiasRequerido && d.numeroDias <= 0) {
    problemas.push({
      campo: 'Número de días',
      causa: 'No indicaste cuántos días cubre la incapacidad.',
      motivo: 'Con ese dato la aplicación calcula la fecha final en días corridos.',
    })
  }

  if (!d.tieneDxPrincipal) {
    problemas.push({
      campo: 'Diagnóstico CIE10 principal',
      causa: 'No seleccionaste el diagnóstico principal.',
      motivo: 'Toda incapacidad se registra con su código CIE10, como lo exigen los RIPS.',
    })
  }

  if (d.faltanSoportesObligatorios) {
    problemas.push({
      campo: 'Soporte',
      causa: 'Falta adjuntar uno o más documentos obligatorios.',
      motivo:
        'El certificado de incapacidad -y, de más de 2 días, la historia clínica o el radicado ante la EPS/ARL- son obligatorios para poder registrarla: sin ellos, Talento Humano no puede darla por recibida.',
    })
  }

  return problemas
}

// -----------------------------------------------------------------------------
// Retiro parcial de cesantías
// -----------------------------------------------------------------------------

export interface DatosCesantias extends Identificacion {
  destino: string
  tieneSoporte: boolean
}

export function validarCesantias(d: DatosCesantias): Problema[] {
  const problemas = validarIdentificacion(d)

  if (!d.destino) {
    problemas.push({
      campo: 'Destinación del retiro',
      causa: 'No indicaste a qué vas a destinar el retiro.',
      motivo:
        'El art. 102 del CST y la Ley 1071 de 2006 solo admiten vivienda y educación. La Gerencia tiene que verificarlo antes de tramitarlo ante la administradora.',
    })
  }

  if (!d.tieneSoporte) {
    problemas.push({
      campo: 'Soporte',
      causa: 'No adjuntaste el soporte de la destinación.',
      motivo:
        'Es el documento con el que se acredita que el retiro va a vivienda o educación. Sin él la administradora no desembolsa.',
    })
  }

  return problemas
}

// -----------------------------------------------------------------------------
// Fallos al guardar
// -----------------------------------------------------------------------------

/**
 * Convierte un error de Supabase en algo accionable.
 *
 * El mensaje crudo de PostgREST —«new row violates row-level security policy»—
 * no le dice nada a quien solicita, y era lo que aparecía al pie del formulario.
 */
export function problemaAlGuardar(e: unknown): Problema {
  const { code, message } = (e ?? {}) as { code?: string; message?: string }

  if (code === '42501' || message?.toLowerCase().includes('row-level security')) {
    return {
      campo: 'Permisos de tu cuenta',
      causa: 'Tu cuenta no tiene permiso para crear esta solicitud.',
      motivo:
        'Suele pasar cuando el perfil todavía está pendiente de validación por Talento Humano. Escríbeles para que lo activen.',
    }
  }

  if (code === '23505' || message?.includes('duplicate key')) {
    return {
      campo: 'Solicitud duplicada',
      causa: 'Ya existe una solicitud con estos datos.',
      motivo: 'Revisa en «Mis solicitudes» si la enviaste dos veces.',
    }
  }

  return {
    campo: 'Guardado',
    causa: message?.trim() || 'No fue posible guardar la solicitud.',
    motivo:
      'Puede ser un corte de conexión. Vuelve a intentarlo; si sigue fallando, avisa a Talento Humano con la hora exacta.',
  }
}
