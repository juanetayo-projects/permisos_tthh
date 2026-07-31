import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FileText,
  Inbox,
  Rows3,
  Search,
  X,
} from 'lucide-react'
import { cn, formatearFecha } from '@/lib/utils'
import type { SolicitudLista } from '@/application/solicitudes/useSolicitudes'
import { BadgeEstado } from '@/presentation/components/ui/badge'
import { Button } from '@/presentation/components/ui/button'
import { Checkbox } from '@/presentation/components/ui/checkbox'
import { Input } from '@/presentation/components/ui/input'
import { SkeletonTabla } from '@/presentation/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu'

type ClaveColumna =
  | 'consecutivo'
  | 'solicitante'
  | 'tramite'
  | 'motivo'
  | 'area'
  | 'fechas'
  | 'duracion'
  | 'estado'

interface Columna {
  clave: ClaveColumna
  titulo: string
  ancho?: string
  ordenable?: boolean
  valor: (s: SolicitudLista) => string
  celda: (s: SolicitudLista) => React.ReactNode
}

const COLUMNAS: Columna[] = [
  {
    clave: 'consecutivo',
    titulo: 'Consecutivo',
    ancho: 'w-36',
    ordenable: true,
    valor: (s) => s.consecutivo ?? 'Borrador',
    celda: (s) => (
      <span className="font-medium tabular">{s.consecutivo ?? <span className="text-muted-foreground">Borrador</span>}</span>
    ),
  },
  {
    clave: 'solicitante',
    titulo: 'Solicitante',
    ordenable: true,
    valor: (s) => s.solicitante?.nombre ?? '',
    celda: (s) => (
      <div className="min-w-0">
        <p className="truncate">{s.solicitante?.nombre ?? '—'}</p>
        <p className="truncate text-xs text-muted-foreground">{s.solicitante?.documento ?? ''}</p>
      </div>
    ),
  },
  {
    clave: 'tramite',
    titulo: 'Trámite',
    ancho: 'w-32',
    ordenable: true,
    valor: (s) => s.tramite?.nombre ?? '',
    celda: (s) => (
      <span className="inline-flex items-center gap-1.5 text-sm">
        {s.tramite?.codigo === 'vacaciones' ? (
          <CalendarDays className="size-3.5 text-muted-foreground" />
        ) : (
          <FileText className="size-3.5 text-muted-foreground" />
        )}
        {s.tramite?.codigo === 'vacaciones' ? 'Vacaciones' : 'Permiso'}
      </span>
    ),
  },
  {
    clave: 'motivo',
    titulo: 'Motivo',
    valor: (s) => s.detalle_permiso?.tipo?.nombre ?? (s.detalle_vacaciones ? 'Periodo de vacaciones' : ''),
    celda: (s) => (
      <span className="block truncate text-sm">
        {s.detalle_permiso?.tipo?.nombre ?? (s.detalle_vacaciones ? 'Periodo de vacaciones' : '—')}
      </span>
    ),
  },
  {
    clave: 'area',
    titulo: 'Área',
    valor: (s) => s.area?.nombre ?? '',
    celda: (s) => <span className="block truncate text-sm">{s.area?.nombre ?? '—'}</span>,
  },
  {
    clave: 'fechas',
    titulo: 'Periodo',
    ancho: 'w-44',
    ordenable: true,
    valor: (s) => s.fecha_inicio,
    celda: (s) => (
      <span className="text-sm tabular">
        {formatearFecha(s.fecha_inicio)}
        {s.fecha_fin !== s.fecha_inicio && ` → ${formatearFecha(s.fecha_fin)}`}
      </span>
    ),
  },
  {
    clave: 'duracion',
    titulo: 'Duración',
    ancho: 'w-28',
    valor: (s) =>
      s.detalle_vacaciones
        ? `${s.detalle_vacaciones.dias_a_disfrutar ?? 0} días`
        : `${s.detalle_permiso?.horas_permiso ?? 0} h`,
    celda: (s) => (
      <span className="text-sm tabular">
        {s.detalle_vacaciones
          ? `${s.detalle_vacaciones.dias_a_disfrutar ?? 0} días`
          : `${s.detalle_permiso?.horas_permiso ?? 0} h`}
      </span>
    ),
  },
  {
    clave: 'estado',
    titulo: 'Estado',
    ancho: 'w-56',
    ordenable: true,
    valor: (s) => s.estado,
    celda: (s) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <BadgeEstado estado={s.estado} />
        {s.extemporanea && (
          <span
            className="rounded-full bg-[var(--advertencia-suave)] px-2 py-0.5 text-[10px] font-medium text-[#8a6400] dark:text-[var(--advertencia)]"
            title="Presentada sin la antelación que exige el formato"
          >
            Extemporánea
          </span>
        )}
      </div>
    ),
  },
]

