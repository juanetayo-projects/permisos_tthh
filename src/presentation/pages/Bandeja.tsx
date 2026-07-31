import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { useDecidir, useSolicitudes, type SolicitudLista } from '@/application/solicitudes/useSolicitudes'
import { notificar, tipoNotificacionPara } from '@/application/solicitudes/api'
import { ESTADOS_BANDEJA, estadoTrasVistoBueno, type Estado } from '@/domain/estados'
import { TablaSolicitudes } from '@/presentation/components/TablaSolicitudes'
import { DialogoDecision, type TipoDecision } from '@/presentation/components/DialogoDecision'
import { Button } from '@/presentation/components/ui/button'

type Vista = 'coordinador' | 'th' | 'gerencia'

interface Config {
  titulo: string
  descripcion: string
  estados: Estado[]
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
    descripcion: 'Solicitudes de tu equipo esperando tu autorización como jefe directo.',
    estados: ESTADOS_BANDEJA.coordinador,
    etiquetaAprobar: 'Autorizar',
    estadoAprobado: () => 'PENDIENTE_TH',
    estadoRechazado: 'RECHAZADA_COORDINADOR',
    campoFecha: 'coord_fecha',
    campoActor: 'coord_actor_id',
    vacio: {
      titulo: 'No tienes solicitudes pendientes',
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
    descripcion: 'Solicitudes que llegan directamente a la Gerencia de Talento Humano.',
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

export default function Bandeja({ vista }: { vista: Vista }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const config = CONFIG[vista]

  const { data: solicitudes, isLoading } = useSolicitudes({ estados: config.estados })
  const decidir = useDecidir()

  const [dialogo, setDialogo] = useState<{ tipo: TipoDecision; ids: string[]; limpiar: () => void } | null>(null)

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
    <div className="mx-auto max-w-7xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{config.titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{config.descripcion}</p>
      </header>

      <TablaSolicitudes
        solicitudes={solicitudes ?? []}
        cargando={isLoading}
        seleccionables
        onAbrir={(s) => navigate(`/solicitud/${s.id}`)}
        vacio={config.vacio}
        accionesMasivas={(ids, limpiar) => (
          <>
            <Button
              variant="exito"
              size="sm"
              onClick={() => setDialogo({ tipo: 'aprobar', ids, limpiar })}
            >
              <CheckCircle2 /> {config.etiquetaAprobar}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDialogo({ tipo: 'rechazar', ids, limpiar })}
            >
              <XCircle /> Rechazar
            </Button>
          </>
        )}
      />

      <DialogoDecision
        abierto={Boolean(dialogo)}
        onCerrar={() => setDialogo(null)}
        tipo={dialogo?.tipo ?? 'aprobar'}
        cantidad={dialogo?.ids.length ?? 0}
        etiquetaAprobar={config.etiquetaAprobar}
        onConfirmar={aplicar}
      />
    </div>
  )
}
