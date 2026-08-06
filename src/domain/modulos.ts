/**
 * Los módulos de la aplicación y quién entra a cada uno.
 *
 * El **catálogo** vive aquí porque un módulo es una pantalla: aparece y
 * desaparece con el código, no con una configuración. El **reparto** —qué rol
 * entra a cuál— vive en la tabla `permisos_acceso_rol`, porque eso sí cambia
 * con la organización, y hasta ahora obligaba a desplegar para mover una
 * casilla.
 *
 * ## Qué gobierna esto y qué no
 *
 * Gobierna la **navegación**: qué enlaces salen en el menú y a qué rutas se
 * puede entrar. **No** gobierna el alcance de los datos, que sigue siendo cosa
 * de las policies de la base de datos. Marcarle a un colaborador la casilla de
 * «Todas las solicitudes» le da la pantalla, y la pantalla le seguirá
 * mostrando solo las suyas. Al revés también: quitarle la casilla a alguien le
 * esconde la pantalla, no le retira el permiso de lectura.
 *
 * Es una distinción que conviene tener clara antes de repartir casillas: esta
 * pantalla ordena la aplicación, no la asegura.
 */

import { ROLES, type Rol } from './estados'

export const MODULOS = [
  'inicio',
  'solicitar_permiso',
  'solicitar_vacaciones',
  'solicitar_cesantias',
  'incapacidades',
  'mis_solicitudes',
  'bandeja_area',
  'bandeja_th',
  'bandeja_cesantias',
  'todas_solicitudes',
  'validaciones',
  'dashboard',
  'ausentismo',
  'administracion',
] as const

export type Modulo = (typeof MODULOS)[number]

export interface DefinicionModulo {
  codigo: Modulo
  ruta: string
  etiqueta: string
  /** Se le muestra a quien reparte las casillas. */
  descripcion: string
}

export const DEFINICION_MODULOS: DefinicionModulo[] = [
  {
    codigo: 'inicio',
    ruta: '/',
    etiqueta: 'Inicio',
    descripcion: 'Portada con el resumen y el flujo del proceso.',
  },
  {
    codigo: 'solicitar_permiso',
    ruta: '/solicitar/permiso',
    etiqueta: 'Solicitar permiso',
    descripcion: 'Formato TH-F-002.',
  },
  {
    codigo: 'solicitar_vacaciones',
    ruta: '/solicitar/vacaciones',
    etiqueta: 'Solicitar vacaciones',
    descripcion: 'Formato TH-F-005.',
  },
  {
    codigo: 'solicitar_cesantias',
    ruta: '/solicitar/cesantias',
    etiqueta: 'Retiro de cesantías',
    descripcion: 'Trámite propio: va directo a la Dirección de Talento Humano.',
  },
  {
    codigo: 'incapacidades',
    ruta: '/incapacidades',
    etiqueta: 'Incapacidades',
    descripcion:
      'El jefe directo reporta la incapacidad de alguien de su servicio. Entra directa a Talento Humano y el colaborador carga la certificación después.',
  },
  {
    codigo: 'mis_solicitudes',
    ruta: '/mis-solicitudes',
    etiqueta: 'Mis solicitudes',
    descripcion: 'Seguimiento de lo que ha pedido la propia persona.',
  },
  {
    codigo: 'bandeja_area',
    ruta: '/bandeja/coordinador',
    etiqueta: 'Bandeja del área',
    descripcion:
      'Solicitudes del servicio en cualquier estado. Cada quien ve lo que le corresponde: lo propio, lo de su área o todo.',
  },
  {
    codigo: 'bandeja_th',
    ruta: '/bandeja/th',
    etiqueta: 'Bandeja de Talento Humano',
    descripcion: 'Lo que espera el visto bueno de TH y los soportes por validar.',
  },
  {
    codigo: 'bandeja_cesantias',
    ruta: '/bandeja/gerencia',
    etiqueta: 'Cesantías',
    descripcion: 'Retiros de cesantías que autoriza la Dirección de Talento Humano.',
  },
  {
    codigo: 'todas_solicitudes',
    ruta: '/solicitudes',
    etiqueta: 'Todas las solicitudes',
    descripcion: 'Histórico completo, incluido lo ya decidido.',
  },
  {
    codigo: 'validaciones',
    ruta: '/validaciones',
    etiqueta: 'Validar colaboradores',
    descripcion: 'Confirmar servicio y jefe directo de quien se registra.',
  },
  {
    codigo: 'dashboard',
    ruta: '/dashboard',
    etiqueta: 'Dashboard',
    descripcion: 'Indicadores del flujo de solicitudes.',
  },
  {
    codigo: 'ausentismo',
    ruta: '/ausentismo',
    etiqueta: 'Ausentismo',
    descripcion: 'Tiempo no laborado e índices por área.',
  },
  {
    codigo: 'administracion',
    ruta: '/administracion',
    etiqueta: 'Administración',
    descripcion: 'Catálogos, usuarios, parámetros y esta misma pantalla.',
  },
]

/**
 * Lo que no se puede desmarcar.
 *
 * Sin esto, quitarle Administración al administrador dejaría la aplicación sin
 * ninguna forma de volver a entrar a repartir casillas: habría que reparar la
 * tabla por SQL. La base de datos lo impide con un trigger; aquí se repite
 * para poder deshabilitar la casilla en vez de dejar que falle al guardar.
 */
export function esAccesoFijo(rol: Rol, modulo: Modulo): boolean {
  return rol === 'administrador' && modulo === 'administracion'
}

export type MatrizAccesos = Record<Rol, Modulo[]>

const TODOS: Modulo[] = [
  'inicio',
  'solicitar_permiso',
  'solicitar_vacaciones',
  'solicitar_cesantias',
  'mis_solicitudes',
  'bandeja_area',
  'dashboard',
]

/**
 * El reparto con el que arranca la instalación, y el que se usa mientras la
 * consulta a la tabla está en vuelo o si falla.
 *
 * Es el que fijó Talento Humano. Que exista aquí además de en la base de datos
 * no es duplicación ociosa: sin un valor por defecto, un fallo de red dejaría
 * el menú vacío y a la persona sin manera de llegar a ningún sitio.
 */
export const ACCESOS_POR_DEFECTO: MatrizAccesos = {
  colaborador: [...TODOS],
  // Reportar incapacidades es suyo: es quien se entera de la ausencia el mismo
  // día. El colaborador no lo lleva porque su propia incapacidad la reporta su
  // jefe, no él.
  coordinador: [...TODOS, 'incapacidades'],
  coordinador_sst: [...TODOS, 'todas_solicitudes', 'ausentismo'],
  analista_th: [
    ...TODOS,
    'incapacidades',
    'bandeja_th',
    'todas_solicitudes',
    'validaciones',
    'ausentismo',
    'administracion',
  ],
  gerente_th: [...TODOS, 'bandeja_cesantias', 'todas_solicitudes'],
  administrador: [
    ...TODOS,
    'incapacidades',
    'bandeja_th',
    'bandeja_cesantias',
    'todas_solicitudes',
    'validaciones',
    'ausentismo',
    'administracion',
  ],
}

/** Filas para sembrar la tabla: la matriz de arriba, aplanada. */
export function filasPorDefecto(): { rol: Rol; modulo: Modulo }[] {
  return ROLES.flatMap((rol) => ACCESOS_POR_DEFECTO[rol].map((modulo) => ({ rol, modulo })))
}
