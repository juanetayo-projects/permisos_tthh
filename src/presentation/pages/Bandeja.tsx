import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { useDecidir, useSolicitudes, type SolicitudLista } from '@/application/solicitudes/useSolicitudes'
import { notificar, tipoNotificacionPara } from '@/application/solicitudes/api'
import {
  ESTADOS,
  ESTADOS_APROBADOS,
  ESTADOS_BANDEJA,
  ESTADOS_EN_TRAMITE,
  ESTADOS_NEGADOS,
  estadoTrasVistoBueno,
  type Estado,
} from '@/domain/estados'
import { cn } from '@/lib/utils'
import { Pantalla } from '@/presentation/layouts/Pantalla'
import { TablaSolicitudes } from '@/presentation/components/TablaSolicitudes'
import { DialogoDecision, type TipoDecision } from '@/presentation/components/DialogoDecision'
import { Button } from '@/presentation/components/ui/button'

type Vista = 'coordinador' | 'th' | 'gerencia'

interface Config {
  titulo: string
  descripcion: string
  /** Estados sobre los que se puede decidir desde aquí. */
  estados: Estado[]
  /**
   * ¿Trae también lo ya resuelto?
   *
   * Solo la bandeja del área. Las de Talento Humano y Gerencia siguen siendo
   * listas de trabajo puras —lo decidido se consulta en «Todas las
   * solicitudes»—, y llenarlas de histórico les quitaría el sentido.
   */
  historicoCompleto?: boolean
  etiquetaAprobar: string
  /** Estado al que pasa la solicitud cuando se autoriza. */
  estadoAprobado: (s: SolicitudLista) => Estado
  estadoRechazado: Estado
  campoFecha: 'coord_fecha' | 'th_fecha'
  campoActor: 'coord_actor_id' | 'th_actor_id'
  vacio: { titulo: string; descripcion: string }
}

const CONFIG: Record<Vista, Config> = {
  coordinador: {
    titulo: 'Bandeja del área',
    descripcion:
      'Todas las solicitudes de tu equipo, en cualquier estado. Las que esperan tu autorización están en la primera pestaña.',
    estados: ESTADOS_BANDEJA.coordinador,
    historicoCompleto: true,
    etiquetaAprobar: 'Autorizar',
    estadoAprobado: () => 'PENDIENTE_TH',
    estadoRechazado: 'RECHAZADA_COORDINADOR',
    campoFecha: 'coord_fecha',
    campoActor: 'coord_actor_id',
    vacio: {
      titulo: 'No hay solicitudes en tu área',
      descripcion: 'Cuando alguien de tu área solicite un permiso o vacaciones, aparecerá aquí.',
    },
  },
  th: {
    titulo: 'Bandeja de Talento Humano',
    descripcion: 'Solicitudes ya autorizadas por el jefe directo, esperando el visto bueno.',
    estados: ESTADOS_BANDEJA.th,
    etiquetaAprobar: 'Dar visto bueno',
    // Una cita médica de más de 2 días queda esperando el soporte posterior.
    // Y si ya estaba esperándolo, el visto bueno es la validación de ese
    // soporte: sin este caso la solicitud volvía a su propio estado y se
    // quedaba dando vueltas en la bandeja.
    estadoAprobado: (s) =>
      s.estado === 'SOPORTE_EN_VALIDACION'
        ? 'FINALIZADA'
        : estadoTrasVistoBueno(Boolean(s.detalle_permiso?.requiere_soporte_posterior)),
    estadoRechazado: 'RECHAZADA_TH',
    campoFecha: 'th_fecha',
    campoActor: 'th_actor_id',
    vacio: {
      titulo: 'Bandeja al día',
      descripcion: 'No hay solicitudes esperando el visto bueno de Talento Humano.',
    },
  },
  gerencia: {
    titulo: 'Cesantías',
    descripcion: 'Solicitudes que llegan directamente a la Dirección de Talento Humano.',
    estados: ESTADOS_BANDEJA.gerencia,
    etiquetaAprobar: 'Aprobar',
    estadoAprobado: () => 'FINALIZADA',
    estadoRechazado: 'RECHAZADA_TH',
    campoFecha: 'th_fecha',
    campoActor: 'th_actor_id',
    vacio: {
      titulo: 'Sin solicitudes de cesantías',
      descripcion: 'Las solicitudes de cesantías llegan aquí sin pasar por el jefe directo.',
    },
  },
}

/**
 * Los montones de la bandeja del área.
 *
 * «Por autorizar» va primero y es la pestaña inicial: sigue siendo el trabajo
 * pendiente, que es a lo que se entra. El resto responde a la otra pregunta
 * del jefe —«¿en qué quedó lo que firmé la semana pasada?»—, que antes solo
 * podía contestar Talento Humano.
 */
const PESTANAS = [
  { clave: 'pendientes', etiqueta: 'Por autorizar', estados: ESTADOS_BANDEJA.coordinador },
  { clave: 'tramite', etiqueta: 'En trámite', estados: ESTADOS_EN_TRAMITE },
  { clave: 'aprobadas', etiqueta: 'Aprobadas', estados: ESTADOS_APROBADOS },
  { clave: 'negadas', etiqueta: 'Rechazadas', estados: ESTADOS_NEGADOS },
  { clave: 'todas', etiqueta: 'Todas', estados: [...ESTADOS] },
] as const

