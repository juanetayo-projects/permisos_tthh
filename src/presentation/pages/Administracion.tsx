import { useState } from 'react'
import { Building2, FileCog, ListTree, ScrollText, SlidersHorizontal, Tags, Users } from 'lucide-react'
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

type Seccion = 'usuarios' | 'tramites' | 'categorias' | 'tipos' | 'empresas' | 'parametros' | 'auditoria'

const SECCIONES: { clave: Seccion; etiqueta: string; icono: typeof Users }[] = [
  { clave: 'usuarios', etiqueta: 'Usuarios y roles', icono: Users },
  { clave: 'tramites', etiqueta: 'Trámites y formatos', icono: FileCog },
  { clave: 'categorias', etiqueta: 'Categorías', icono: Tags },
  { clave: 'tipos', etiqueta: 'Motivos de permiso', icono: ListTree },
  { clave: 'empresas', etiqueta: 'Empresas', icono: Building2 },
  { clave: 'parametros', etiqueta: 'Parámetros', icono: SlidersHorizontal },
  { clave: 'auditoria', etiqueta: 'Auditoría', icono: ScrollText },
]

export default function Administracion() {
  const [seccion, setSeccion] = useState<Seccion>('usuarios')

  // Los motivos necesitan la lista de categorías para su desplegable.
  const { data: categorias } = useCatalogo<{ id: number; nombre: string; activo: boolean }>(
    'permisos_categorias'
  )

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
      clave: 'requiere_soporte_previo',
      etiqueta: 'Soporte al solicitar',
      tipo: 'booleano',
      soloEnFormulario: true,
    },
    {
      clave: 'requiere_soporte_posterior',
      etiqueta: 'Soporte al regresar',
      tipo: 'booleano',
      soloEnFormulario: true,
    },
    {
      clave: 'soporte_obligatorio_desde_dias',
      etiqueta: 'Soporte obligatorio desde (días)',
      tipo: 'numero',
      soloEnFormulario: true,
      ayuda: 'Por ejemplo, la cita médica lo exige a partir de 2 días.',
    },
    {
      clave: 'exento_antelacion',
      etiqueta: 'Exento de antelación',
      tipo: 'booleano',
      soloEnFormulario: true,
      ayuda: 'Para calamidad y luto, que no se pueden planear.',
    },
    { clave: 'orden', etiqueta: 'Orden', tipo: 'numero', ancho: 'w-20' },
    { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano', ancho: 'w-24' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-4">
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
