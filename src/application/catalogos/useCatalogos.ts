import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'
import type { DocumentoExigido } from '@/domain/soportes'
import type { CodigoTramite } from '@/domain/tramites'

export interface Empresa {
  id: number
  nombre: string
}
export interface Area {
  id: number
  nombre: string
}
export interface Cargo {
  id: number
  nombre: string
  /** Gobierna el día de reintegro tras vacaciones: calendario si es asistencial. */
  tipo: 'administrativo' | 'asistencial'
}
export interface EntidadSalud {
  id: number
  nombre: string
  tipo: 'EPS' | 'ARL'
}
export interface Coordinador {
  id: number
  area_id: number | null
  nombre: string | null
  correo: string
  cargo: string
}

/**
 * Etiqueta de un coordinador en los desplegables.
 *
 * El nombre solo no basta: hay personas que coordinan varios servicios y
 * aparecen una vez por cada uno, con lo que las opciones se veían idénticas y
 * no había forma de saber cuál elegir. El cargo desambigua.
 */
export function etiquetaCoordinador(c: Coordinador): string {
  const nombre = c.nombre?.trim() || c.correo
  return c.cargo ? `${nombre} · ${c.cargo}` : nombre
}
export interface Categoria {
  id: number
  nombre: string
  casilla_formato: string
  orden: number
}
export interface Tipo {
  id: number
  categoria_id: number
  nombre: string
  remunerado_por_defecto: boolean
  requiere_soporte_previo: boolean
  requiere_soporte_posterior: boolean
  soporte_obligatorio_desde_dias: number | null
  ruta_aprobacion: 'coordinador_th' | 'gerente_th_directo' | 'th_directo'
  exento_antelacion: boolean
  /** Se cuenta por días calendario: incapacidades y licencias. */
  dias_calendario: boolean
  /** La duración resta domingos y festivos, como vacaciones (p. ej. luto). */
  duracion_en_habiles: boolean
  /** Duración legal exacta (maternidad, paternidad): no se pregunta, se calcula. */
  duracion_en_dias_fija: boolean
  /** Qué es en derecho: de ello dependen el soporte y el cómputo. */
  naturaleza: 'permiso' | 'licencia' | 'incapacidad' | 'vacaciones' | 'tramite'
  /** Los trámites y el tiempo de representación no restan tiempo laborado. */
  genera_ausentismo: boolean
  fundamento_legal: string | null
  dias_max_retroactivo: number
  dias_max_futuro: number | null
  duracion_maxima_dias: number | null
  duracion_minima_dias: number | null
  permite_horas: boolean
  plazo_soporte_dias: number | null
  plazo_soporte_habiles: boolean
  max_por_periodo: number | null
  periodo_control: 'ninguno' | 'mes' | 'semestre' | 'anio'
  interrumpe_otros: boolean
  prioridad: number
  descripcion: string | null
  orden: number
}

export interface Documento {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  norma: string | null
  orden: number
}

/** Fila de la matriz motivo × documento × momento, con el documento resuelto. */
export interface TipoDocumento {
  id: number
  tipo_id: number
  documento_id: number
  momento: 'previo' | 'posterior'
  obligatorio: boolean
  desde_dias: number | null
  nota: string | null
  orden: number
  documento: Documento | null
}
export interface Tramite {
  id: number
  codigo: CodigoTramite
  nombre: string
  codigo_formato: string
  version_formato: string
  vigencia_formato: string | null
  proceso: string
  nota_pie: string | null
  antelacion_minima: number
  unidad_antelacion: 'horas' | 'dias'
}

/** Los catálogos cambian muy poco: se cachean una hora. */
const OPCIONES_CATALOGO = { staleTime: 60 * 60_000, gcTime: 2 * 60 * 60_000 }

