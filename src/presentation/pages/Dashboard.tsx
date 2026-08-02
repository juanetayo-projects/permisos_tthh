import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  Hourglass,
  Palmtree,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { useSolicitudes, type SolicitudLista } from '@/application/solicitudes/useSolicitudes'
import { useAreas, useEmpresas } from '@/application/catalogos/useCatalogos'
import {
  APROBADAS,
  CON_SOPORTE_ABIERTO,
  EN_TRAMITE,
  aniosDisponibles,
  calcularKpis,
  mapaCalorAreaMes,
  porCategoria,
  porTipo,
  rankingAreas,
  tendenciaMensual,
  type SolicitudMetrica,
} from '@/domain/metricas'
import { exportarSolicitudesExcel, exportarSolicitudesPdf } from '@/infrastructure/export/solicitudes'
import { Card } from '@/presentation/components/ui/card'
import { Button } from '@/presentation/components/ui/button'
import { Skeleton } from '@/presentation/components/ui/skeleton'
import { MetricCard } from '@/presentation/components/MetricCard'
import { MapaCalor } from '@/presentation/components/MapaCalor'
import { TablaSolicitudes } from '@/presentation/components/TablaSolicitudes'
import {
  describirFiltros,
  FiltrosDashboard,
  FILTRO_VACIO,
  type ValoresFiltro,
} from '@/presentation/components/FiltrosDashboard'
import { useEsOscuro } from '@/presentation/hooks/useEsOscuro'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'

const COLORES = ['#0D2D6B', '#16468E', '#3B7DD8', '#7FA9E8', '#0F9D58', '#F4B400', '#D93025']

