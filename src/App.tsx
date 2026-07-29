import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/application/auth/AuthProvider'
import Login from '@/presentation/pages/Login'

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

/** Marcador temporal mientras se construyen los módulos (tareas 5 a 9). */
function EnConstruccion() {
  const { perfil, session, salir } = useAuth()
  return (
    <div className="min-h-dvh bg-background p-8">
      <div className="panel-relieve mx-auto max-w-xl space-y-3 p-8">
        <h1 className="text-lg font-semibold">Sesión iniciada</h1>
        <p className="text-sm text-muted-foreground">
          {perfil
            ? `${perfil.nombre} · ${perfil.rol} · ${perfil.estado}`
            : `${session?.user.email} — todavía no tienes un perfil de Permisos creado.`}
        </p>
        <p className="text-sm text-muted-foreground">
          Los módulos de solicitud, bandejas y dashboard están en construcción.
        </p>
        <button onClick={() => void salir()} className="text-sm text-[var(--cac-azul-contraste)] underline">
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function Rutas() {
  const { session, cargandoSesion } = useAuth()

  if (cargandoSesion) return <Cargando />

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={session ? <EnConstruccion /> : <Navigate to="/login" replace />} />
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
