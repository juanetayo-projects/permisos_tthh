import { useState } from 'react'
import {
  BriefcaseBusiness,
  Building2,
  FileCog,
  FileStack,
  FileText,
  ListTree,
  Network,
  ScrollText,
  SlidersHorizontal,
  Tags,
  UserCog,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EditorCatalogo, type CampoCatalogo } from '@/presentation/components/admin/EditorCatalogo'
import { PanelUsuarios } from '@/presentation/components/admin/PanelUsuarios'
import { PanelParametros } from '@/presentation/components/admin/PanelParametros'
import { PanelAuditoria } from '@/presentation/components/admin/PanelAuditoria'
import { useCatalogo } from '@/application/admin/useCatalogoCrud'

const CAMPOS_EMPRESA: CampoCatalogo[] = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  { clave: 'orden', etiqueta: 'Orden', tipo: 'numero', ancho: 'w-24' },
  { clave: 'activo', etiqueta: 'Activa', tipo: 'booleano', ancho: 'w-24' },
]

/**
 * Áreas y cargos comparten forma —solo nombre y estado— porque las tablas
 * vienen de Cambio de Turnos y no tienen columna de orden: se listan por
 * nombre, que es como se buscan en un desplegable largo.
 */
const CAMPOS_AREA: CampoCatalogo[] = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  { clave: 'activo', etiqueta: 'Activa', tipo: 'booleano', ancho: 'w-24' },
]

const CAMPOS_CARGO: CampoCatalogo[] = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano', ancho: 'w-24' },
]

const CAMPOS_CATEGORIA: CampoCatalogo[] = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  {
    clave: 'casilla_formato',
    etiqueta: 'Casilla del formato',
    tipo: 'texto',
    ayuda: 'Nombre exacto de la casilla en el TH-F-002, para que el PDF marque la correcta.',
  },
  { clave: 'orden', etiqueta: 'Orden', tipo: 'numero', ancho: 'w-24' },
  { clave: 'activo', etiqueta: 'Activa', tipo: 'booleano', ancho: 'w-24' },
]

const CAMPOS_TRAMITE: CampoCatalogo[] = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  { clave: 'codigo_formato', etiqueta: 'Código', tipo: 'texto', requerido: true, ancho: 'w-32' },
  { clave: 'version_formato', etiqueta: 'Versión', tipo: 'texto', ancho: 'w-24' },
  { clave: 'vigencia_formato', etiqueta: 'Vigencia', tipo: 'texto', ancho: 'w-32' },
  {
    clave: 'antelacion_minima',
    etiqueta: 'Antelación mínima',
    tipo: 'numero',
    ancho: 'w-32',
    ayuda: 'Solo advierte, nunca bloquea el envío.',
  },
  {
    clave: 'unidad_antelacion',
    etiqueta: 'Unidad',
    tipo: 'seleccion',
    ancho: 'w-28',
    opciones: [
      { valor: 'horas', etiqueta: 'Horas' },
      { valor: 'dias', etiqueta: 'Días' },
    ],
  },
  { clave: 'nota_pie', etiqueta: 'Nota al pie del formato', tipo: 'texto', soloEnFormulario: true },
  { clave: 'proceso', etiqueta: 'Proceso', tipo: 'texto', soloEnFormulario: true },
  { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano', ancho: 'w-24' },
]

type Seccion =
  | 'usuarios'
  | 'coordinadores'
  | 'areas'
  | 'cargos'
  | 'tramites'
  | 'categorias'
  | 'tipos'
  | 'documentos'
  | 'matriz'
  | 'empresas'
  | 'parametros'
  | 'auditoria'

