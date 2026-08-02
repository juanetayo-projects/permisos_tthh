/**
 * Máquina de estados del flujo BPM, compartida por los dos trámites.
 *
 * Centralizar aquí las transiciones evita que cada pantalla invente su propia
 * lógica de "qué puedo hacer con esta solicitud".
 */

export const ESTADOS = [
  'BORRADOR',
  'PENDIENTE_COORDINADOR',
  'APROBADA_COORDINADOR',
  'PENDIENTE_TH',
  'PENDIENTE_GERENCIA_TH',
  'APROBADA_TH',
  'PENDIENTE_SOPORTE',
  'SOPORTE_EN_VALIDACION',
  'SUSPENDIDA',
  'FINALIZADA',
  'ARCHIVADA',
  'RECHAZADA_COORDINADOR',
  'RECHAZADA_TH',
  'CANCELADA',
  'VENCIDA',
] as const

export type Estado = (typeof ESTADOS)[number]

export const ROLES = [
  'colaborador',
  'coordinador',
  'analista_th',
  'gerente_th',
  'administrador',
] as const

export type Rol = (typeof ROLES)[number]

export const ETIQUETA_ROL: Record<Rol, string> = {
  colaborador: 'Colaborador',
  coordinador: 'Coordinador (jefe directo)',
  analista_th: 'Analista de Talento Humano',
  gerente_th: 'Gerente de Talento Humano',
  administrador: 'Administrador',
}

export type Accion =
  | 'enviar'
  | 'aprobar_coordinador'
  | 'rechazar_coordinador'
  | 'aprobar_th'
  | 'rechazar_th'
  | 'registrar_soporte'
  | 'validar_soporte'
  | 'devolver_soporte'
  | 'interrumpir'
  | 'archivar'
  | 'cancelar'
  | 'vencer'

interface Transicion {
  desde: Estado[]
  hacia: Estado
  roles: Rol[]
  exigeMotivo?: boolean
  etiqueta: string
}

