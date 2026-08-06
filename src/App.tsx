import { lazy, Suspense } from 'react'
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
import SolicitudCesantias from '@/presentation/pages/SolicitudCesantias'
import MisSolicitudes from '@/presentation/pages/MisSolicitudes'
import DetalleSolicitud from '@/presentation/pages/DetalleSolicitud'
import Bandeja from '@/presentation/pages/Bandeja'
import SinPermiso from '@/presentation/pages/SinPermiso'

/**
 * El dashboard arrastra Recharts y ECharts (~1,4 MB). Cargarlo bajo demanda
 * evita que ese peso caiga sobre el colaborador que solo viene a pedir un
 * permiso y nunca abre el panel.
 */
const Dashboard = lazy(() => import('@/presentation/pages/Dashboard'))

/** Comparte el peso de Recharts y ECharts con el dashboard: también va perezoso. */
const Ausentismo = lazy(() => import('@/presentation/pages/Ausentismo'))

/** Solo la usa el administrador: no tiene por qué pesar en el arranque de todos. */
const Administracion = lazy(() => import('@/presentation/pages/Administracion'))
const Validaciones = lazy(() => import('@/presentation/pages/Validaciones'))
/** Solo lo abren los jefes directos y Talento Humano. */
const ReporteIncapacidad = lazy(() => import('@/presentation/pages/ReporteIncapacidad'))
/** Histórico completo: solo lo abren Talento Humano y administración. */
const TodasSolicitudes = lazy(() => import('@/presentation/pages/TodasSolicitudes'))
import type { Modulo } from '@/domain/modulos'
import { useModulosDelRol } from '@/application/admin/useAccesos'

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

/**
 * Puerta de una pantalla.
 *
 * Ya no lleva una lista de roles escrita a mano: pregunta por el módulo, y
 * quién entra a cada módulo se reparte desde Administración. Es la barrera de
 * navegación —lo que impide llegar tecleando la URL—, no la de los datos: esa
 * la siguen poniendo las policies, y por eso una casilla mal marcada aquí
 * enseña una pantalla, nunca información de más.
 */
function RutaPorModulo({ modulo, children }: { modulo: Modulo; children: React.ReactNode }) {
  const { perfil } = useAuth()
  const modulos = useModulosDelRol(perfil?.rol)

  if (!perfil || !modulos.includes(modulo)) return <SinPermiso />
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
          <Route
            path="/"
            element={
              <RutaPorModulo modulo="inicio">
                <Inicio />
              </RutaPorModulo>
            }
          />
          <Route
            path="/solicitar/permiso"
            element={
              <RutaPorModulo modulo="solicitar_permiso">
                <SolicitudPermiso />
              </RutaPorModulo>
            }
          />
          <Route
            path="/solicitar/vacaciones"
            element={
              <RutaPorModulo modulo="solicitar_vacaciones">
                <SolicitudVacaciones />
              </RutaPorModulo>
            }
          />
          <Route
            path="/solicitar/cesantias"
            element={
              <RutaPorModulo modulo="solicitar_cesantias">
                <SolicitudCesantias />
              </RutaPorModulo>
            }
          />
          <Route
            path="/incapacidades"
            element={
              <RutaPorModulo modulo="incapacidades">
                <Suspense fallback={<Cargando />}>
                  <ReporteIncapacidad />
                </Suspense>
              </RutaPorModulo>
            }
          />
          <Route
            path="/mis-solicitudes"
            element={
              <RutaPorModulo modulo="mis_solicitudes">
                <MisSolicitudes />
              </RutaPorModulo>
            }
          />
          {/* El detalle no se reparte por casillas: se llega a él desde
              cualquier listado, y quién puede abrirlo ya lo decide la policy
              de la solicitud. Ponerle módulo propio solo daría la forma de
              dejar a alguien con una lista de enlaces que no puede abrir. */}
          <Route path="/solicitud/:id" element={<DetalleSolicitud />} />
          <Route
            path="/bandeja/coordinador"
            element={
              <RutaPorModulo modulo="bandeja_area">
                <Bandeja vista="coordinador" />
              </RutaPorModulo>
            }
          />
          <Route
            path="/bandeja/th"
            element={
              <RutaPorModulo modulo="bandeja_th">
                <Bandeja vista="th" />
              </RutaPorModulo>
            }
          />
          <Route
            path="/bandeja/gerencia"
            element={
              <RutaPorModulo modulo="bandeja_cesantias">
                <Bandeja vista="gerencia" />
              </RutaPorModulo>
            }
          />
          <Route
            path="/solicitudes"
            element={
              <RutaPorModulo modulo="todas_solicitudes">
                <Suspense fallback={<Cargando />}>
                  <TodasSolicitudes />
                </Suspense>
              </RutaPorModulo>
            }
          />
          <Route
            path="/validaciones"
            element={
              <RutaPorModulo modulo="validaciones">
                <Suspense fallback={<Cargando />}>
                  <Validaciones />
                </Suspense>
              </RutaPorModulo>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RutaPorModulo modulo="dashboard">
                <Suspense fallback={<Cargando />}>
                  <Dashboard />
                </Suspense>
              </RutaPorModulo>
            }
          />
          <Route
            path="/ausentismo"
            element={
              <RutaPorModulo modulo="ausentismo">
                <Suspense fallback={<Cargando />}>
                  <Ausentismo />
                </Suspense>
              </RutaPorModulo>
            }
          />
          <Route
            path="/administracion"
            element={
              <RutaPorModulo modulo="administracion">
                <Suspense fallback={<Cargando />}>
                  <Administracion />
                </Suspense>
              </RutaPorModulo>
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