function Panel({
  titulo,
  descripcion,
  children,
  acciones,
}: {
  titulo: string
  descripcion?: string
  children: React.ReactNode
  acciones?: React.ReactNode
}) {
  return (
    <Card relieve className="flex flex-col p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {descripcion && <p className="text-xs text-muted-foreground">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const oscuro = useEsOscuro()
  const { data: areas } = useAreas()
  const { data: empresas } = useEmpresas()
  const { data: todas, isLoading } = useSolicitudes({})

  const [filtros, setFiltros] = useState<ValoresFiltro>(() => FILTRO_VACIO(new Date().getFullYear()))
  const [detalle, setDetalle] = useState<{ titulo: string; lista: SolicitudLista[] } | null>(null)
  const [exportando, setExportando] = useState(false)

  const anios = useMemo(
    () => aniosDisponibles((todas ?? []) as unknown as SolicitudMetrica[]),
    [todas]
  )

  /** Filtrado en cliente: el volumen es bajo y así los filtros responden al instante. */
  const filtradas = useMemo(() => {
    return (todas ?? []).filter((s) => {
      const f = new Date(`${s.fecha_inicio}T00:00:00`)
      if (f.getFullYear() !== filtros.anio) return false
      if (filtros.mes !== null && f.getMonth() !== filtros.mes) return false
      if (filtros.areaId !== null && s.area?.id !== filtros.areaId) return false
      if (filtros.empresaId !== null && s.empresa?.id !== filtros.empresaId) return false
      if (filtros.tramite !== null && s.tramite?.codigo !== filtros.tramite) return false
      if (filtros.estado !== null && s.estado !== filtros.estado) return false
      return true
    })
  }, [todas, filtros])

  const metricas = filtradas as unknown as SolicitudMetrica[]

  const kpis = useMemo(() => calcularKpis(metricas), [metricas])
  const tendencia = useMemo(() => tendenciaMensual(metricas, filtros.anio), [metricas, filtros.anio])
  const categorias = useMemo(() => porCategoria(metricas), [metricas])
  const tipos = useMemo(() => porTipo(metricas, 8), [metricas])
  const ranking = useMemo(() => rankingAreas(metricas), [metricas])
  const calor = useMemo(() => mapaCalorAreaMes(metricas, filtros.anio), [metricas, filtros.anio])

  const textoFiltros = describirFiltros(filtros, areas, empresas)

  function abrirDetalle(titulo: string, lista: SolicitudLista[]) {
    if (lista.length > 0) setDetalle({ titulo, lista })
  }

  async function exportar(formato: 'excel' | 'pdf') {
    setExportando(true)
    try {
      if (formato === 'excel') await exportarSolicitudesExcel(filtradas, textoFiltros)
      else await exportarSolicitudesPdf(filtradas, textoFiltros)
    } finally {
      setExportando(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Panel ejecutivo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Permisos y vacaciones · {filtradas.length} solicitud{filtradas.length === 1 ? '' : 'es'} en el periodo
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" cargando={exportando} onClick={() => void exportar('excel')}>
            <FileSpreadsheet /> Excel
          </Button>
          <Button variant="outline" size="sm" cargando={exportando} onClick={() => void exportar('pdf')}>
            <Download /> PDF
          </Button>
        </div>
      </header>

      <FiltrosDashboard
        valores={filtros}
        onCambio={setFiltros}
        anios={anios}
        areas={areas}
        empresas={empresas}
      />

      {/* ------------------------------------------------------------- KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          etiqueta="Solicitudes"
          valor={kpis.total}
          icono={ClipboardList}
          tono="azul"
          detalle="En el periodo filtrado"
          onClick={() => abrirDetalle('Todas las solicitudes del periodo', filtradas)}
        />
        <MetricCard
          etiqueta="En trámite"
          valor={kpis.enTramite}
          icono={Hourglass}
          tono="advertencia"
          // No todas esperan una decisión: las de PENDIENTE_SOPORTE ya están
          // autorizadas y lo que falta es el documento.
          detalle="Aún en el flujo"
          onClick={() =>
            abrirDetalle(
              'Solicitudes en trámite',
              filtradas.filter((s) => EN_TRAMITE.includes(s.estado))
            )
          }
        />
        <MetricCard
          etiqueta="Aprobadas"
          valor={kpis.aprobadas}
          icono={CheckCircle2}
          tono="exito"
          detalle={kpis.tasaAprobacion !== null ? `${kpis.tasaAprobacion}% de lo decidido` : 'Sin decisiones aún'}
          onClick={() =>
            abrirDetalle(
              'Solicitudes aprobadas',
              filtradas.filter((s) => APROBADAS.includes(s.estado))
            )
          }
        />
        <MetricCard
          etiqueta="Rechazadas"
          valor={kpis.rechazadas}
          icono={XCircle}
          tono="error"
          detalle="Por jefe directo o TH"
          onClick={() =>
            abrirDetalle(
              'Solicitudes rechazadas',
              filtradas.filter((s) => s.estado.startsWith('RECHAZADA'))
            )
          }
        />
        <MetricCard
          etiqueta="Horas de ausentismo"
          valor={kpis.horasAusentismo}
          sufijo="h"
          icono={Clock}
          tono="teal"
          detalle="Solo permisos aprobados"
        />
        <MetricCard
          etiqueta="Días de vacaciones"
          valor={kpis.diasVacaciones}
          sufijo="días"
          icono={Palmtree}
          tono="violeta"
          detalle="Aprobados en el periodo"
        />
        <MetricCard
          etiqueta="Ciclo promedio"
          valor={kpis.cicloPromedio ?? '—'}
          sufijo={kpis.cicloPromedio !== null ? 'días hábiles' : undefined}
          icono={CalendarClock}
          tono="neutro"
          detalle="Del envío a la decisión"
        />
        <MetricCard
          etiqueta="Extemporáneas"
          valor={kpis.extemporaneas}
          icono={TriangleAlert}
          tono="advertencia"
          detalle="Sin la antelación del formato"
          onClick={() => abrirDetalle('Solicitudes extemporáneas', filtradas.filter((s) => s.extemporanea))}
        />
      </div>

      {/* --------------------------------------------------------- Alertas */}
      {(kpis.soportesPendientes > 0 || kpis.enTramite > 0) && (
        <Card className="border-[var(--advertencia)] p-4">
          <div className="flex flex-wrap items-center gap-4">
            <AlarmClock className="size-5 shrink-0 text-[#8a6400] dark:text-[var(--advertencia)]" />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {kpis.soportesPendientes > 0 && (
                <button
                  className="underline-offset-4 hover:underline"
                  onClick={() =>
                    abrirDetalle(
                      'Pendientes de soporte',
                      filtradas.filter((s) => CON_SOPORTE_ABIERTO.includes(s.estado))
                    )
                  }
                >
                  <strong>{kpis.soportesPendientes}</strong> pendiente
                  {kpis.soportesPendientes === 1 ? '' : 's'} de entregar soporte
                </button>
              )}
              {kpis.enTramite > 0 && (
                <span>
                  <strong>{kpis.enTramite}</strong> esperando decisión
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* --------------------------------------------------------- Gráficos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          titulo="Tendencia mensual"
          descripcion={`Solicitudes por mes en ${filtros.anio}`}
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={tendencia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gPermisos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16468E" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#16468E" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gVacaciones" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F9D58" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#0F9D58" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gCesantias" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F4B400" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#F4B400" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,.3)',
                  background: oscuro ? '#1e293b' : '#fff',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="permisos"
                name="Permisos"
                stroke="#16468E"
                fill="url(#gPermisos)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="vacaciones"
                name="Vacaciones"
                stroke="#0F9D58"
                fill="url(#gVacaciones)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="cesantias"
                name="Cesantías"
                stroke="#F4B400"
                fill="url(#gCesantias)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel titulo="Por categoría" descripcion="Distribución del formato">
          {categorias.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Sin datos en el periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={categorias}
                  dataKey="valor"
                  nameKey="nombre"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {categorias.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid rgba(148,163,184,.3)',
                    background: oscuro ? '#1e293b' : '#fff',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel titulo="Motivos más frecuentes" descripcion="Los ocho principales">
          {tipos.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Sin datos en el periodo.</p>
          ) : (
            <ul className="space-y-2">
              {tipos.map((t, i) => (
                <li key={t.nombre}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate" title={t.nombre}>{t.nombre}</span>
                    <span className="shrink-0 font-medium tabular">{t.valor}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(t.valor / tipos[0].valor) * 100}%`,
                        background: COLORES[i % COLORES.length],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---------------------------------------------------- Mapa de calor */}
      <Panel
        titulo="Mapa de calor por área"
        descripcion="Solicitudes por área y mes · haz clic en una celda para ver el detalle"
      >
        <MapaCalor
          areas={calor.areas}
          celdas={calor.celdas}
          maximo={calor.maximo}
          oscuro={oscuro}
          onCelda={(area, mes) =>
            abrirDetalle(
              `${area} · mes ${mes + 1} de ${filtros.anio}`,
              filtradas.filter((s) => {
                const f = new Date(`${s.fecha_inicio}T00:00:00`)
                return (s.area?.nombre ?? 'Sin área') === area && f.getMonth() === mes
              })
            )
          }
        />
      </Panel>

      {/* -------------------------------------------------------- Ranking */}
      <Panel titulo="Ranking de áreas" descripcion="Ordenado por número de solicitudes">
        {ranking.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sin datos en el periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla-cac w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Área o servicio</th>
                  <th className="py-2 pr-3 text-right font-semibold">Solicitudes</th>
                  <th className="py-2 pr-3 text-right font-semibold">Horas</th>
                  <th className="py-2 pr-3 text-right font-semibold">Días</th>
                  <th className="py-2 text-right font-semibold">Extemporáneas</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((f, i) => (
                  <tr
                    key={f.area}
                    className="cursor-pointer border-b border-border last:border-0"
                    onClick={() =>
                      abrirDetalle(
                        `Solicitudes de ${f.area}`,
                        filtradas.filter((s) => (s.area?.nombre ?? 'Sin área') === f.area)
                      )
                    }
                  >
                    <td className="py-2 pr-3 tabular text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-3">{f.area}</td>
                    <td className="py-2 pr-3 text-right font-medium tabular">{f.solicitudes}</td>
                    <td className="py-2 pr-3 text-right tabular">{f.horas}</td>
                    <td className="py-2 pr-3 text-right tabular">{f.dias}</td>
                    <td className="py-2 text-right tabular">
                      {f.extemporaneas > 0 ? (
                        <span className="rounded-full bg-[var(--advertencia-suave)] px-2 py-0.5 text-xs font-medium text-[#8a6400] dark:text-[var(--advertencia)]">
                          {f.extemporaneas}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ------------------------------------------------ Detalle al clic */}
      <Dialog open={Boolean(detalle)} onOpenChange={(v) => !v && setDetalle(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{detalle?.titulo}</DialogTitle>
            <DialogDescription>
              {detalle?.lista.length} solicitud{detalle?.lista.length === 1 ? '' : 'es'} detrás de este dato.
            </DialogDescription>
          </DialogHeader>
          {detalle && (
            <TablaSolicitudes
              solicitudes={detalle.lista}
              cargando={false}
              columnasOcultas={['area']}
              onAbrir={(s) => {
                setDetalle(null)
                navigate(`/solicitud/${s.id}`)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