export const TRANSICIONES: Record<Accion, Transicion> = {
  enviar: {
    desde: ['BORRADOR'],
    hacia: 'PENDIENTE_COORDINADOR',
    roles: ['colaborador', 'coordinador', 'analista_th', 'gerente_th', 'administrador'],
    etiqueta: 'Enviar solicitud',
  },
  aprobar_coordinador: {
    desde: ['PENDIENTE_COORDINADOR'],
    hacia: 'PENDIENTE_TH',
    roles: ['coordinador', 'administrador'],
    etiqueta: 'Autorizar',
  },
  rechazar_coordinador: {
    desde: ['PENDIENTE_COORDINADOR'],
    hacia: 'RECHAZADA_COORDINADOR',
    roles: ['coordinador', 'administrador'],
    exigeMotivo: true,
    etiqueta: 'Rechazar',
  },
  // El administrador acompaña a Talento Humano en sus tres acciones. No es un
  // permiso de conveniencia: sin él, una solicitud se quedaba bloqueada en
  // PENDIENTE_TH cuando no había ningún analista o gerente disponible, y quien
  // administra ya puede repartir los roles de todos modos.
  aprobar_th: {
    desde: ['PENDIENTE_TH', 'PENDIENTE_GERENCIA_TH'],
    hacia: 'APROBADA_TH',
    roles: ['analista_th', 'gerente_th', 'administrador'],
    etiqueta: 'Dar visto bueno',
  },
  rechazar_th: {
    desde: ['PENDIENTE_TH', 'PENDIENTE_GERENCIA_TH'],
    hacia: 'RECHAZADA_TH',
    roles: ['analista_th', 'gerente_th', 'administrador'],
    exigeMotivo: true,
    etiqueta: 'Rechazar',
  },
  // Entregar el soporte saca la solicitud de la bandeja del colaborador y la
  // pone en la de Talento Humano. Antes se quedaba en PENDIENTE_SOPORTE con un
  // booleano al lado, y nadie sabía a quién le tocaba mover.
  registrar_soporte: {
    desde: ['PENDIENTE_SOPORTE'],
    hacia: 'SOPORTE_EN_VALIDACION',
    roles: ['colaborador', 'coordinador', 'analista_th', 'gerente_th', 'administrador'],
    etiqueta: 'Entregar soporte',
  },
  validar_soporte: {
    desde: ['SOPORTE_EN_VALIDACION'],
    hacia: 'FINALIZADA',
    roles: ['analista_th', 'gerente_th', 'administrador'],
    etiqueta: 'Validar soporte',
  },
  // El camino de vuelta: si el documento no sirve, el colaborador sube otro.
  devolver_soporte: {
    desde: ['SOPORTE_EN_VALIDACION'],
    hacia: 'PENDIENTE_SOPORTE',
    roles: ['analista_th', 'gerente_th', 'administrador'],
    exigeMotivo: true,
    etiqueta: 'Devolver soporte',
  },
  // Art. 187 CST: una incapacidad que cae dentro de unas vacaciones las
  // suspende, y los días no disfrutados quedan pendientes de reprogramar. Solo
  // sobre periodos ya autorizados: interrumpir algo que aún no se disfruta no
  // es interrumpir, es rechazar.
  interrumpir: {
    desde: ['APROBADA_TH', 'PENDIENTE_SOPORTE', 'FINALIZADA'],
    hacia: 'SUSPENDIDA',
    roles: ['coordinador', 'analista_th', 'gerente_th', 'administrador'],
    exigeMotivo: true,
    etiqueta: 'Interrumpir el periodo',
  },
  archivar: {
    desde: [
      'FINALIZADA',
      'SUSPENDIDA',
      'RECHAZADA_COORDINADOR',
      'RECHAZADA_TH',
      'CANCELADA',
      'VENCIDA',
    ],
    // Nota: SOPORTE_EN_VALIDACION no se archiva; primero se valida o se devuelve.
    hacia: 'ARCHIVADA',
    roles: ['analista_th', 'gerente_th', 'administrador'],
    etiqueta: 'Archivar',
  },
  cancelar: {
    desde: ['BORRADOR', 'PENDIENTE_COORDINADOR', 'APROBADA_COORDINADOR', 'PENDIENTE_TH', 'PENDIENTE_GERENCIA_TH'],
    hacia: 'CANCELADA',
    roles: ['colaborador', 'coordinador', 'analista_th', 'gerente_th', 'administrador'],
    exigeMotivo: true,
    etiqueta: 'Cancelar',
  },
  vencer: {
    desde: ['PENDIENTE_COORDINADOR', 'PENDIENTE_TH', 'PENDIENTE_GERENCIA_TH'],
    hacia: 'VENCIDA',
    roles: ['administrador'],
    etiqueta: 'Marcar como vencida',
  },
}

/** Estado inicial al enviar: las cesantías saltan al coordinador (Paso 4). */
export function estadoAlEnviar(rutaAprobacion: 'coordinador_th' | 'gerente_th_directo'): Estado {
  return rutaAprobacion === 'gerente_th_directo' ? 'PENDIENTE_GERENCIA_TH' : 'PENDIENTE_COORDINADOR'
}

/** Tras el visto bueno de TH: a soporte pendiente o directo a finalizada. */
export function estadoTrasVistoBueno(requiereSoportePosterior: boolean): Estado {
  return requiereSoportePosterior ? 'PENDIENTE_SOPORTE' : 'FINALIZADA'
}

export interface ContextoAccion {
  estado: Estado
  rol: Rol
  esSolicitante: boolean
  coordinaElArea: boolean
}

/** ¿Puede este usuario ejecutar esta acción sobre esta solicitud? */
export function puedeEjecutar(accion: Accion, ctx: ContextoAccion): boolean {
  const t = TRANSICIONES[accion]
  if (!t.desde.includes(ctx.estado)) return false

  switch (accion) {
    case 'enviar':
    case 'cancelar':
      return ctx.esSolicitante
    case 'registrar_soporte':
      // Quien sube el archivo es siempre el solicitante: así lo exige la
      // policy de Storage, que ata la ruta a `solicitante_id`.
      return ctx.esSolicitante
    case 'aprobar_coordinador':
    case 'rechazar_coordinador':
      return ctx.coordinaElArea || ctx.rol === 'administrador'
    case 'interrumpir':
      // El jefe directo también puede: es quien se entera primero de que un
      // colaborador de vacaciones acaba de recibir una incapacidad.
      return ctx.coordinaElArea || t.roles.includes(ctx.rol)
    default:
      return t.roles.includes(ctx.rol)
  }
}

