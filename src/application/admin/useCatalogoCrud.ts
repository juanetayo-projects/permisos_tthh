import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'

/**
 * CRUD genérico sobre los catálogos administrables.
 *
 * Todos comparten la misma forma —lista ordenada de filas con `id` y `activo`—
 * así que un solo hook evita repetir cinco veces el mismo código. Las reglas de
 * quién puede escribir viven en RLS, no aquí.
 */
export type TablaCatalogo =
  | 'permisos_empresas'
  | 'permisos_categorias'
  | 'permisos_tipos'
  | 'permisos_tramites'
  | 'permisos_documentos'
  | 'permisos_tipos_documentos'
  // Compartidos con Cambio de Turnos: editarlos afecta a las dos aplicaciones.
  | 'coordinadores'
  | 'areas'
  | 'cargos'

export function useCatalogo<T extends { id: number }>(tabla: TablaCatalogo, orden = 'orden') {
  return useQuery({
    queryKey: ['catalogo-admin', tabla],
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase.from(tabla).select('*').order(orden)
      if (error) throw error
      return (data ?? []) as T[]
    },
  })
}

function invalidar(qc: ReturnType<typeof useQueryClient>, tabla: TablaCatalogo) {
  void qc.invalidateQueries({ queryKey: ['catalogo-admin', tabla] })
  // Los catálogos también alimentan los formularios, que usan otras claves.
  void qc.invalidateQueries({ queryKey: ['empresas'] })
  void qc.invalidateQueries({ queryKey: ['categorias'] })
  void qc.invalidateQueries({ queryKey: ['tipos'] })
  void qc.invalidateQueries({ queryKey: ['tramites'] })
  void qc.invalidateQueries({ queryKey: ['documentos'] })
  void qc.invalidateQueries({ queryKey: ['tipos-documentos'] })
  void qc.invalidateQueries({ queryKey: ['coordinadores'] })
  void qc.invalidateQueries({ queryKey: ['areas'] })
  void qc.invalidateQueries({ queryKey: ['cargos'] })
  // El formulario de registro lee áreas y cargos por RPC, con una caché de una
  // hora: sin esto, el cargo recién creado no aparecería hasta recargar.
  void qc.invalidateQueries({ queryKey: ['catalogos-registro'] })
}

export function useGuardarFila(tabla: TablaCatalogo) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (fila: Record<string, unknown> & { id?: number }) => {
      if (fila.id) {
        const { id, ...campos } = fila
        const { error } = await supabase.from(tabla).update(campos).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from(tabla).insert(fila)
        if (error) throw error
      }
    },
    onSuccess: () => invalidar(qc, tabla),
  })
}

/**
 * Desactiva en vez de borrar.
 *
 * Un catálogo referenciado por solicitudes históricas no se puede eliminar sin
 * romper la trazabilidad: `activo = false` lo saca de los desplegables pero
 * deja legibles los registros que ya lo usaron.
 */
export function useAlternarActivo(tabla: TablaCatalogo) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: number; activo: boolean }) => {
      const { error } = await supabase
        .from(tabla)
        .update({ activo: params.activo })
        .eq('id', params.id)
      if (error) throw error
    },
    onSuccess: () => invalidar(qc, tabla),
  })
}

export interface ParametroConfig {
  clave: string
  valor: unknown
  descripcion: string | null
  updated_at: string | null
}

export function useParametros() {
  return useQuery({
    queryKey: ['config-admin'],
    queryFn: async (): Promise<ParametroConfig[]> => {
      const { data, error } = await supabase
        .from('permisos_config')
        .select('clave, valor, descripcion, updated_at')
        .order('clave')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useGuardarParametro() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: { clave: string; valor: unknown }) => {
      const { error } = await supabase
        .from('permisos_config')
        .update({ valor: params.valor, updated_at: new Date().toISOString() })
        .eq('clave', params.clave)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['config-admin'] })
      void qc.invalidateQueries({ queryKey: ['config'] })
    },
  })
}

export interface RegistroAuditoria {
  id: number
  tabla: string
  registro_id: string
  accion: string
  actor_correo: string | null
  campos_cambiados: string[] | null
  created_at: string
  datos_antes: Record<string, unknown> | null
  datos_despues: Record<string, unknown> | null
}

export function useAuditoria(limite = 200) {
  return useQuery({
    queryKey: ['auditoria', limite],
    queryFn: async (): Promise<RegistroAuditoria[]> => {
      const { data, error } = await supabase
        .from('permisos_auditoria')
        .select('id, tabla, registro_id, accion, actor_correo, campos_cambiados, created_at, datos_antes, datos_despues')
        .order('created_at', { ascending: false })
        .limit(limite)
      if (error) throw error
      return data ?? []
    },
  })
}
