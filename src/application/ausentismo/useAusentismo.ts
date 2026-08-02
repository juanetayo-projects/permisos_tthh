import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'
import type { FilaAusentismo } from '@/domain/ausentismo'

/**
 * Datos del módulo de ausentismo.
 *
 * Vienen de la vista `permisos_v_ausentismo`, que ya deja fuera lo que no es
 * una ausencia —trámites, comisiones sindicales, capacitaciones— y recorta los
 * periodos suspendidos a los días efectivamente disfrutados. Hacer ese trabajo
 * en la vista y no en el cliente evita que el informe y la pantalla lleguen a
 * cifras distintas partiendo de los mismos datos.
 *
 * La vista es `security_invoker`, así que RLS sigue mandando: el coordinador
 * solo ve su área.
 */
export function useAusentismo(params: { desde?: string; hasta?: string } = {}) {
  return useQuery({
    queryKey: ['ausentismo', params.desde, params.hasta],
    queryFn: async (): Promise<FilaAusentismo[]> => {
      let q = supabase
        .from('permisos_v_ausentismo')
        .select('*')
        .order('fecha_inicio', { ascending: false })

      if (params.desde) q = q.gte('fecha_inicio', params.desde)
      if (params.hasta) q = q.lte('fecha_inicio', params.hasta)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as FilaAusentismo[]
    },
  })
}

export interface FilaPlantilla {
  user_id: string
  nombre: string
  area_id: number | null
  cargo_id: number | null
  empresa_id: number | null
}

/**
 * Plantilla activa, denominador de los índices.
 *
 * Los índices de la GTC 3701 se dividen por las horas que la plantilla debía
 * trabajar. Dividir por la gente que se ausentó daría un número altísimo y
 * constante, que no dice nada: el dato interesante es qué proporción del tiempo
 * disponible se perdió.
 */
export function usePlantilla() {
  return useQuery({
    queryKey: ['plantilla'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<FilaPlantilla[]> => {
      const { data, error } = await supabase
        .from('permisos_perfiles')
        .select('user_id, nombre, area_id, cargo_id, empresa_id')
        .eq('estado', 'activo')
        .eq('activo', true)
        .is('deleted_at', null)

      if (error) throw error
      return data ?? []
    },
  })
}
