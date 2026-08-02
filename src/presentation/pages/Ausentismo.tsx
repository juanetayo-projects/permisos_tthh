import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  CalendarX2,
  Download,
  FileSpreadsheet,
  Gauge,
  HeartPulse,
  Hourglass,
  Timer,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAusentismo, usePlantilla } from '@/application/ausentismo/useAusentismo'
import {
  useAreas,
  useCargos,
  useConfig,
  useEmpresas,
  useTipos,
} from '@/application/catalogos/useCatalogos'
import {
  aniosDisponibles,
  calcularIndicadores,
  mapaCalorAreaMes,
  porArea,
  porCargo,
  porColaborador,
  porMes,
  porMotivo,
  porNaturaleza,
  type FilaAgrupada,
} from '@/domain/ausentismo'
import {
  exportarAusentismoExcel,
  exportarAusentismoPdf,
  exportarResumenAusentismoExcel,
} from '@/infrastructure/export/ausentismo'
import {
  describirFiltroAusentismo,
  FiltrosAusentismo,
  FILTRO_AUSENTISMO_VACIO,
  type FiltroAusentismo,
} from '@/presentation/components/FiltrosAusentismo'
import { MapaCalor } from '@/presentation/components/MapaCalor'
import { MetricCard } from '@/presentation/components/MetricCard'
import { Button } from '@/presentation/components/ui/button'
import { Card } from '@/presentation/components/ui/card'
import { Skeleton } from '@/presentation/components/ui/skeleton'
import { useEsOscuro } from '@/presentation/hooks/useEsOscuro'

type Vista = 'colaborador' | 'area' | 'motivo' | 'cargo'

const VISTAS: { clave: Vista; etiqueta: string; columna: string }[] = [
  { clave: 'colaborador', etiqueta: 'Por colaborador', columna: 'Colaborador' },
  { clave: 'area', etiqueta: 'Por proceso o área', columna: 'Proceso o área' },
  { clave: 'motivo', etiqueta: 'Por motivo', columna: 'Motivo' },
  { clave: 'cargo', etiqueta: 'Por cargo', columna: 'Cargo' },
]