const SECCIONES: { clave: Seccion; etiqueta: string; icono: typeof Users }[] = [
  { clave: 'usuarios', etiqueta: 'Usuarios y roles', icono: Users },
  { clave: 'coordinadores', etiqueta: 'Jefes directos', icono: UserCog },
  { clave: 'areas', etiqueta: 'Procesos y áreas', icono: Network },
  { clave: 'cargos', etiqueta: 'Cargos', icono: BriefcaseBusiness },
  { clave: 'tramites', etiqueta: 'Trámites y formatos', icono: FileCog },
  { clave: 'categorias', etiqueta: 'Categorías', icono: Tags },
  { clave: 'tipos', etiqueta: 'Motivos de permiso', icono: ListTree },
  { clave: 'documentos', etiqueta: 'Documentos', icono: FileText },
  { clave: 'matriz', etiqueta: 'Documentos exigidos', icono: FileStack },
  { clave: 'empresas', etiqueta: 'Empresas', icono: Building2 },
  { clave: 'parametros', etiqueta: 'Parámetros', icono: SlidersHorizontal },
  { clave: 'auditoria', etiqueta: 'Auditoría', icono: ScrollText },
]

/** Lo que cambie aquí también lo ve Cambio de Turnos: comparten las tablas. */
const AVISO_COMPARTIDO =
  'Este catálogo lo comparten Permisos y Cambio de Turnos: lo que cambies aquí afecta a las dos aplicaciones.'

