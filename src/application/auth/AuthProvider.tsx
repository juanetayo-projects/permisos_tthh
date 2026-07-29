import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/infrastructure/supabase/client'
import { asegurarPerfil } from './asegurarPerfil'
import type { Rol } from '@/domain/estados'

export interface Perfil {
  user_id: string
  nombre: string
  correo: string
  documento: string | null
  rol: Rol
  estado: 'pendiente_validacion' | 'activo' | 'inactivo'
  area_id: number | null
  cargo_id: number | null
  empresa_id: number | null
  coordinador_id: number | null
}

interface ContextoAuth {
  session: Session | null
  perfil: Perfil | null
  cargandoSesion: boolean
  cargandoPerfil: boolean
  entrar: (correo: string, clave: string) => Promise<void>
  salir: () => Promise<void>
  recargarPerfil: () => Promise<void>
}

const Ctx = createContext<ContextoAuth | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [cargandoPerfil, setCargandoPerfil] = useState(false)

  const cargarPerfil = useCallback(async (usuario: User) => {
    setCargandoPerfil(true)
    try {
      const leer = async () =>
        supabase
          .from('permisos_perfiles')
          .select(
            'user_id, nombre, correo, documento, rol, estado, area_id, cargo_id, empresa_id, coordinador_id'
          )
          .eq('user_id', usuario.id)
          .is('deleted_at', null)
          .maybeSingle()

      let { data, error } = await leer()
      if (error) throw error

      // Primer inicio de sesión tras confirmar el correo: aún no existe la fila.
      if (!data) {
        const creado = await asegurarPerfil(usuario)
        if (creado) ({ data, error } = await leer())
        if (error) throw error
      }

      setPerfil((data as Perfil) ?? null)
    } catch {
      // Un fallo al leer el perfil no debe dejar la app colgada: la pantalla
      // de sesión decide qué mostrar cuando el perfil viene vacío.
      setPerfil(null)
    } finally {
      setCargandoPerfil(false)
    }
  }, [])

  useEffect(() => {
    // La sesión se resuelve primero y el perfil se carga aparte, para que la
    // interfaz nunca se quede indefinidamente en "Cargando".
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
        if (data.session?.user) void cargarPerfil(data.session.user)
      })
      .finally(() => setCargandoSesion(false))

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva)
      if (nueva?.user) {
        void cargarPerfil(nueva.user)
      } else {
        setPerfil(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [cargarPerfil])

  const entrar = useCallback(async (correo: string, clave: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
      password: clave,
    })
    if (error) throw error
  }, [])

  const salir = useCallback(async () => {
    await supabase.auth.signOut()
    setPerfil(null)
  }, [])

  const recargarPerfil = useCallback(async () => {
    if (session?.user) await cargarPerfil(session.user)
  }, [session, cargarPerfil])

  const valor = useMemo<ContextoAuth>(
    () => ({ session, perfil, cargandoSesion, cargandoPerfil, entrar, salir, recargarPerfil }),
    [session, perfil, cargandoSesion, cargandoPerfil, entrar, salir, recargarPerfil]
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useAuth(): ContextoAuth {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
