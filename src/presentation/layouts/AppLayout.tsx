import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
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
  PiggyBank,
  Settings,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/application/auth/AuthProvider'
import { ETIQUETA_ROL } from '@/domain/estados'
import { DEFINICION_MODULOS, type Modulo } from '@/domain/modulos'
import { useModulosDelRol } from '@/application/admin/useAccesos'
import { aplicarTema, guardarTema, temaOscuroGuardado } from '@/lib/tema'

const LOGO_BLANCO = `${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`

/**
 * El icono de cada módulo.
 *
 * Vive aquí y no en `domain/modulos.ts` porque un icono es presentación: el
 * dominio define qué módulos hay y la tabla `permisos_acceso_rol` quién entra
 * a cada uno, pero ninguno de los dos tiene por qué saber de Lucide.
 */
const ICONOS: Record<Modulo, typeof Inbox> = {
  inicio: BarChart3,
  solicitar_permiso: FileText,
  solicitar_vacaciones: CalendarDays,
  // Trámite propio y no un motivo del formulario de permisos: no tiene periodo,
  // ni horario, ni antelación que cumplir.
  solicitar_cesantias: PiggyBank,
  incapacidades: Stethoscope,
  mis_solicitudes: ClipboardList,
  bandeja_area: Inbox,
  bandeja_th: Inbox,
  bandeja_cesantias: ShieldCheck,
  // Las bandejas vacían lo ya decidido; esta es la única vista donde vuelve a
  // encontrarse una solicitud después de autorizarla.
  todas_solicitudes: Layers,
  validaciones: UserCheck,
  dashboard: BarChart3,
  // Va aparte del dashboard a propósito: aquel mide el flujo de solicitudes y
  // este, tiempo no laborado. Son preguntas distintas.
  ausentismo: Activity,
  administracion: Settings,
}

/**
 * Tema de la aplicación.
 *
 * Arranca en **oscuro** por decisión del cliente. Solo se respeta la
 * preferencia del sistema mientras la persona no haya elegido: en cuanto toca
 * el interruptor, manda su elección y se recuerda.
 */
function useTemaOscuro() {
  const [oscuro, setOscuro] = useState(temaOscuroGuardado)

  useEffect(() => {
    aplicarTema(oscuro)
    guardarTema(oscuro)
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
          {/* La etiqueta del catálogo, no el identificador con guiones bajos:
              `coordinador_sst` se leía como «coordinador sst». */}
          <span className="block truncate text-xs text-white/70">
            {perfil ? ETIQUETA_ROL[perfil.rol] : 'sin perfil'}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-white/70 transition-transform', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        // Fondo blanco y texto azul: sobre la franja institucional, un botón
        // translúcido se confundía con la propia barra y no se veía.
        <div className="mt-1.5 overflow-hidden rounded-lg">
          <button
            onClick={() => void salir()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-[var(--cac-azul)] shadow-md transition-colors hover:bg-[var(--cac-azul-50)]"
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

  // El orden lo pone el catálogo de módulos, no la tabla de accesos: así el
  // menú se lee igual para todo el mundo, tenga marcadas las casillas que
  // tenga.
  const modulos = useModulosDelRol(perfil?.rol)
  const enlaces = DEFINICION_MODULOS.filter((m) => modulos.includes(m.codigo))

  // En móvil, navegar cierra el menú lateral.
  useEffect(() => setMenuAbierto(false), [ubicacion.pathname])

  return (
    // Altura fija y sin scroll de página en escritorio: la ventana no se mueve
    // y cada pantalla decide qué zona suya se desplaza. Así las barras de
    // filtros y las acciones quedan siempre a la vista sin depender de
    // `sticky`, que exige justo lo contrario —que la página sí scrollee—.
    // En móvil se deja el desplazamiento normal: en 400 px de alto no cabe
    // nada y bloquearlo solo esconde contenido.
    <div className="min-h-dvh bg-background lg:flex lg:h-dvh lg:overflow-hidden">
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
            {enlaces.map(({ codigo, ruta, etiqueta }) => {
              const Icono = ICONOS[codigo]
              return (
              <NavLink
                key={codigo}
                to={ruta}
                end={ruta === '/'}
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
              )
            })}
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
      <main className="min-w-0 flex-1 p-4 sm:p-5 lg:h-dvh lg:overflow-hidden lg:py-5 lg:pr-6 lg:pl-[19.5rem]">
        <Outlet />
      </main>
    </div>
  )
}