export default function Administracion() {
  const [seccion, setSeccion] = useState<Seccion>('usuarios')

  // Los motivos necesitan la lista de categorías para su desplegable.
  const { data: categorias } = useCatalogo<{ id: number; nombre: string; activo: boolean }>(
    'permisos_categorias'
  )
  // Los jefes directos se asocian a un servicio, así que hace falta el catálogo.
  const { data: areasAdmin } = useCatalogo<{ id: number; nombre: string; activo: boolean }>(
    'areas',
    'nombre'
  )
  // La matriz de documentos referencia motivos y documentos por identificador.
  const { data: tiposAdmin } = useCatalogo<{ id: number; nombre: string; activo: boolean }>(
    'permisos_tipos'
  )
  const { data: documentosAdmin } = useCatalogo<{ id: number; nombre: string; activo: boolean }>(
    'permisos_documentos'
  )

  const camposCoordinador: CampoCatalogo[] = [
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    {
      clave: 'cargo',
      etiqueta: 'Cargo',
      tipo: 'texto',
      requerido: true,
      ayuda: 'Distingue a quien coordina varios servicios: aparece junto al nombre en el desplegable.',
    },
    { clave: 'correo', etiqueta: 'Correo', tipo: 'texto', requerido: true },
    {
      clave: 'area_id',
      etiqueta: 'Servicio',
      tipo: 'seleccion',
      requerido: true,
      opciones: (areasAdmin ?? []).map((a) => ({ valor: String(a.id), etiqueta: a.nombre })),
      ayuda: 'Una fila por servicio. Quien cubra tres servicios necesita tres filas.',
    },
    { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano', ancho: 'w-24' },
  ]

  const camposTipo: CampoCatalogo[] = [
    { clave: 'nombre', etiqueta: 'Motivo', tipo: 'texto', requerido: true },
    {
      clave: 'categoria_id',
      etiqueta: 'Categoría',
      tipo: 'seleccion',
      requerido: true,
      opciones: (categorias ?? []).map((c) => ({ valor: String(c.id), etiqueta: c.nombre })),
    },
    {
      clave: 'naturaleza',
      etiqueta: 'Naturaleza',
      tipo: 'seleccion',
      ancho: 'w-32',
      opciones: [
        { valor: 'permiso', etiqueta: 'Permiso del empleador' },
        { valor: 'licencia', etiqueta: 'Licencia de ley' },
        { valor: 'incapacidad', etiqueta: 'Incapacidad' },
        { valor: 'tramite', etiqueta: 'Trámite (sin ausencia)' },
      ],
      ayuda:
        'Un trámite no genera ausencia: el retiro parcial de cesantías se firma en este formato pero no es una falta al trabajo.',
    },
    {
      clave: 'ruta_aprobacion',
      etiqueta: 'Ruta de aprobación',
      tipo: 'seleccion',
      opciones: [
        { valor: 'coordinador_th', etiqueta: 'Jefe directo → Talento Humano' },
        { valor: 'gerente_th_directo', etiqueta: 'Directo a Gerencia de TH' },
      ],
      ayuda: 'Las cesantías van directo a la Gerencia, sin pasar por el jefe directo.',
    },
    { clave: 'remunerado_por_defecto', etiqueta: 'Remunerado', tipo: 'booleano', ancho: 'w-28' },
    {
      clave: 'fundamento_legal',
      etiqueta: 'Fundamento legal',
      tipo: 'texto',
      soloEnFormulario: true,
      ayuda: 'La norma que respalda el motivo. Se le muestra al colaborador al solicitar.',
    },
    {
      clave: 'genera_ausentismo',
      etiqueta: 'Cuenta como ausentismo',
      tipo: 'booleano',
      soloEnFormulario: true,
      ayuda:
        'No para trámites, comisiones sindicales y capacitaciones: ahí el colaborador cumple una función, no falta.',
    },
    {
      clave: 'requiere_soporte_previo',
      etiqueta: 'Soporte al solicitar',
      tipo: 'booleano',
      soloEnFormulario: true,
      ayuda: 'Se recalcula solo a partir de los documentos configurados en «Documentos exigidos».',
    },
    {
      clave: 'requiere_soporte_posterior',
      etiqueta: 'Soporte al regresar',
      tipo: 'booleano',
      soloEnFormulario: true,
      ayuda: 'También se recalcula solo desde la matriz de documentos.',
    },
    {
      clave: 'soporte_obligatorio_desde_dias',
      etiqueta: 'Soporte obligatorio desde (días)',
      tipo: 'numero',
      soloEnFormulario: true,
      ayuda: 'Por ejemplo, la cita médica lo exige a partir de 2 días.',
    },
    {
      clave: 'plazo_soporte_dias',
      etiqueta: 'Plazo del soporte (días)',
      tipo: 'numero',
      soloEnFormulario: true,
      ayuda:
        'Vacío usa el parámetro global. La incapacidad tiene 3 días hábiles; el certificado electoral, un mes.',
    },
    {
      clave: 'plazo_soporte_habiles',
      etiqueta: 'Plazo en días hábiles',
      tipo: 'booleano',
      soloEnFormulario: true,
      ayuda: 'Desactívalo cuando la norma hable de meses: «un mes» no son treinta días hábiles.',
    },
    {
      clave: 'dias_max_retroactivo',
      etiqueta: 'Días hacia atrás',
      tipo: 'numero',
      soloEnFormulario: true,
      ayuda:
        'Cuántos días antes de hoy admite la fecha de inicio. Una incapacidad se registra después de ocurrir; una diligencia, no.',
    },
    {
      clave: 'dias_max_futuro',
      etiqueta: 'Días hacia adelante',
      tipo: 'numero',
      soloEnFormulario: true,
      ayuda: 'Vacío = sin tope. Evita el permiso pedido para dentro de dos años.',
    },
    {
      clave: 'duracion_maxima_dias',
      etiqueta: 'Duración máxima (días)',
      tipo: 'numero',
      soloEnFormulario: true,
      ayuda: 'Solo advierte. El luto son 5 días hábiles (Ley 1280 de 2009).',
    },
    {
      clave: 'permite_horas',
      etiqueta: 'Se puede pedir por horas',
      tipo: 'booleano',
      soloEnFormulario: true,
      ayuda: 'No para licencias e incapacidades, que se miden en días completos.',
    },
    {
      clave: 'max_por_periodo',
      etiqueta: 'Cupo por periodo',
      tipo: 'numero',
      soloEnFormulario: true,
      ayuda: 'El día de la familia es 1 por semestre (Ley 1857 de 2017).',
    },
    {
      clave: 'periodo_control',
      etiqueta: 'Periodo del cupo',
      tipo: 'seleccion',
      soloEnFormulario: true,
      opciones: [
        { valor: 'ninguno', etiqueta: 'Sin control' },
        { valor: 'mes', etiqueta: 'Mensual' },
        { valor: 'semestre', etiqueta: 'Semestral' },
        { valor: 'anio', etiqueta: 'Anual' },
      ],
    },
    {
      clave: 'interrumpe_otros',
      etiqueta: 'Interrumpe otros permisos',
      tipo: 'booleano',
      soloEnFormulario: true,
      ayuda:
        'Sí para incapacidades: si caen dentro de unas vacaciones, las suspenden y los días quedan pendientes (art. 187 CST).',
    },
    {
      clave: 'prioridad',
      etiqueta: 'Prioridad ante cruces',
      tipo: 'numero',
      soloEnFormulario: true,
      ayuda: 'Gana el número mayor. Incapacidad 30 · luto 20 · calamidad 15 · vacaciones 10.',
    },
    {
      clave: 'exento_antelacion',
      etiqueta: 'Exento de antelación',
      tipo: 'booleano',
      soloEnFormulario: true,
      ayuda: 'Para calamidad y luto, que no se pueden planear.',
    },
    {
      clave: 'dias_calendario',
      etiqueta: 'Cuenta días calendario',
      tipo: 'booleano',
      soloEnFormulario: true,
      ayuda:
        'Sí para incapacidades y licencias: pueden empezar cualquier día y los fines de semana cuentan. No para citas y diligencias, que solo van en días hábiles.',
    },
    { clave: 'orden', etiqueta: 'Orden', tipo: 'numero', ancho: 'w-20' },
    { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano', ancho: 'w-24' },
  ]

  const camposDocumento: CampoCatalogo[] = [
    {
      clave: 'codigo',
      etiqueta: 'Código',
      tipo: 'texto',
      requerido: true,
      ancho: 'w-48',
      ayuda: 'Identificador estable en minúsculas, p. ej. certificado_incapacidad.',
    },
    { clave: 'nombre', etiqueta: 'Documento', tipo: 'texto', requerido: true },
    {
      clave: 'norma',
      etiqueta: 'Norma',
      tipo: 'texto',
      ayuda: 'Se le muestra al colaborador: es lo que sustenta que se le pida.',
    },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', soloEnFormulario: true },
    { clave: 'orden', etiqueta: 'Orden', tipo: 'numero', ancho: 'w-20' },
    { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano', ancho: 'w-24' },
  ]

  const camposMatriz: CampoCatalogo[] = [
    {
      clave: 'tipo_id',
      etiqueta: 'Motivo',
      tipo: 'seleccion',
      requerido: true,
      opciones: (tiposAdmin ?? []).map((t) => ({ valor: String(t.id), etiqueta: t.nombre })),
    },
    {
      clave: 'documento_id',
      etiqueta: 'Documento',
      tipo: 'seleccion',
      requerido: true,
      opciones: (documentosAdmin ?? []).map((d) => ({ valor: String(d.id), etiqueta: d.nombre })),
    },
    {
      clave: 'momento',
      etiqueta: 'Momento',
      tipo: 'seleccion',
      requerido: true,
      ancho: 'w-36',
      opciones: [
        { valor: 'previo', etiqueta: 'Al solicitar' },
        { valor: 'posterior', etiqueta: 'Al finalizar' },
      ],
    },
    { clave: 'obligatorio', etiqueta: 'Obligatorio', tipo: 'booleano', ancho: 'w-28' },
    {
      clave: 'desde_dias',
      etiqueta: 'Solo desde (días)',
      tipo: 'numero',
      ancho: 'w-32',
      ayuda: 'Vacío = se exige siempre. La constancia de cita médica, a partir de 2 días.',
    },
    { clave: 'nota', etiqueta: 'Nota para el colaborador', tipo: 'texto', soloEnFormulario: true },
    { clave: 'orden', etiqueta: 'Orden', tipo: 'numero', ancho: 'w-20' },
    { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano', ancho: 'w-24' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Administración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catálogos, usuarios y reglas de operación de la aplicación.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {SECCIONES.map(({ clave, etiqueta, icono: Icono }) => (
          <button
            key={clave}
            onClick={() => setSeccion(clave)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              seccion === clave
                ? 'bg-[var(--cac-azul)] text-white shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icono className="size-4" />
            {etiqueta}
          </button>
        ))}
      </nav>

      {seccion === 'usuarios' && <PanelUsuarios />}

      {seccion === 'coordinadores' && (
        <EditorCatalogo
          tabla="coordinadores"
          campos={camposCoordinador}
          orden="nombre"
          titulo="Jefes directos"
          descripcion="Quiénes pueden autorizar solicitudes y de qué servicio. Es la lista que ve el colaborador al solicitar."
          advertencia={AVISO_COMPARTIDO}
          valoresPorDefecto={{ activo: true }}
        />
      )}

      {seccion === 'areas' && (
        <EditorCatalogo
          tabla="areas"
          campos={CAMPOS_AREA}
          orden="nombre"
          titulo="Procesos y áreas"
          descripcion="La lista que elige el colaborador al registrarse y al solicitar. Agrega aquí el proceso que falte."
          advertencia={AVISO_COMPARTIDO}
          valoresPorDefecto={{ activo: true }}
        />
      )}

      {seccion === 'cargos' && (
        <EditorCatalogo
          tabla="cargos"
          campos={CAMPOS_CARGO}
          orden="nombre"
          titulo="Cargos"
          descripcion="Los cargos del desplegable del registro. Agrega aquí el que falte para que nadie se quede sin poder crear su cuenta."
          advertencia={AVISO_COMPARTIDO}
          valoresPorDefecto={{ activo: true }}
        />
      )}

      {seccion === 'tramites' && (
        <EditorCatalogo
          tabla="permisos_tramites"
          campos={CAMPOS_TRAMITE}
          titulo="Trámites y formatos"
          descripcion="Código, versión y vigencia que imprime el PDF. Cuando Calidad publique una versión nueva, se cambia aquí sin desplegar."
        />
      )}

      {seccion === 'categorias' && (
        <EditorCatalogo
          tabla="permisos_categorias"
          campos={CAMPOS_CATEGORIA}
          titulo="Categorías del formato"
          descripcion="Las casillas del TH-F-002: Personal, Día de la Familia, Salud, Empresarial y Calamidad."
        />
      )}

      {seccion === 'tipos' && (
        <EditorCatalogo
          tabla="permisos_tipos"
          campos={camposTipo}
          titulo="Motivos de permiso"
          descripcion="El detalle dentro de cada categoría, con sus reglas de soporte y su ruta de aprobación."
          valoresPorDefecto={{ ruta_aprobacion: 'coordinador_th', remunerado_por_defecto: true }}
        />
      )}

      {seccion === 'documentos' && (
        <EditorCatalogo
          tabla="permisos_documentos"
          campos={camposDocumento}
          titulo="Catálogo de documentos"
          descripcion="Los documentos que puede exigir un motivo, con la norma que los respalda. Aquí solo se definen; qué motivo pide cuál se configura en «Documentos exigidos»."
          valoresPorDefecto={{ activo: true }}
        />
      )}

      {seccion === 'matriz' && (
        <EditorCatalogo
          tabla="permisos_tipos_documentos"
          campos={camposMatriz}
          titulo="Documentos exigidos por motivo"
          descripcion="Qué documento pide cada motivo y en qué momento: al solicitar o al finalizar. Es lo que ve el colaborador en el formulario y lo que Talento Humano verifica al cerrar."
          advertencia="Los interruptores «Soporte al solicitar» y «Soporte al regresar» del motivo se recalculan solos a partir de esta tabla: no hace falta tocarlos a mano."
          valoresPorDefecto={{ activo: true, obligatorio: true, momento: 'previo', orden: 1 }}
        />
      )}

      {seccion === 'empresas' && (
        <EditorCatalogo
          tabla="permisos_empresas"
          campos={CAMPOS_EMPRESA}
          titulo="Empresas"
          descripcion="Las tres del formato: CAC Santa Bárbara, GE2 y Geriater."
        />
      )}

      {seccion === 'parametros' && <PanelParametros />}

      {seccion === 'auditoria' && <PanelAuditoria />}
    </div>
  )
}
