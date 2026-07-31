import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, CheckCircle2, FileText, Plus } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { useSolicitudes } from '@/application/solicitudes/useSolicitudes'
import { ESTADOS, type Estado } from '@/domain/estados'
import { cn } from '@/lib/utils'
import { Pantalla } from '@/presentation/layouts/Pantalla'
import { TablaSolicitudes } from '@/presentation/components/TablaSolicitudes'
import { Button } from '@/presentation/components/ui/button'

const ACTIVOS: Estado[] = [
  'BORRADOR',
  'PENDIENTE_COORDINADOR',
  'APROBADA_COORDINADOR',
  'PENDIENTE_TH',
  'PENDIENTE_GERENCIA_TH',
  'PENDIENTE_SOPORTE',
  'SOPORTE_EN_VALIDACION',
]
const RESUELTAS: Estado[] = ['APROBADA_TH', 'FINALIZADA', 'ARCHIVADA']
const NEGADAS: Estado[] = ['RECHAZADA_COORDINADOR', 'RECHAZADA_TH', 'CANCELADA', 'VENCIDA']

const PESTANAS = [
  { clave: 'activas', etiqueta: 'En trámite', estados: ACTIVOS },
  { clave: 'resueltas', etiqueta: 'Aprobadas', estados: RESUELTAS },
  { clave: 'negadas', etiqueta: 'Rechazadas', estados: NEGADAS },
  { clave: 'todas', etiqueta: 'Todas', estados: [...ESTADOS] },
] as const

export default function MisSolicitudes() {
  const navigate = useNavigate()
  const ubicacion = useLocation()
  const { perfil } = useAuth()
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['clave']>('activas')

  const mensaje = (ubicacion.state as { mensaje?: string } | null)?.mensaje

  const { data: solicitudes, isLoading } = useSolicitudes(
    { soloPropias: true },
    perfil?.user_id
  )

  const estadosActivos = PESTANAS.find((p) => p.clave === pestana)!.estados

  const filtradas = useMemo(
    () => (solicitudes ?? []).filter((s) => estadosActivos.includes(s.estado)),
    [solicitudes, estadosActivos]
  )

  const conteo = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const p of PESTANAS) {
      mapa[p.clave] = (solicitudes ?? []).filter((s) => p.estados.includes(s.estado)).length
    }
    return mapa
  }, [solicitudes])

  return (
    <Pantalla
      titulo="Mis solicitudes"
      descripcion="Seguimiento de tus permisos y vacaciones."
      acciones={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate('/solicitar/permiso')}>
            <FileText /> Nuevo permiso
          </Button>
          <Button size="sm" onClick={() => navigate('/solicitar/vacaciones')}>
            <CalendarDays /> Nuevas vacaciones
          </Button>
        </>
      }
      barra={
        <div className="space-y-3">
          {mensaje && (
            <p className="flex items-center gap-2 rounded-md bg-[var(--exito-suave)] p-3 text-sm text-[var(--exito)]">
              <CheckCircle2 className="size-4 shrink-0" />
              {mensaje}
            </p>
          )}

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
        </div>
      }
    >
      <TablaSolicitudes
        solicitudes={filtradas}
        cargando={isLoading}
        columnasOcultas={['solicitante', 'area']}
        onAbrir={(s) => navigate(`/solicitud/${s.id}`)}
        vacio={{
          titulo: 'Todavía no tienes solicitudes aquí',
          descripcion: 'Crea un permiso o unas vacaciones desde los botones de arriba.',
        }}
      />

      {!isLoading && (solicitudes ?? []).length === 0 && (
        <div className="mt-3 flex shrink-0 justify-center">
          <Button onClick={() => navigate('/solicitar/permiso')}>
            <Plus /> Crear mi primera solicitud
          </Button>
        </div>
      )}
    </Pantalla>
  )
}