/** Acciones disponibles, para pintar los botones sin duplicar reglas en la UI. */
export function accionesDisponibles(ctx: ContextoAccion): Accion[] {
  return (Object.keys(TRANSICIONES) as Accion[]).filter(
    (a) => a !== 'vencer' && puedeEjecutar(a, ctx)
  )
}

// -----------------------------------------------------------------------------
// Presentación
// -----------------------------------------------------------------------------

export type TonoEstado = 'exito' | 'advertencia' | 'error' | 'info' | 'neutro'

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_COORDINADOR: 'Pendiente del jefe directo',
  APROBADA_COORDINADOR: 'Autorizada por el jefe directo',
  PENDIENTE_TH: 'Pendiente de Talento Humano',
  PENDIENTE_GERENCIA_TH: 'Pendiente de Gerencia de TH',
  APROBADA_TH: 'Aprobada',
  PENDIENTE_SOPORTE: 'Autorizada, pendiente de justificar el soporte',
  SOPORTE_EN_VALIDACION: 'Soporte en validación de Talento Humano',
  SUSPENDIDA: 'Interrumpida, con días por reprogramar',
  FINALIZADA: 'Cerrada',
  ARCHIVADA: 'Archivada',
  RECHAZADA_COORDINADOR: 'Rechazada por el jefe directo',
  RECHAZADA_TH: 'Rechazada por Talento Humano',
  CANCELADA: 'Cancelada',
  VENCIDA: 'Vencida',
}

export const TONO_ESTADO: Record<Estado, TonoEstado> = {
  BORRADOR: 'neutro',
  PENDIENTE_COORDINADOR: 'advertencia',
  APROBADA_COORDINADOR: 'info',
  PENDIENTE_TH: 'advertencia',
  PENDIENTE_GERENCIA_TH: 'advertencia',
  APROBADA_TH: 'exito',
  PENDIENTE_SOPORTE: 'advertencia',
  SOPORTE_EN_VALIDACION: 'info',
  SUSPENDIDA: 'advertencia',
  FINALIZADA: 'exito',
  ARCHIVADA: 'neutro',
  RECHAZADA_COORDINADOR: 'error',
  RECHAZADA_TH: 'error',
  CANCELADA: 'neutro',
  VENCIDA: 'error',
}

/**
 * ¿El texto que acompaña a esta decisión es una causa de rechazo?
 *
 * El diálogo pide texto tanto al rechazar como al autorizar, pero significan
 * cosas opuestas: la causa del rechazo se le muestra al solicitante en rojo y
 * viaja en el correo; la observación de quien autoriza solo queda en el
 * historial. Confundirlas hacía que una solicitud autorizada apareciera como
 * rechazada, así que la distinción vive aquí y no en cada pantalla.
 */
export function esDecisionNegativa(estado: Estado): boolean {
  return estado.startsWith('RECHAZADA') || estado === 'CANCELADA'
}

/**
 * ¿La solicitud está esperando soporte porque se lo devolvieron?
 *
 * Dar el visto bueno con una nota y devolver un soporte dejan la solicitud en
 * el mismo estado y con texto en la misma columna, así que la pantalla los
 * pintaba igual: una autorización normal aparecía como «Talento Humano
 * devolvió el soporte», que es lo contrario de lo que pasó. Lo único que los
 * distingue es de dónde viene el último paso.
 */
export function esSoporteDevuelto(
  ultimoPaso: { estado_anterior: string | null; estado_nuevo: string } | undefined
): boolean {
  return (
    ultimoPaso?.estado_nuevo === 'PENDIENTE_SOPORTE' &&
    ultimoPaso?.estado_anterior === 'SOPORTE_EN_VALIDACION'
  )
}

/** Estados que ocupan una bandeja: lo que está esperando una decisión. */
export const ESTADOS_BANDEJA: Record<'coordinador' | 'th' | 'gerencia', Estado[]> = {
  coordinador: ['PENDIENTE_COORDINADOR'],
  // `PENDIENTE_SOPORTE` queda fuera a propósito: ahí la pelota la tiene el
  // colaborador, y una bandeja llena de cosas que no puedes mover no es una
  // bandeja de trabajo.
  th: ['PENDIENTE_TH', 'SOPORTE_EN_VALIDACION'],
  gerencia: ['PENDIENTE_GERENCIA_TH'],
}