function Panel({
  titulo,
  descripcion,
  acciones,
  children,
}: {
  titulo: string
  descripcion?: string
  acciones?: React.ReactNode
  children: React.ReactNode
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

/**
 * Control de ausentismo.
 *
 * Es una pantalla distinta del panel ejecutivo porque responde a otra pregunta.
 * El dashboard mide el flujo —cuántas solicitudes entran, cuánto tardan—; aquí
 * se mide **tiempo no laborado**: cuánto, de quién y de qué proceso.
 *
 * Los índices siguen la GTC 3701 y los indicadores mínimos de la Resolución
 * 0312 de 2019, que es lo que audita la ARL. El denominador es la plantilla
 * activa, no la gente que faltó: dividir entre quienes se ausentaron daría
 * siempre un número alto y constante que no informa de nada.
 */
export default function Ausentismo() {
  const oscuro = useEsOscuro()
  const { data: filas, isLoading } = useAusentismo()
  const { data: plantilla } = usePlantilla()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: empresas } = useEmpresas()
  const { data: tipos } = useTipos()
  const { data: config } = useConfig()

  const [filtros, setFiltros] = useState<FiltroAusentismo>(() =>
    FILTRO_AUSENTISMO_VACIO(new Date().getFullYear())
  )
  const [vista, setVista] = useState<Vista>('colaborador')
  const [exportando, setExportando] = useState(false)

  const anios = useMemo(() => aniosDisponibles(filas ?? []), [filas])

  /** Filtrado en cliente: el volumen es bajo y así responde al instante. */
  const filtradas = useMemo(() => {
    const texto = filtros.texto.trim().toLowerCase()
    const porFechas = Boolean(filtros.desde || filtros.hasta)

    return (filas ?? []).filter((f) => {
      if (porFechas) {
        if (filtros.desde && f.fecha_inicio < filtros.desde) return false
        if (filtros.hasta && f.fecha_inicio > filtros.hasta) return false
      } else {
        if (f.anio !== filtros.anio) return false
        if (filtros.mes !== null && f.mes !== filtros.mes + 1) return false
      }

      if (filtros.areaId !== null && f.area_id !== filtros.areaId) return false
      if (filtros.cargoId !== null && f.cargo_id !== filtros.cargoId) return false
      if (filtros.empresaId !== null && f.empresa_id !== filtros.empresaId) return false
      if (filtros.tipoId !== null && f.tipo_id !== filtros.tipoId) return false
      if (filtros.naturaleza !== null && f.naturaleza !== filtros.naturaleza) return false
      if (filtros.tramite !== null && f.tramite !== filtros.tramite) return false

      if (texto) {
        const encaja =
          f.colaborador.toLowerCase().includes(texto) ||
          (f.documento ?? '').toLowerCase().includes(texto)
        if (!encaja) return false
      }

      return true
    })
  }, [filas, filtros])

  /**
   * Plantilla del denominador.
   *
   * Se acota al área filtrada: comparar el ausentismo de un servicio contra la
   * plantilla de toda la clínica daría un índice ridículamente bajo y haría
   * inútil el filtro por proceso, que es justo lo que se pidió.
   */
  const colaboradores = useMemo(() => {
    const lista = (plantilla ?? []).filter((p) => {
      if (filtros.areaId !== null && p.area_id !== filtros.areaId) return false
      if (filtros.cargoId !== null && p.cargo_id !== filtros.cargoId) return false
      if (filtros.empresaId !== null && p.empresa_id !== filtros.empresaId) return false
      return true
    })
    return lista.length
  }, [plantilla, filtros.areaId, filtros.cargoId, filtros.empresaId])

  const mesesDelPeriodo = useMemo(() => {
    if (filtros.desde && filtros.hasta) {
      const dias =
        (Date.parse(`${filtros.hasta}T00:00:00Z`) - Date.parse(`${filtros.desde}T00:00:00Z`)) /
        86_400_000
      return Math.max(1, Math.round(dias / 30))
    }
    return filtros.mes !== null ? 1 : 12
  }, [filtros.desde, filtros.hasta, filtros.mes])

  const indicadores = useMemo(
    () =>
      calcularIndicadores(filtradas, {
        colaboradores,
        mesesDelPeriodo,
        diasHabilesMes: Number(config?.dias_habiles_mes ?? 24),
        horasJornada: Number(config?.horas_jornada ?? 8),
      }),
    [filtradas, colaboradores, mesesDelPeriodo, config]
  )

  const agrupadas: FilaAgrupada[] = useMemo(() => {
    switch (vista) {
      case 'area':
        return porArea(filtradas)
      case 'motivo':
        return porMotivo(filtradas)
      case 'cargo':
        return porCargo(filtradas)
      default:
        return porColaborador(filtradas)
    }
  }, [vista, filtradas])

  const naturalezas = useMemo(() => porNaturaleza(filtradas), [filtradas])
  const serie = useMemo(() => porMes(filtradas, filtros.anio), [filtradas, filtros.anio])
  const calor = useMemo(() => mapaCalorAreaMes(filtradas, filtros.anio), [filtradas, filtros.anio])

  const textoFiltros = describirFiltroAusentismo(filtros, { areas, cargos, empresas, tipos })
  const vistaActual = VISTAS.find((v) => v.clave === vista)!

  async function exportar(formato: 'excel' | 'pdf' | 'resumen') {
    setExportando(true)
    try {
      if (formato === 'excel') await exportarAusentismoExcel(filtradas, textoFiltros)
      else if (formato === 'pdf') await exportarAusentismoPdf(filtradas, textoFiltros)
      else
        await exportarResumenAusentismoExcel(
          agrupadas,
          `Ausentismo ${vistaActual.etiqueta.toLowerCase()}`,
          textoFiltros
        )
    } finally {
      setExportando(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
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
          <h1 className="text-xl font-semibold tracking-tight">Control de ausentismo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtradas.length} ausencia{filtradas.length === 1 ? '' : 's'} ·{' '}
            {indicadores.colaboradoresConAusencia} colaborador
            {indicadores.colaboradoresConAusencia === 1 ? '' : 'es'} sobre una plantilla de{' '}
            {colaboradores}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" cargando={exportando} onClick={() => void exportar('excel')}>
            <FileSpreadsheet /> Detalle en Excel
          </Button>
          <Button variant="outline" size="sm" cargando={exportando} onClick={() => void exportar('pdf')}>
            <Download /> PDF
          </Button>
        </div>
      </header>

      <FiltrosAusentismo
        valores={filtros}
        onCambio={setFiltros}
        anios={anios}
        areas={areas}
        cargos={cargos}
        empresas={empresas}
        tipos={tipos}
      />

      {/* ------------------------------------------------------------- KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          etiqueta="Días perdidos"
          valor={indicadores.diasPerdidos}
          sufijo="días"
          icono={CalendarX2}
          tono="azul"
          detalle="Ausencias autorizadas en el periodo"
        />
        <MetricCard
          etiqueta="Horas perdidas"
          valor={indicadores.horasPerdidas}
          sufijo="h"
          icono={Timer}
          tono="teal"
          detalle={`De ${indicadores.horasProgramadas.toLocaleString('es-CO')} h programadas`}
        />
        <MetricCard
          etiqueta="Tiempo perdido"
          valor={indicadores.porcentajeTiempoPerdido ?? '—'}
          sufijo={indicadores.porcentajeTiempoPerdido !== null ? '%' : undefined}
          icono={Gauge}
          tono="advertencia"
          detalle="Horas perdidas sobre programadas"
        />
        <MetricCard
          etiqueta="Eventos"
          valor={indicadores.eventos}
          icono={Activity}
          tono="violeta"
          detalle={`${indicadores.colaboradoresConAusencia} colaboradores distintos`}
        />
        <MetricCard
          etiqueta="Índice de frecuencia"
          valor={indicadores.indiceFrecuencia ?? '—'}
          icono={Users}
          tono="neutro"
          detalle="GTC 3701 · base 240.000 h"
        />
        <MetricCard
          etiqueta="Índice de severidad"
          valor={indicadores.indiceSeveridad ?? '—'}
          icono={Hourglass}
          tono="neutro"
          detalle="GTC 3701 · base 240.000 h"
        />
        <MetricCard
          etiqueta="Duración media"
          valor={indicadores.duracionMedia ?? '—'}
          sufijo={indicadores.duracionMedia !== null ? 'días' : undefined}
          icono={Timer}
          tono="neutro"
          detalle="Días perdidos por evento"
        />
        <MetricCard
          etiqueta="Por causa médica"
          valor={indicadores.diasPorCausaMedica}
          sufijo="días"
          icono={HeartPulse}
          tono="error"
          detalle={
            indicadores.porcentajeCausaMedica !== null
              ? `${indicadores.porcentajeCausaMedica}% de los días perdidos`
              : 'Incapacidades y licencias'
          }
        />
      </div>

      {colaboradores === 0 && (
        <Card className="border-[var(--advertencia)] p-4">
          <p className="flex items-start gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#8a6400] dark:text-[var(--advertencia)]" />
            No hay colaboradores activos con este filtro, así que los índices no se pueden calcular.
            Revisa que los perfiles tengan área y cargo asignados en Validar colaboradores.
          </p>
        </Card>
      )}

      {/* --------------------------------------------------------- Gráficos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel titulo="Días perdidos por mes" descripcion={`Evolución en ${filtros.anio}`}>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={serie} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gDias" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16468E" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#16468E" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,.3)',
                  background: oscuro ? '#1e293b' : '#fff',
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="dias"
                name="Días perdidos"
                stroke="#16468E"
                fill="url(#gDias)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel titulo="Por naturaleza" descripcion="Días perdidos según el origen de la ausencia">
          {naturalezas.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Sin datos en el periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={naturalezas} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="etiqueta"
                  width={110}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid rgba(148,163,184,.3)',
                    background: oscuro ? '#1e293b' : '#fff',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="dias" name="Días" fill="#16468E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel titulo="Motivos con más días" descripcion="Los ocho principales">
          {(() => {
            const motivos = porMotivo(filtradas).slice(0, 8)
            if (motivos.length === 0) {
              return <p className="py-16 text-center text-sm text-muted-foreground">Sin datos en el periodo.</p>
            }
            const tope = motivos[0].dias || 1

            return (
              <ul className="space-y-2">
                {motivos.map((m) => (
                  <li key={m.clave}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate" title={m.etiqueta}>{m.etiqueta}</span>
                      <span className="shrink-0 font-medium tabular">{m.dias} d</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--cac-azul-500)] transition-all"
                        style={{ width: `${(m.dias / tope) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )
          })()}
        </Panel>
      </div>

      {/* ---------------------------------------------------- Mapa de calor */}
      <Panel
        titulo="Mapa de calor por proceso"
        descripcion="Días perdidos por área y mes"
      >
        <MapaCalor
          areas={calor.areas}
          celdas={calor.celdas}
          maximo={calor.maximo}
          oscuro={oscuro}
          unidad={['día perdido', 'días perdidos']}
        />
      </Panel>

      {/* -------------------------------------------------------- Desglose */}
      <Panel
        titulo="Detalle del ausentismo"
        descripcion="Cambia el corte sin perder los filtros de arriba"
        acciones={
          <Button variant="outline" size="sm" cargando={exportando} onClick={() => void exportar('resumen')}>
            <FileSpreadsheet /> Exportar este corte
          </Button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {VISTAS.map((v) => (
            <button
              key={v.clave}
              onClick={() => setVista(v.clave)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                vista === v.clave
                  ? 'bg-[var(--cac-azul)] text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {v.etiqueta}
            </button>
          ))}
        </div>

        {agrupadas.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay ausencias con los filtros aplicados.
          </p>
        ) : (
          <div className="max-h-[26rem] overflow-auto rounded-lg border border-border">
            <table className="tabla-cac w-full min-w-[44rem] text-sm">
              <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">{vistaActual.columna}</th>
                  <th className="px-3 py-2 text-right font-semibold">Eventos</th>
                  <th className="px-3 py-2 text-right font-semibold">Días</th>
                  <th className="px-3 py-2 text-right font-semibold">Horas</th>
                  <th className="px-3 py-2 text-right font-semibold">Causa médica</th>
                  {vista !== 'colaborador' && (
                    <th className="px-3 py-2 text-right font-semibold">Colaboradores</th>
                  )}
                  <th className="px-3 py-2 text-right font-semibold">Extemporáneas</th>
                </tr>
              </thead>
              <tbody>
                {agrupadas.map((f, i) => (
                  <tr key={f.clave} className="border-t border-border">
                    <td className="px-3 py-2 tabular text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="block font-medium">{f.etiqueta}</span>
                      {f.detalle && (
                        <span className="block text-xs text-muted-foreground">{f.detalle}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{f.eventos}</td>
                    <td className="px-3 py-2 text-right font-medium tabular">{f.dias}</td>
                    <td className="px-3 py-2 text-right tabular">{f.horas}</td>
                    <td className="px-3 py-2 text-right tabular">{f.diasCausaMedica}</td>
                    {vista !== 'colaborador' && (
                      <td className="px-3 py-2 text-right tabular">{f.colaboradores}</td>
                    )}
                    <td className="px-3 py-2 text-right tabular">
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

      <p className="pb-2 text-xs leading-relaxed text-muted-foreground">
        Índices calculados según la GTC 3701 sobre una base de 240.000 horas-hombre, con{' '}
        {Number(config?.dias_habiles_mes ?? 24)} días programados al mes y jornadas de{' '}
        {Number(config?.horas_jornada ?? 8)} horas —ambos editables en Administración—. No cuentan como
        ausentismo los trámites, las comisiones sindicales ni las capacitaciones institucionales:
        en esos casos el colaborador cumple una función, no falta.
      </p>
    </div>
  )
}