const POR_PAGINA = 25

export function TablaSolicitudes({
  solicitudes,
  cargando,
  columnasOcultas = [],
  seleccionables = false,
  onAbrir,
  accionesMasivas,
  vacio,
}: {
  solicitudes: SolicitudLista[]
  cargando: boolean
  columnasOcultas?: ClaveColumna[]
  seleccionables?: boolean
  onAbrir?: (s: SolicitudLista) => void
  accionesMasivas?: (ids: string[], limpiar: () => void) => React.ReactNode
  vacio?: { titulo: string; descripcion: string }
}) {
  const buscador = useRef<HTMLInputElement>(null)
  const [busqueda, setBusqueda] = useState('')
  const [ocultas, setOcultas] = useState<Set<ClaveColumna>>(new Set(columnasOcultas))
  const [compacta, setCompacta] = useState(false)
  const [orden, setOrden] = useState<{ clave: ClaveColumna; asc: boolean }>({
    clave: 'fechas',
    asc: false,
  })
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [pagina, setPagina] = useState(0)

  // Atajo: "/" enfoca la búsqueda, como en Linear o GitHub.
  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      const enCampo = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      if (e.key === '/' && !enCampo) {
        e.preventDefault()
        buscador.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === buscador.current) {
        setBusqueda('')
        buscador.current?.blur()
      }
    }
    window.addEventListener('keydown', onTecla)
    return () => window.removeEventListener('keydown', onTecla)
  }, [])

  const columnas = useMemo(() => COLUMNAS.filter((c) => !ocultas.has(c.clave)), [ocultas])

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const base = texto
      ? solicitudes.filter((s) =>
          COLUMNAS.some((c) => c.valor(s).toLowerCase().includes(texto))
        )
      : solicitudes

    const col = COLUMNAS.find((c) => c.clave === orden.clave)
    if (!col) return base

    return [...base].sort((a, b) => {
      const r = col.valor(a).localeCompare(col.valor(b), 'es', { numeric: true })
      return orden.asc ? r : -r
    })
  }, [solicitudes, busqueda, orden])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas - 1)
  const visibles = filtradas.slice(paginaSegura * POR_PAGINA, (paginaSegura + 1) * POR_PAGINA)

  const idsVisibles = visibles.map((s) => s.id)
  const todasSeleccionadas = idsVisibles.length > 0 && idsVisibles.every((id) => seleccion.has(id))

  function alternarTodas() {
    setSeleccion((prev) => {
      const s = new Set(prev)
      if (todasSeleccionadas) idsVisibles.forEach((id) => s.delete(id))
      else idsVisibles.forEach((id) => s.add(id))
      return s
    })
  }

  const limpiarSeleccion = () => setSeleccion(new Set())

  return (
    // Columna de altura completa: la barra de filtros y la de acciones no se
    // mueven, y el desplazamiento ocurre dentro del contenedor de la tabla.
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* ------------------------------------------------------ Barra de filtros */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={buscador}
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPagina(0)
            }}
            placeholder="Buscar por consecutivo, solicitante, motivo…  (/)"
            className="pl-9 pr-9"
            aria-label="Buscar solicitudes"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCompacta((v) => !v)}
          title="Alternar densidad de las filas"
        >
          <Rows3 />
          {compacta ? 'Cómoda' : 'Compacta'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 /> Columnas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNAS.map((c) => (
              <DropdownMenuItem
                key={c.clave}
                onSelect={(e) => {
                  e.preventDefault()
                  setOcultas((prev) => {
                    const s = new Set(prev)
                    if (s.has(c.clave)) s.delete(c.clave)
                    else s.add(c.clave)
                    return s
                  })
                }}
              >
                <Checkbox checked={!ocultas.has(c.clave)} className="pointer-events-none" />
                {c.titulo}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* -------------------------------------------------------------- Contenido */}
      {cargando ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <SkeletonTabla filas={6} columnas={columnas.length} />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">
            {busqueda ? 'Sin resultados para esa búsqueda' : (vacio?.titulo ?? 'No hay solicitudes')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {busqueda
              ? 'Prueba con otro texto o limpia el filtro.'
              : (vacio?.descripcion ?? 'Cuando existan solicitudes aparecerán aquí.')}
          </p>
        </div>
      ) : (
        <>
          {/* El scroll vive aquí, no en la página. `min-h-0` deja que este hijo
              se encoja; sin él el contenedor crece con la tabla y arrastra a
              la ventana entera. El encabezado sigue `sticky`, pero ahora
              respecto a esta caja, que es lo que se desplaza. */}
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
            <table className="tabla-cac w-full min-w-[52rem] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_var(--border)]">
                <tr>
                  {seleccionables && (
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox
                        checked={todasSeleccionadas}
                        onCheckedChange={alternarTodas}
                        aria-label="Seleccionar todas las de esta página"
                      />
                    </th>
                  )}
                  {columnas.map((c) => (
                    <th
                      key={c.clave}
                      className={cn('px-3 py-2.5 text-left font-semibold text-muted-foreground', c.ancho)}
                    >
                      {c.ordenable ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOrden((o) =>
                              o.clave === c.clave ? { clave: c.clave, asc: !o.asc } : { clave: c.clave, asc: true }
                            )
                          }
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {c.titulo}
                          <ArrowUpDown
                            className={cn('size-3', orden.clave === c.clave ? 'text-foreground' : 'opacity-40')}
                          />
                        </button>
                      ) : (
                        c.titulo
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibles.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => onAbrir?.(s)}
                    className={cn(
                      'border-t border-border transition-colors',
                      onAbrir && 'cursor-pointer',
                      seleccion.has(s.id) && 'bg-[var(--info-suave)]!'
                    )}
                  >
                    {seleccionables && (
                      <td className={cn('px-3', compacta ? 'py-1.5' : 'py-3')} onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={seleccion.has(s.id)}
                          onCheckedChange={(v) =>
                            setSeleccion((prev) => {
                              const n = new Set(prev)
                              if (v === true) n.add(s.id)
                              else n.delete(s.id)
                              return n
                            })
                          }
                          aria-label={`Seleccionar ${s.consecutivo ?? 'borrador'}`}
                        />
                      </td>
                    )}
                    {columnas.map((c) => (
                      <td key={c.clave} className={cn('px-3 align-middle', compacta ? 'py-1.5' : 'py-3')}>
                        {c.celda(s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ------------------------------------------------------- Pie de tabla */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p className="tabular">
              {filtradas.length} solicitud{filtradas.length === 1 ? '' : 'es'}
              {busqueda && ` de ${solicitudes.length}`}
            </p>

            {totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaSegura === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft /> Anterior
                </Button>
                <span className="tabular">
                  {paginaSegura + 1} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaSegura >= totalPaginas - 1}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* --------------------------------------------------- Acciones en lote */}
      {seleccionables && seleccion.size > 0 && accionesMasivas && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="text-sm font-medium">
            {seleccion.size} seleccionada{seleccion.size === 1 ? '' : 's'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {accionesMasivas([...seleccion], limpiarSeleccion)}
            <Button variant="ghost" size="sm" onClick={limpiarSeleccion}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
