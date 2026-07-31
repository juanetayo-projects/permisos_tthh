import { useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, Download, Search, ShieldAlert, UserPlus } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  useCambiarEstadoPerfil,
  useCambiarRol,
  useImportarUsuarios,
  usePerfiles,
  useUsuariosHeredados,
  type EstadoPerfil,
  type PerfilAdmin,
} from '@/application/admin/usePerfiles'
import { Button } from '@/presentation/components/ui/button'
import { DialogoNuevoUsuario } from '@/presentation/components/admin/DialogoNuevoUsuario'
import { ROLES, ETIQUETA_ROL, type Rol } from '@/domain/estados'
import { cn, formatearFecha } from '@/lib/utils'
import { Badge } from '@/presentation/components/ui/badge'
import { Input } from '@/presentation/components/ui/input'
import { SkeletonTabla } from '@/presentation/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

const ESTADOS: { valor: EstadoPerfil; etiqueta: string }[] = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'pendiente_validacion', etiqueta: 'Pendiente de validación' },
  { valor: 'inactivo', etiqueta: 'Inactivo' },
]

export function PanelUsuarios() {
  const { perfil: yo } = useAuth()
  const { data: perfiles, isLoading } = usePerfiles()
  const cambiarRol = useCambiarRol()
  const cambiarEstado = useCambiarEstadoPerfil()

  const { data: heredados } = useUsuariosHeredados()
  const importar = useImportarUsuarios()

  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mostrarHeredados, setMostrarHeredados] = useState(false)
  const [creando, setCreando] = useState(false)

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return perfiles ?? []
    return (perfiles ?? []).filter((p) =>
      [p.nombre, p.correo, p.documento, p.area?.nombre, ETIQUETA_ROL[p.rol]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t))
    )
  }, [perfiles, busqueda])

  const administradores = (perfiles ?? []).filter((p) => p.rol === 'administrador' && p.estado === 'activo')

  async function ejecutar(accion: () => Promise<void>) {
    setError(null)
    try {
      await accion()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible aplicar el cambio.')
    }
  }

  /**
   * Impide quedarse sin administradores.
   *
   * Es un error irreversible desde la propia aplicación: sin ningún admin
   * activo nadie podría volver a asignar el rol, y habría que entrar por la
   * base de datos a repararlo.
   */
  function esUltimoAdmin(p: PerfilAdmin): boolean {
    return p.rol === 'administrador' && p.estado === 'activo' && administradores.length <= 1
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Usuarios y roles</h2>
          <p className="text-sm text-muted-foreground">
            {(perfiles ?? []).length} persona{(perfiles ?? []).length === 1 ? '' : 's'} registrada
            {(perfiles ?? []).length === 1 ? '' : 's'}. Asignar roles es exclusivo del administrador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, correo o área…"
              className="pl-9"
              aria-label="Buscar usuarios"
            />
          </div>
          <Button onClick={() => setCreando(true)}>
            <UserPlus /> Nuevo usuario
          </Button>
        </div>
      </div>

      <DialogoNuevoUsuario abierto={creando} onCerrar={() => setCreando(false)} />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {/* ------------------------------------ Personas de Cambio de Turnos */}
      {(heredados ?? []).length > 0 && (
        <div className="bloque-datos bloque-ambar p-3">
          <button
            onClick={() => setMostrarHeredados((v) => !v)}
            className="flex w-full items-start justify-between gap-3 text-left"
            aria-expanded={mostrarHeredados}
          >
            <div>
              <p className="flex items-center gap-2 font-medium">
                <UserPlus className="size-4 shrink-0" />
                {(heredados ?? []).length} persona{(heredados ?? []).length === 1 ? '' : 's'} de Cambio
                de Turnos sin perfil aquí
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Comparten la cuenta con esta aplicación: pueden iniciar sesión, pero se quedarían sin
                poder hacer nada hasta que tengan perfil. Al importarlas quedan pendientes de que
                confirmes su servicio y jefe directo.
              </p>
            </div>
            <ChevronDown
              className={cn('mt-1 size-4 shrink-0 transition-transform', mostrarHeredados && 'rotate-180')}
            />
          </button>

          {mostrarHeredados && (
            <div className="mt-3 space-y-2">
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md bg-card/60 p-2 text-sm">
                {(heredados ?? []).map((u) => (
                  <li key={u.id} className="flex flex-wrap items-baseline justify-between gap-2 px-1 py-0.5">
                    <span className="font-medium">{u.nombre}</span>
                    <span className="text-xs text-muted-foreground">{u.correo}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  cargando={importar.isPending}
                  onClick={() => void ejecutar(() => importar.mutateAsync(heredados ?? []))}
                >
                  <Download /> Importar {(heredados ?? []).length} perfil
                  {(heredados ?? []).length === 1 ? '' : 'es'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <SkeletonTabla filas={5} columnas={5} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="tabla-cac w-full min-w-[52rem] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Persona</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Área</th>
                <th className="w-48 px-3 py-2.5 text-left font-semibold text-muted-foreground">Rol</th>
                <th className="w-52 px-3 py-2.5 text-left font-semibold text-muted-foreground">Estado</th>
                <th className="w-28 px-3 py-2.5 text-left font-semibold text-muted-foreground">Validado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const soyYo = p.user_id === yo?.user_id
                const bloqueado = esUltimoAdmin(p)

                return (
                  <tr key={p.user_id} className={cn('border-t border-border', p.estado === 'inactivo' && 'opacity-60')}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">
                        {p.nombre}
                        {soyYo && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.correo}</p>
                      {p.documento && <p className="text-xs text-muted-foreground tabular">{p.documento}</p>}
                    </td>

                    <td className="px-3 py-2.5">
                      <p>{p.area?.nombre ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{p.empresa?.nombre ?? ''}</p>
                    </td>

                    <td className="px-3 py-2.5">
                      <Select
                        value={p.rol}
                        disabled={bloqueado || cambiarRol.isPending}
                        onValueChange={(v) =>
                          void ejecutar(() => cambiarRol.mutateAsync({ userId: p.user_id, rol: v as Rol }))
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{ETIQUETA_ROL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {bloqueado && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-[#8a6400] dark:text-[var(--advertencia)]">
                          <ShieldAlert className="size-3 shrink-0" />
                          Único administrador activo
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      <Select
                        value={p.estado}
                        disabled={bloqueado || cambiarEstado.isPending}
                        onValueChange={(v) =>
                          void ejecutar(() =>
                            cambiarEstado.mutateAsync({ userId: p.user_id, estado: v as EstadoPerfil })
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS.map((e) => (
                            <SelectItem key={e.valor} value={e.valor}>{e.etiqueta}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="px-3 py-2.5">
                      {p.validado_en ? (
                        <span className="text-xs tabular">{formatearFecha(p.validado_en.slice(0, 10))}</span>
                      ) : (
                        <Badge tono="advertencia">Sin validar</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
