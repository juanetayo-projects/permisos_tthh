import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/application/auth/AuthProvider'
import { AppLayout } from '@/presentation/layouts/AppLayout'
import Login from '@/presentation/pages/Login'
import Registro from '@/presentation/pages/Registro'
import RecuperarClave from '@/presentation/pages/RecuperarClave'
import EstablecerClave from '@/presentation/pages/EstablecerClave'
import PerfilPendiente from '@/presentation/pages/PerfilPendiente'
import Verificar from '@/presentation/pages/Verificar'
import Inicio from '@/presentation/pages/Inicio'
import SolicitudPermiso from '@/presentation/pages/SolicitudPermiso'
import SolicitudVacaciones from '@/presentation/pages/SolicitudVacaciones'
import MisSolicitudes from '@/presentation/pages/MisSolicitudes'
import DetalleSolicitud from '@/presentation/pages/DetalleSolicitud'
import Bandeja from '@/presentation/pages/Bandeja'
import EnConstruccion from '@/presentation/pages/EnConstruccion'
import type { Rol } from '@/domain/estados'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

function Cargando() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm">Cargando…</p>
      </div>
    </div>
  )
}

/** Exige sesión, perfil creado y validado por Talento Humano. */
function RutaPrivada() {
  const { session, perfil, cargandoSesion, cargandoPerfil } = useAuth()

  if (cargandoSesion) return <Cargando />
  if (!session) return <Navigate to="/login" replace />
  if (cargandoPerfil && !perfil) return <Cargando />
  if (!perfil || perfil.estado !== 'activo') return <PerfilPendiente />

  return <Outlet />
}

function RutaPorRol({ roles, children }: { roles: Rol[]; children: React.ReactNode }) {
  const { perfil } = useAuth()
  if (!perfil || !roles.includes(perfil.rol)) {
    return <EnConstruccion modulo="No tienes permiso para ver esta sección" />
  }
  return <>{children}</>
}

function Rutas() {
  const { session, cargandoSesion } = useAuth()

  if (cargandoSesion) return <Cargando />

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/registro" element={session ? <Navigate to="/" replace /> : <Registro />} />
      <Route path="/recuperar" element={session ? <Navigate to="/" replace /> : <RecuperarClave />} />
      <Route path="/establecer-clave" element={<EstablecerClave />} />
      {/* Pública: destino del QR impreso en cada PDF. No exige sesión. */}
      <Route path="/verificar" element={<Verificar />} />
      <Route path="/bienvenida" element={<Navigate to="/" replace />} />

      <Route element={<RutaPrivada />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/solicitar/permiso" element={<SolicitudPermiso />} />
          <Route path="/solicitar/vacaciones" element={<SolicitudVacaciones />} />
          <Route path="/mis-solicitudes" element={<MisSolicitudes />} />
          <Route path="/solicitud/:id" element={<DetalleSolicitud />} />
          <Route
            path="/bandeja/coordinador"
            element={
              <RutaPorRol roles={['coordinador', 'administrador']}>
                <Bandeja vista="coordinador" />
              </RutaPorRol>
            }
          />
          <Route
            path="/bandeja/th"
            element={
              <RutaPorRol roles={['analista_th', 'gerente_th']}>
                <Bandeja vista="th" />
              </RutaPorRol>
            }
          />
          <Route
            path="/bandeja/gerencia"
            element={
              <RutaPorRol roles={['gerente_th']}>
                <Bandeja vista="gerencia" />
              </RutaPorRol>
            }
          />
          <Route
            path="/validaciones"
            element={
              <RutaPorRol roles={['analista_th', 'gerente_th', 'administrador']}>
                <EnConstruccion modulo="Validar colaboradores" />
              </RutaPorRol>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RutaPorRol roles={['coordinador', 'analista_th', 'gerente_th', 'administrador']}>
                <EnConstruccion modulo="Dashboard ejecutivo" />
              </RutaPorRol>
            }
          />
          <Route
            path="/administracion"
            element={
              <RutaPorRol roles={['administrador']}>
                <EnConstruccion modulo="Administración" />
              </RutaPorRol>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <Rutas />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
