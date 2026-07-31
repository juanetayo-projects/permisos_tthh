import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  Inbox,
  Layers,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/application/auth/AuthProvider'
import type { Rol } from '@/domain/estados'

const LOGO_BLANCO = `${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`

interface Enlace {
  a: string
  etiqueta: string
  icono: typeof Inbox
  roles: Rol[]
}

const ENLACES: Enlace[] = [
  { a: '/', etiqueta: 'Inicio', icono: BarChart3, roles: ['colaborador', 'coordinador', 'analista_th', 'gerente_th', 'administrador'] },
  { a: '/solicitar/permiso', etiqueta: 'Solicitar permiso', icono: FileText, roles: ['colaborador', 'coordinador', 'analista_th', 'gerente_th', 'administrador'] },
  { a: '/solicitar/vacaciones', etiqueta: 'Solicitar vacaciones', icono: CalendarDays, roles: ['colaborador', 'coordinador', 'analista_th', 'gerente_th', 'administrador'] },
  { a: '/mis-solicitudes', etiqueta: 'Mis solicitudes', icono: ClipboardList, roles: ['colaborador', 'coordinador', 'analista_th', 'gerente_th', 'administrador'] },
  { a: '/bandeja/coordinador', etiqueta: 'Bandeja del área', icono: Inbox, roles: ['coordinador', 'administrador'] },
  { a: '/bandeja/th', etiqueta: 'Bandeja de Talento Humano', icono: Inbox, roles: ['analista_th', 'gerente_th', 'administrador'] },
  { a: '/bandeja/gerencia', etiqueta: 'Cesantías', icono: ShieldCheck, roles: ['gerente_th'] },
  // Las bandejas vacían lo ya decidido; esta es la única vista donde vuelve a
  // encontrarse una solicitud después de autorizarla.
  { a: '/solicitudes', etiqueta: 'Todas las solicitudes', icono: Layers, roles: ['analista_th', 'gerente_th', 'administrador'] },
  { a: '/validaciones', etiqueta: 'Validar colaboradores', icono: UserCheck, roles: ['analista_th', 'gerente_th', 'administrador'] },
  { a: '/dashboard', etiqueta: 'Dashboard', icono: BarChart3, roles: ['coordinador', 'analista_th', 'gerente_th', 'administrador'] },
  { a: '/administracion', etiqueta: 'Administración', icono: Settings, roles: ['administrador'] },
]

function useTemaOscuro() {
  const [oscuro, setOscuro] = useState(
    () =>
      localStorage.getItem('permisos-tema') === 'oscuro' ||
      (!localStorage.getItem('permisos-tema') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', oscuro)
    localStorage.setItem('permisos-tema', oscuro ? 'oscuro' : 'claro')
  }, [oscuro])

  return [oscuro, setOscuro] as const
}

/**
 * Menú del usuario. El requisito del cliente es explícito: el nombre va en la
 * esquina superior izquierda y el botón de cerrar sesión aparece justo debajo
 * al hacer clic sobre él.
 */
function MenuUsuario() {
  const { perfil, session, salir } = useAuth()
  const [abierto, setAbierto] = useState(false)

  const nombre = perfil?.nombre ?? session?.user.email ?? 'Usuario'
  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
          {iniciales || '·'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{nombre}</span>
          <span className="block truncate text-xs capitalize text-white/70">
            {perfil?.rol.replace('_', ' ') ?? 'sin perfil'}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-white/70 transition-transform', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div className="mt-1 overflow-hidden rounded-lg bg-white/10 p-1">
          <button
            onClick={() => void salir()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white transition-colors hover:bg-white/15"
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export function AppLayout() {
  const { perfil } = useAuth()
  const ubicacion = useLocation()
  const [oscuro, setOscuro] = useTemaOscuro()
  const [menuAbierto, setMenuAbierto] = useState(false)

  const rol = perfil?.rol ?? 'colaborador'
  const enlaces = ENLACES.filter((e) => e.roles.includes(rol))

  // En móvil, navegar cierra el menú lateral.
  useEffect(() => setMenuAbierto(false), [ubicacion.pathname])

  return (
    <div className="min-h-dvh bg-background lg:flex">
      {/* En escritorio va fija a la izquierda y no `sticky`: con `sticky` la
          franja azul solo medía una pantalla y, al bajar en el dashboard,
          debajo asomaba el fondo de la página. */}
      <aside
        className={cn(
          'franja-institucional flex w-full shrink-0 flex-col gap-4 p-4',
          'lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:overflow-y-auto',
          !menuAbierto && 'max-lg:pb-0'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {/* El nombre de la aplicación va debajo del logo institucional. */}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
            <img src={LOGO_BLANCO} alt="Clínica CAC Santa Bárbara" className="h-10 w-auto" />
            <div className="min-w-0 text-white">
              <p className="truncate text-sm font-semibold leading-tight">Permisos y Vacaciones</p>
              <p className="truncate text-[11px] text-white/70">Talento Humano</p>
            </div>
          </div>
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            className="rounded-md p-2 text-white hover:bg-white/10 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
        </div>

        <div className={cn('flex flex-1 flex-col gap-4', !menuAbierto && 'max-lg:hidden')}>
          <MenuUsuario />

          <nav className="flex-1 space-y-1">
            {enlaces.map(({ a, etiqueta, icono: Icono }) => (
              <NavLink
                key={a}
                to={a}
                end={a === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-white text-[var(--cac-azul)] shadow-sm' : 'text-white/85 hover:bg-white/10 hover:text-white'
                  )
                }
              >
                <Icono className="size-4 shrink-0" />
                <span className="truncate">{etiqueta}</span>
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setOscuro(!oscuro)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            {oscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {oscuro ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>
      </aside>

      {/* Margen contenido a propósito: los formatos TH-F-002 y TH-F-005 deben
          caber sin scroll en un portátil de 720 px de alto. */}
      {/* El padding izquierdo deja el hueco de la barra fija (18rem + 1.5rem).
          Se declara `pl` y `pr` por separado, y no `px` más un `pl`, para no
          depender del orden en que Tailwind emita las utilidades. */}
      <main className="min-w-0 flex-1 p-4 sm:p-5 lg:py-5 lg:pr-6 lg:pl-[19.5rem]">
        <Outlet />
      </main>
    </div>
  )
}
