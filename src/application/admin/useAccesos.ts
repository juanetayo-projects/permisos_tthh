import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/infrastructure/supabase/client'
import { ROLES, type Rol } from '@/domain/estados'
import {
  ACCESOS_POR_DEFECTO,
  MODULOS,
  type MatrizAccesos,
  type Modulo,
} from '@/domain/modulos'

/**
 * El reparto de módulos por rol, tal y como está en la base de datos.
 *
 * Se cachea largo —una hora— porque cambia cuando alguien mueve una casilla en
 * Administración, no cada minuto, y de esta consulta depende que se pinte el
 * menú: hacerla en cada navegación añadiría un parpadeo a cada pantalla. La
 * mutación invalida la caché, así que quien reparte ve el efecto de inmediato.
 */
export function useAccesos() {
  return useQuery({
    queryKey: ['accesos-rol'],
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<MatrizAccesos> => {
      const { data, error } = await supabase.from('permisos_acceso_rol').select('rol, modulo')
      if (error) throw error

      const matriz = Object.fromEntries(ROLES.map((r) => [r, [] as Modulo[]])) as MatrizAccesos

      for (const fila of data ?? []) {
        const rol = fila.rol as Rol
        const modulo = fila.modulo as Modulo
        // Una fila de un módulo que ya no existe en el código no rompe nada:
        // se ignora. Pasa al retirar una pantalla sin limpiar la tabla.
        if (matriz[rol] && MODULOS.includes(modulo)) matriz[rol].push(modulo)
      }

      return matriz
    },
  })
}

/**
 * Los módulos del rol de quien está usando la aplicación.
 *
 * Mientras la consulta está en vuelo —o si falla— se devuelve el reparto por
 * defecto en vez de una lista vacía: un menú en blanco deja a la persona sin
 * poder ir a ningún sitio, y es peor que enseñar de más un enlace que la ruta
 * volverá a comprobar.
 */
export function useModulosDelRol(rol: Rol | undefined): Modulo[] {
  const { data } = useAccesos()
  if (!rol) return []
  return data?.[rol] ?? ACCESOS_POR_DEFECTO[rol]
}

/** Guarda el reparto completo de un rol. Solo el administrador (policy). */
export function useGuardarAccesosRol() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: { rol: Rol; modulos: Modulo[] }) => {
      // Se borra lo que sobra y se inserta lo que falta, en vez de vaciar la
      // fila entera y reescribirla: borrar todo el rol «administrador» chocaría
      // contra el trigger que protege su acceso a Administración.
      const { data: actuales, error: errorLectura } = await supabase
        .from('permisos_acceso_rol')
        .select('modulo')
        .eq('rol', params.rol)

      if (errorLectura) throw errorLectura

      const antes = new Set((actuales ?? []).map((f) => f.modulo as Modulo))
      const despues = new Set(params.modulos)

      const quitar = [...antes].filter((m) => !despues.has(m))
      const poner = [...despues].filter((m) => !antes.has(m))

      if (quitar.length) {
        const { error } = await supabase
          .from('permisos_acceso_rol')
          .delete()
          .eq('rol', params.rol)
          .in('modulo', quitar)
        if (error) throw error
      }

      if (poner.length) {
        const { error } = await supabase
          .from('permisos_acceso_rol')
          .insert(poner.map((modulo) => ({ rol: params.rol, modulo })))
        if (error) throw error
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['accesos-rol'] }),
  })
}
