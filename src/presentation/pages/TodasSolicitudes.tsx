import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileDown, FileSpreadsheet, FilterX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSolicitudes } from '@/application/solicitudes/useSolicitudes'
import { useCatalogo } from '@/application/admin/useCatalogoCrud'
import { ESTADOS, type Estado } from '@/domain/estados'
import { exportarSolicitudesExcel, exportarSolicitudesPdf } from '@/infrastructure/export/solicitudes'
import { Pantalla } from '@/presentation/layouts/Pantalla'
import { TablaSolicitudes } from '@/presentation/components/TablaSolicitudes'
import { Button } from '@/presentation/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

const EN_TRAMITE: Estado[] = [
  'PENDIENTE_COORDINADOR',
  'APROBADA_COORDINADOR',
  'PENDIENTE_TH',
  'PENDIENTE_GERENCIA_TH',
  'PENDIENTE_SOPORTE',
  'SOPORTE_EN_VALIDACION',
]
const APROBADAS: Estado[] = ['APROBADA_TH', 'FINALIZADA', 'ARCHIVADA']
const NEGADAS: Estado[] = ['RECHAZADA_COORDINADOR', 'RECHAZADA_TH', 'CANCELADA', 'VENCIDA']

const PESTANAS = [
  { clave: 'todas', etiqueta: 'Todas', estados: [...ESTADOS] },
  { clave: 'tramite', etiqueta: 'En trámite', estados: EN_TRAMITE },
  { clave: 'aprobadas', etiqueta: 'Aprobadas', estados: APROBADAS },
  { clave: 'negadas', etiqueta: 'Rechazadas', estados: NEGADAS },
  { clave: 'borradores', etiqueta: 'Borradores', estados: ['BORRADOR' as Estado] },
] as const

const TODOS = '__todos__'

/**
 * Todas las solicitudes registradas.
 *
 * Las bandejas solo muestran lo que espera una decisión, así que en cuanto
 * alguien autoriza una solicitud esta desaparecía de la vista y no había
 * ninguna pantalla desde donde volver a encontrarla: quien administra se
 * quedaba sin saber qué pasó con ella. Aquí está el histórico completo.
 *
 * No hace falta filtrar por rol: la policy `permisos_solicitudes_select` ya
 * limita lo que cada quien puede leer.
 */
export default function TodasSolicitudes() {
  const navigate = useNavigate()
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['clave']>('todas')
  const [tramite, setTramite] = useState<string>(TODOS)
  const [area, setArea] = useState<string>(TODOS)
  const [exportando, setExportando] = useState(false)

  const { data: solicitudes, isLoading } = useSolicitudes({})
  const { data: areas } = useCatalogo<{ id: number; nombre: string }>('areas', 'nombre')

  const estadosPestana = PESTANAS.find((p) => p.clave === pestana)!.estados

  const porFiltros = useMemo(
    () =>
      (solicitudes ?? []).filter(
        (s) =>
          (tramite === TODOS || s.tramite?.codigo === tramite) &&
          (area === TODOS || String(s.area?.id) === area)
      ),
    [solicitudes, tramite, area]
  )

  const filtradas = useMemo(
    () => porFiltros.filter((s) => estadosPestana.includes(s.estado)),
    [porFiltros, estadosPestana]
  )

  const conteo = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const p of PESTANAS) {
      mapa[p.clave] = porFiltros.filter((s) => p.estados.includes(s.estado)).length
    }
    return mapa
  }, [porFiltros])

  const hayFiltros = pestana !== 'todas' || tramite !== TODOS || area !== TODOS

  const textoFiltros = [
    `Estado: ${PESTANAS.find((p) => p.clave === pestana)!.etiqueta}`,
    `Trámite: ${tramite === TODOS ? 'Todos' : tramite === 'permiso' ? 'Permisos' : 'Vacaciones'}`,
    `Área: ${area === TODOS ? 'Todas' : (areas?.find((a) => String(a.id) === area)?.nombre ?? '—')}`,
  ]

  async function exportar(formato: 'excel' | 'pdf') {
    setExportando(true)
    try {
      if (formato === 'excel') await exportarSolicitudesExcel(filtradas, textoFiltros)
      else await exportarSolicitudesPdf(filtradas, textoFiltros)
    } finally {
      setExportando(false)
    }
  }

  return (
    <Pantalla
      titulo="Todas las solicitudes"
      descripcion="Histórico completo, incluidas las que ya se decidieron y salieron de las bandejas."
      acciones={
        <>
          <Button
            variant="outline"
            size="sm"
            cargando={exportando}
            onClick={() => void exportar('excel')}
          >
            <FileSpreadsheet /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            cargando={exportando}
            onClick={() => void exportar('pdf')}
          >
            <FileDown /> PDF
          </Button>
        </>
      }
      barra={
        <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {PESTANAS.map((p) => (
            <button
              key={p.clave}
              onClick={() => setPestana(p.clave)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                pestana === p.clave
                  ? 'bg-[var(--cac-azul)] text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {p.etiqueta}
              <span className="ml-1.5 tabular opacity-70">{conteo[p.clave] ?? 0}</span>
            </button>
          ))}
        </div>

        <Select value={tramite} onValueChange={setTramite}>
          <SelectTrigger className="w-44" aria-label="Trámite">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los trámites</SelectItem>
            <SelectItem value="permiso">Permisos</SelectItem>
            <SelectItem value="vacaciones">Vacaciones</SelectItem>
          </SelectContent>
        </Select>

        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-56" aria-label="Área o servicio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las áreas</SelectItem>
            {(areas ?? []).map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Solo cuando hay algo que limpiar: un botón muerto es ruido. */}
        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPestana('todas')
              setTramite(TODOS)
              setArea(TODOS)
            }}
          >
            <FilterX /> Limpiar filtros
          </Button>
        )}
        </div>
      }
    >
      <TablaSolicitudes
        solicitudes={filtradas}
        cargando={isLoading}
        onAbrir={(s) => navigate(`/solicitud/${s.id}`)}
        vacio={{
          titulo: 'No hay solicitudes con estos filtros',
          descripcion: 'Prueba con otra pestaña, otro trámite u otra área.',
        }}
      />
    </Pantalla>
  )
}
