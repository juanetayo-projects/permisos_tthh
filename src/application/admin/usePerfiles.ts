import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'
import type { Rol } from '@/domain/estados'

export type EstadoPerfil = 'pendiente_validacion' | 'activo' | 'inactivo'

export interface PerfilAdmin {
  user_id: string
  nombre: string
  correo: string
  tipo_documento: string | null
  documento: string | null
  telefono: string | null
  rol: Rol
  estado: EstadoPerfil
  activo: boolean
  fecha_ingreso: string | null
  validado_en: string | null
  created_at: string
  empresa_id: number | null
  area_id: number | null
  cargo_id: number | null
  coordinador_id: number | null
  empresa: { id: number; nombre: string } | null
  area: { id: number; nombre: string } | null
  cargo: { id: number; nombre: string } | null
  coordinador: { id: number; nombre: string | null; correo: string } | null
}

const SELECT_PERFIL = `
  user_id, nombre, correo, tipo_documento, documento, telefono, rol, estado, activo,
  fecha_ingreso, validado_en, created_at, empresa_id, area_id, cargo_id, coordinador_id,
  empresa:permisos_empresas(id, nombre),
  area:areas(id, nombre),
  cargo:cargos(id, nombre),
  coordinador:coordinadores(id, nombre, correo)
`

export function usePerfiles(soloPendientes = false) {
  return useQuery({
    queryKey: ['perfiles', soloPendientes],
    queryFn: async (): Promise<PerfilAdmin[]> => {
      let q = supabase
        .from('permisos_perfiles')
        .select(SELECT_PERFIL)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (soloPendientes) q = q.eq('estado', 'pendiente_validacion')

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as PerfilAdmin[]
    },
  })
}

/**
 * Valida un perfil recién registrado.
 *
 * No toca `rol`: la policy `permisos_perfiles_th` lo prohíbe expresamente para
 * que un analista no pueda ascenderse a sí mismo. Cambiar roles es exclusivo
 * del administrador (ver `useCambiarRol`).
 */
export function useValidarPerfil() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      userId: string
      areaId: number | null
      cargoId: number | null
      empresaId: number | null
      coordinadorId: number | null
      documento: string | null
      estado: EstadoPerfil
      validadoPor: string
    }) => {
      const { error } = await supabase
        .from('permisos_perfiles')
        .update({
          area_id: params.areaId,
          cargo_id: params.cargoId,
          empresa_id: params.empresaId,
          coordinador_id: params.coordinadorId,
          documento: params.documento,
          estado: params.estado,
          activo: params.estado === 'activo',
          validado_por: params.validadoPor,
          validado_en: new Date().toISOString(),
        })
        .eq('user_id', params.userId)

      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['perfiles'] }),
  })
}

/** Solo el administrador puede asignar roles (policy `permisos_perfiles_admin`). */
export function useCambiarRol() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: { userId: string; rol: Rol }) => {
      const { error } = await supabase
        .from('permisos_perfiles')
        .update({ rol: params.rol })
        .eq('user_id', params.userId)

      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['perfiles'] }),
  })
}

export function useCambiarEstadoPerfil() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: { userId: string; estado: EstadoPerfil }) => {
      const { error } = await supabase
        .from('permisos_perfiles')
        .update({ estado: params.estado, activo: params.estado === 'activo' })
        .eq('user_id', params.userId)

      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['perfiles'] }),
  })
}
