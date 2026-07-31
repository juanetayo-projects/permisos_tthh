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

export interface UsuarioHeredado {
  id: string
  nombre: string
  correo: string
  documento: string | null
  cargo: string | null
  activo: boolean
}

/**
 * Personas que ya existen en Cambio de Turnos pero aún no tienen perfil aquí.
 *
 * Ambas apps comparten `auth.users`, así que estas personas pueden iniciar
 * sesión en Permisos, pero se quedarían en la pantalla de «cuenta sin perfil»
 * hasta que alguien se lo cree. Importarlas evita ese callejón sin salida y
 * ahorra que 24 personas se registren de nuevo.
 */
export function useUsuariosHeredados() {
  return useQuery({
    queryKey: ['usuarios-heredados'],
    queryFn: async (): Promise<UsuarioHeredado[]> => {
      const [{ data: origen, error: e1 }, { data: existentes, error: e2 }] = await Promise.all([
        supabase.from('profiles').select('id, nombre, correo, documento, cargo, activo').order('nombre'),
        supabase.from('permisos_perfiles').select('user_id'),
      ])

      if (e1) throw e1
      if (e2) throw e2

      const yaTienen = new Set((existentes ?? []).map((p) => p.user_id))
      return (origen ?? []).filter((p) => !yaTienen.has(p.id))
    },
  })
}

/** Crea el perfil de Permisos para personas que ya están en Cambio de Turnos. */
export function useImportarUsuarios() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (usuarios: UsuarioHeredado[]) => {
      const { error } = await supabase.from('permisos_perfiles').insert(
        usuarios.map((u) => ({
          user_id: u.id,
          nombre: u.nombre,
          correo: u.correo,
          documento: u.documento,
          tipo_documento: 'CC',
          rol: 'colaborador',
          // Nacen pendientes: Talento Humano confirma servicio y jefe directo,
          // que es justo el dato que no viene de la otra aplicación.
          estado: 'pendiente_validacion',
          activo: false,
        }))
      )
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['perfiles'] })
      void qc.invalidateQueries({ queryKey: ['usuarios-heredados'] })
    },
  })
}

export interface DatosNuevoUsuario {
  nombre: string
  correo: string
  tipo_documento: string
  documento: string | null
  telefono: string | null
  empresa_id: number | null
  area_id: number | null
  cargo_id: number | null
  coordinador_id: number | null
  rol: Rol
}

export interface ResultadoAlta {
  ya_existia: boolean
  correo_enviado: boolean
}

/**
 * Alta de un colaborador desde la consola.
 *
 * Va por Edge Function porque crear la cuenta exige la Admin API, y esa clave
 * no puede vivir en el navegador. Quién tiene permiso se comprueba allí, no
 * aquí: esconder el botón no es una medida de seguridad.
 *
 * La cuenta nace **activa** —la creó quien valida— y la contraseña la define
 * la propia persona con el enlace que recibe por correo.
 */
export function useCrearUsuario() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (datos: DatosNuevoUsuario): Promise<ResultadoAlta> => {
      const { data, error } = await supabase.functions.invoke('permisos-crear-usuario', {
        body: datos,
      })

      // La función responde con un mensaje propio en el cuerpo; sin leerlo, el
      // usuario solo vería «Edge Function returned a non-2xx status code».
      if (error) {
        const detalle = await (error as { context?: Response }).context
          ?.json()
          .catch(() => null)
        throw new Error(detalle?.error ?? 'No fue posible crear el usuario.')
      }

      return data as ResultadoAlta
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['perfiles'] })
      void qc.invalidateQueries({ queryKey: ['usuarios-heredados'] })
    },
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
