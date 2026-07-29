import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'

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
}
export interface Coordinador {
  id: number
  area_id: number | null
  nombre: string | null
  correo: string
  cargo: string
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
  ruta_aprobacion: 'coordinador_th' | 'gerente_th_directo'
  exento_antelacion: boolean
  descripcion: string | null
  orden: number
}
export interface Tramite {
  id: number
  codigo: 'permiso' | 'vacaciones'
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
        .select('id, nombre')
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

export function useTipos() {
  return useQuery({
    queryKey: ['tipos'],
    ...OPCIONES_CATALOGO,
    queryFn: async (): Promise<Tipo[]> => {
      const { data, error } = await supabase
        .from('permisos_tipos')
        .select(
          'id, categoria_id, nombre, remunerado_por_defecto, requiere_soporte_previo, requiere_soporte_posterior, soporte_obligatorio_desde_dias, ruta_aprobacion, exento_antelacion, descripcion, orden'
        )
        .eq('activo', true)
        .order('orden')
      if (error) throw error
      return data ?? []
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

export function useTramite(codigo: 'permiso' | 'vacaciones') {
  const { data, ...resto } = useTramites()
  return { ...resto, data: data?.find((t) => t.codigo === codigo) }
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
