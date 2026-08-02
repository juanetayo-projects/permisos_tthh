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

export interface DatosVacaciones extends Identificacion {
  diasADisfrutar: number | null
  declaracionAceptada: boolean
  tieneCoordinador: boolean
}

export function validarVacaciones(d: DatosVacaciones): Problema[] {
  const problemas = validarIdentificacion(d)

  if (d.diasADisfrutar === null || d.diasADisfrutar <= 0) {
    problemas.push({
      campo: 'Días a disfrutar',
      causa: 'No indicaste cuántos días vas a tomar.',
      motivo:
        'Con ese dato la aplicación calcula la fecha final en días hábiles y la de reintegro; sin él no hay periodo que autorizar.',
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