export function useEmpresas() {
  return useQuery({
    queryKey: ['empresas'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Empresa[]> => {
      const { data, error } = await supabase
        .from('permisos_empresas')
        .select('id, nombre')
        .eq('activo', true)
        .order('orden')
      if (error) throw error
      return data ?? []
    },
  })
}

/** Reutiliza el catálogo compartido con Cambio de Turnos. */
export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCargos() {
  return useQuery({
    queryKey: ['cargos'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Cargo[]> => {
      const { data, error } = await supabase
        .from('cargos')
        .select('id, nombre, tipo')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useEntidadesSalud() {
  return useQuery({
    queryKey: ['entidades-salud'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<EntidadSalud[]> => {
      const { data, error } = await supabase
        .from('entidades_salud')
        .select('id, nombre, tipo')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCoordinadores() {
  return useQuery({
    queryKey: ['coordinadores'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Coordinador[]> => {
      const { data, error } = await supabase
        .from('coordinadores')
        .select('id, area_id, nombre, correo, cargo')
        .eq('activo', true)
        .order('nombre')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from('permisos_categorias')
        .select('id, nombre, casilla_formato, orden')
        .eq('activo', true)
        .order('orden')
      if (error) throw error
      return data ?? []
    },
  })
}

const CAMPOS_TIPO =
  'id, categoria_id, nombre, remunerado_por_defecto, requiere_soporte_previo, ' +
  'requiere_soporte_posterior, soporte_obligatorio_desde_dias, ruta_aprobacion, ' +
  'exento_antelacion, dias_calendario, duracion_en_habiles, duracion_en_dias_fija, naturaleza, genera_ausentismo, fundamento_legal, ' +
  'dias_max_retroactivo, dias_max_futuro, duracion_maxima_dias, duracion_minima_dias, ' +
  'permite_horas, plazo_soporte_dias, plazo_soporte_habiles, max_por_periodo, ' +
  'periodo_control, interrumpe_otros, prioridad, descripcion, orden'

export function useTipos() {
  return useQuery({
    queryKey: ['tipos'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Tipo[]> => {
      const { data, error } = await supabase
        .from('permisos_tipos')
        .select(CAMPOS_TIPO)
        .eq('activo', true)
        .order('orden')
      if (error) throw error
      return (data ?? []) as unknown as Tipo[]
    },
  })
}

/**
 * Todos los motivos, incluidos los desactivados.
 *
 * El informe para Talento Humano y la pantalla de Administración necesitan ver
 * también los que están apagados: justamente son los que hay que revisar.
 */
export function useTodosLosTipos() {
  return useQuery({
    queryKey: ['tipos', 'todos'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<(Tipo & { activo: boolean })[]> => {
      const { data, error } = await supabase
        .from('permisos_tipos')
        .select(`${CAMPOS_TIPO}, activo`)
        .order('orden')
      if (error) throw error
      return (data ?? []) as unknown as (Tipo & { activo: boolean })[]
    },
  })
}

export function useDocumentos() {
  return useQuery({
    queryKey: ['documentos'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Documento[]> => {
      const { data, error } = await supabase
        .from('permisos_documentos')
        .select('id, codigo, nombre, descripcion, norma, orden')
        .eq('activo', true)
        .order('orden')
      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * Matriz completa de documentos exigidos.
 *
 * Se trae entera en una sola consulta y se filtra por motivo en memoria: son
 * unas decenas de filas y así el formulario no dispara una consulta cada vez
 * que alguien cambia el desplegable del motivo.
 */
export function useMatrizDocumentos() {
  return useQuery({
    queryKey: ['tipos-documentos'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<TipoDocumento[]> => {
      const { data, error } = await supabase
        .from('permisos_tipos_documentos')
        .select(
          'id, tipo_id, documento_id, momento, obligatorio, desde_dias, nota, orden, ' +
            'documento:permisos_documentos(id, codigo, nombre, descripcion, norma, orden)'
        )
        .eq('activo', true)
        .order('orden')
      if (error) throw error
      return (data ?? []) as unknown as TipoDocumento[]
    },
  })
}

export function useTramites() {
  return useQuery({
    queryKey: ['tramites'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Tramite[]> => {
      const { data, error } = await supabase
        .from('permisos_tramites')
        .select(
          'id, codigo, nombre, codigo_formato, version_formato, vigencia_formato, proceso, nota_pie, antelacion_minima, unidad_antelacion'
        )
        .eq('activo', true)
        .order('orden')
      if (error) throw error
      return (data ?? []) as Tramite[]
    },
  })
}

export function useTramite(codigo: CodigoTramite) {
  const { data, ...resto } = useTramites()
  return { ...resto, data: data?.find((t) => t.codigo === codigo) }
}

/**
 * Traduce la matriz de la base al vocabulario del dominio.
 *
 * El dominio no conoce PostgREST ni sus alias anidados; recibir aquí la forma
 * plana permite probar las reglas de soporte con objetos literales.
 */
export function documentosDelTipo(
  matriz: TipoDocumento[] | undefined,
  tipoId: number | null | undefined
): DocumentoExigido[] {
  if (!matriz || !tipoId) return []

  return matriz
    .filter((m) => m.tipo_id === tipoId && m.documento)
    .map((m) => ({
      id: m.id,
      documentoId: m.documento_id,
      codigo: m.documento!.codigo,
      nombre: m.documento!.nombre,
      descripcion: m.documento!.descripcion,
      norma: m.documento!.norma,
      momento: m.momento,
      obligatorio: m.obligatorio,
      desdeDias: m.desde_dias,
      nota: m.nota,
      orden: m.orden,
    }))
}

export interface Cie10 {
  codigo: string
  nombre: string
  capitulo: string | null
}

/**
 * Busca en el catálogo CIE10 por código o por nombre del diagnóstico.
 *
 * Son más de 12.000 filas: se busca en el servidor y no se trae entero, a
 * diferencia del resto de catálogos de esta pantalla.
 */
export function useBuscarCie10(termino: string) {
  const q = termino.trim()
  // La coma y los paréntesis tienen significado en la sintaxis de `.or()` de
  // PostgREST; un diagnóstico como «Diabetes mellitus, tipo 2» rompería el
  // filtro si no se quitan antes de interpolarlos.
  const seguro = q.replace(/[,()]/g, ' ').trim()
  return useQuery({
    queryKey: ['cie10', seguro],
    enabled: seguro.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Cie10[]> => {
      const { data, error } = await supabase
        .from('cie10')
        .select('codigo, nombre, capitulo')
        .or(`codigo.ilike.${seguro}%,nombre.ilike.%${seguro}%`)
        .eq('activo', true)
        .order('codigo')
        .limit(25)
      if (error) throw error
      return data ?? []
    },
  })
}

/** Parámetros editables sin desplegar (`permisos_config`). */
export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.from('permisos_config').select('clave, valor')
      if (error) throw error
      return Object.fromEntries((data ?? []).map((f) => [f.clave, f.valor]))
    },
  })
}
