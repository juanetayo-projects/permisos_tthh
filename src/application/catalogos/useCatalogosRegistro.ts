import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'
import type { Area, Cargo, Empresa } from './useCatalogos'

interface CatalogosRegistro {
  empresas: Empresa[]
  areas: Area[]
  cargos: Cargo[]
  /** Lista vacía = se acepta cualquier dominio de correo. */
  dominios_permitidos: string[]
}

/**
 * Catálogos del formulario de registro.
 *
 * Se leen por RPC y no por tabla: quien se registra aún no tiene sesión, y las
 * policies de los catálogos exigen `authenticated`. La función expone solo id y
 * nombre, sin datos de personas.
 */
export function useCatalogosRegistro() {
  return useQuery({
    queryKey: ['catalogos-registro'],
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<CatalogosRegistro> => {
      const { data, error } = await supabase.rpc('permisos_catalogos_registro')
      if (error) throw error
      return data as CatalogosRegistro
    },
  })
}