export default function Bandeja({ vista }: { vista: Vista }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const config = CONFIG[vista]

  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['clave']>('pendientes')

  // Con histórico no se filtra por estado en la consulta: el alcance ya lo
  // pone la policy —lo propio, lo del servicio o todo— y las pestañas reparten
  // en memoria, así que sus contadores no cuestan una consulta cada uno.
  const { data: solicitudes, isLoading } = useSolicitudes(
    config.historicoCompleto ? {} : { estados: config.estados }
  )

  const decidir = useDecidir()

  const [dialogo, setDialogo] = useState<{ tipo: TipoDecision; ids: string[]; limpiar: () => void } | null>(null)

  const estadosDePestana = PESTANAS.find((p) => p.clave === pestana)!.estados

  const visibles = useMemo(() => {
    if (!config.historicoCompleto) return solicitudes ?? []
    return (solicitudes ?? []).filter((s) => estadosDePestana.includes(s.estado))
  }, [solicitudes, estadosDePestana, config.historicoCompleto])

  const conteo = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const p of PESTANAS) {
      mapa[p.clave] = (solicitudes ?? []).filter((s) => p.estados.includes(s.estado)).length
    }
    return mapa
  }, [solicitudes])

  async function aplicar(motivo: string | null) {
    if (!dialogo || !session) return

    const seleccionadas = (solicitudes ?? []).filter((s) => dialogo.ids.includes(s.id))
    const ahora = new Date().toISOString()

    if (dialogo.tipo === 'rechazar') {
      await decidir.mutateAsync({
        ids: dialogo.ids,
        estado: config.estadoRechazado,
        motivo,
        campos: { [config.campoFecha]: ahora, [config.campoActor]: session.user.id },
      })
      const tipoNotif = tipoNotificacionPara(config.estadoRechazado)
      if (tipoNotif) await Promise.all(dialogo.ids.map((id) => notificar(tipoNotif, id)))
    } else {
      // El estado de destino depende de cada solicitud, así que se agrupan
      // por destino en vez de mandar una sola actualización para todas.
      const porEstado = new Map<Estado, string[]>()
      for (const s of seleccionadas) {
        const destino = config.estadoAprobado(s)
        porEstado.set(destino, [...(porEstado.get(destino) ?? []), s.id])
      }

      for (const [estado, ids] of porEstado) {
        await decidir.mutateAsync({
          ids,
          estado,
          motivo,
          campos: { [config.campoFecha]: ahora, [config.campoActor]: session.user.id },
        })
        const tipoNotif = tipoNotificacionPara(estado)
        if (tipoNotif) await Promise.all(ids.map((id) => notificar(tipoNotif, id)))
      }
    }

    dialogo.limpiar()
  }

  return (
    <Pantalla
      titulo={config.titulo}
      descripcion={config.descripcion}
      barra={
        config.historicoCompleto ? (
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
        ) : undefined
      }
    >
      <TablaSolicitudes
        solicitudes={visibles}
        cargando={isLoading}
        seleccionables
        onAbrir={(s) => navigate(`/solicitud/${s.id}`)}
        vacio={config.vacio}
        accionesMasivas={(ids, limpiar) => {
          // Autorizar solo tiene sentido sobre lo que sigue esperando decisión.
          // Al mezclar histórico en la misma tabla, seleccionar una solicitud
          // ya cerrada mandaba una transición imposible que RLS rechazaba con
          // un error críptico; ahora el botón sencillamente no está.
          const decidibles = ids.filter((id) =>
            config.estados.includes((solicitudes ?? []).find((s) => s.id === id)?.estado as Estado)
          )

          if (decidibles.length === 0) {
            return (
              <p className="text-sm text-muted-foreground">
                Ninguna de las seleccionadas espera tu decisión.
              </p>
            )
          }

          return (
            <>
              {decidibles.length < ids.length && (
                <p className="text-sm text-muted-foreground">
                  {decidibles.length} de {ids.length} esperan tu decisión; el resto ya está resuelto.
                </p>
              )}
              <Button
                variant="exito"
                size="sm"
                onClick={() => setDialogo({ tipo: 'aprobar', ids: decidibles, limpiar })}
              >
                <CheckCircle2 /> {config.etiquetaAprobar}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDialogo({ tipo: 'rechazar', ids: decidibles, limpiar })}
              >
                <XCircle /> Rechazar
              </Button>
            </>
          )
        }}
      />

      <DialogoDecision
        abierto={Boolean(dialogo)}
        onCerrar={() => setDialogo(null)}
        tipo={dialogo?.tipo ?? 'aprobar'}
        cantidad={dialogo?.ids.length ?? 0}
        etiquetaAprobar={config.etiquetaAprobar}
        onConfirmar={aplicar}
      />
    </Pantalla>
  )
}
