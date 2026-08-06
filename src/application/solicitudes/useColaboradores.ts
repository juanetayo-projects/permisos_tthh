import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'

export interface ColaboradorDelArea {
  user_id: string
  nombre: string
  correo: string
  documento: string | null
  empresa_id: number | null
  area_id: number | null
  cargo_id: number | null
  coordinador_id: number | null
}

/**
 * La gente a la que se le puede reportar una incapacidad.
 *
 * No se filtra por área desde aquí: lo hace la policy
 * `permisos_perfiles_select`, que ya devuelve el propio perfil, el del área que
 * se coordina y —para Talento Humano y SST— todos. Repetir el filtro en el
 * cliente solo añadiría una forma más de equivocarse, y una que además no
 * protege nada.
 *
 * Se piden solo los activos: reportarle una incapacidad a alguien que ya no
 * trabaja en la clínica no tiene sentido.
 */
export function useColaboradoresVisibles() {
  return useQuery({
    queryKey: ['colaboradores-visibles'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ColaboradorDelArea[]> => {
      const { data, error } = await supabase
        .from('permisos_perfiles')
        .select('user_id, nombre, correo, documento, empresa_id, area_id, cargo_id, coordinador_id')
        .eq('estado', 'activo')
        .is('deleted_at', null)
        .order('nombre')

      if (error) throw error
      return (data ?? []) as ColaboradorDelArea[]
    },
  })
}
