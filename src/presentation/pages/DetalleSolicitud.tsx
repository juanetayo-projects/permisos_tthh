import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { useDecidir, useHistorial, useSolicitud } from '@/application/solicitudes/useSolicitudes'
import { notificar, tipoNotificacionPara } from '@/application/solicitudes/api'
import { ETIQUETA_ESTADO, estadoTrasVistoBueno, puedeEjecutar, type Estado } from '@/domain/estados'
import { formatearFecha, formatearFechaLarga } from '@/lib/utils'
import { BadgeEstado } from '@/presentation/components/ui/badge'
import { Button } from '@/presentation/components/ui/button'
import { Card } from '@/presentation/components/ui/card'
import { Skeleton } from '@/presentation/components/ui/skeleton'
import { DialogoDecision, type TipoDecision } from '@/presentation/components/DialogoDecision'

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm">{valor ?? '—'}</dd>
    </div>
  )
}

export default function DetalleSolicitud() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { perfil, session } = useAuth()
  const { data: s, isLoading } = useSolicitud(id)
  const { data: historial } = useHistorial(id)
  const decidir = useDecidir()

  const [dialogo, setDialogo] = useState<{ tipo: TipoDecision; destino: Estado; etiqueta: string } | null>(null)

  if (isLoading || !s) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const esVacaciones = s.tramite?.codigo === 'vacaciones'
  const esSolicitante = s.solicitante?.user_id === perfil?.user_id
  const coordinaElArea = perfil?.rol === 'coordinador' && perfil.area_id === s.area?.id

  const ctx = {
    estado: s.estado,
    rol: perfil?.rol ?? ('colaborador' as const),
    esSolicitante,
    coordinaElArea,
  }

  const puedeAprobarCoord = puedeEjecutar('aprobar_coordinador', ctx)
  const puedeAprobarTh = puedeEjecutar('aprobar_th', ctx)
  const puedeCancelar = puedeEjecutar('cancelar', ctx)

  async function aplicar(motivo: string | null) {
    if (!dialogo || !session || !s) return

    const ahora = new Date().toISOString()
    const esCoordinador = s.estado === 'PENDIENTE_COORDINADOR'

    await decidir.mutateAsync({
      ids: [s.id],
      estado: dialogo.destino,
      motivo,
      campos:
        dialogo.destino === 'CANCELADA'
          ? {}
          : esCoordinador
            ? { coord_fecha: ahora, coord_actor_id: session.user.id }
            : { th_fecha: ahora, th_actor_id: session.user.id },
    })

    const tipoNotif = tipoNotificacionPara(dialogo.destino)
    if (tipoNotif) await notificar(tipoNotif, s.id)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft /> Volver
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight tabular">
              {s.consecutivo ?? 'Borrador sin numerar'}
            </h1>
            <BadgeEstado estado={s.estado} />
            {s.extemporanea && (
              <span className="rounded-full bg-[var(--advertencia-suave)] px-2 py-0.5 text-xs font-medium text-[#8a6400] dark:text-[var(--advertencia)]">
                Extemporánea
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {s.tramite?.nombre} · formato {s.tramite?.codigo_formato} v{s.tramite?.version_formato}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(puedeAprobarCoord || puedeAprobarTh) && (
            <>
              <Button
                variant="exito"
                size="sm"
                onClick={() =>
                  setDialogo({
                    tipo: 'aprobar',
                    destino: puedeAprobarCoord
                      ? 'PENDIENTE_TH'
                      : s.estado === 'PENDIENTE_GERENCIA_TH'
                        ? 'FINALIZADA'
                        : estadoTrasVistoBueno(Boolean(s.detalle_permiso?.requiere_soporte_posterior)),
                    etiqueta: puedeAprobarCoord ? 'Autorizar' : 'Dar visto bueno',
                  })
                }
              >
                <CheckCircle2 /> {puedeAprobarCoord ? 'Autorizar' : 'Dar visto bueno'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  setDialogo({
                    tipo: 'rechazar',
                    destino: puedeAprobarCoord ? 'RECHAZADA_COORDINADOR' : 'RECHAZADA_TH',
                    etiqueta: 'Rechazar',
                  })
                }
              >
                <XCircle /> Rechazar
              </Button>
            </>
          )}
          {puedeCancelar && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogo({ tipo: 'rechazar', destino: 'CANCELADA', etiqueta: 'Cancelar solicitud' })}
            >
              <Ban /> Cancelar
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Información general
            </h2>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Dato etiqueta="Solicitante" valor={s.solicitante?.nombre} />
              <Dato etiqueta="Identificación" valor={s.solicitante?.documento} />
              <Dato etiqueta="Empresa" valor={s.empresa?.nombre} />
              <Dato etiqueta="Área o servicio" valor={s.area?.nombre} />
              <Dato etiqueta="Fecha de solicitud" valor={formatearFecha(s.fecha_solicitud)} />
              <Dato
                etiqueta="Periodo"
                valor={`${formatearFecha(s.fecha_inicio)}${s.fecha_fin !== s.fecha_inicio ? ` → ${formatearFecha(s.fecha_fin)}` : ''}`}
              />
            </dl>
          </Card>

          {!esVacaciones && s.detalle_permiso && (
            <Card className="p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Motivo del permiso
              </h2>
              <dl className="grid gap-4 sm:grid-cols-3">
                <Dato etiqueta="Categoría" valor={s.detalle_permiso.categoria?.nombre} />
                <Dato etiqueta="Motivo" valor={s.detalle_permiso.tipo?.nombre} />
                <Dato etiqueta="Remunerado" valor={s.detalle_permiso.remunerado ? 'Sí' : 'No'} />
                <Dato etiqueta="Hora de salida" valor={s.detalle_permiso.hora_salida?.slice(0, 5)} />
                <Dato etiqueta="Hora de regreso" valor={s.detalle_permiso.hora_regreso?.slice(0, 5)} />
                <Dato
                  etiqueta="Duración"
                  valor={`${s.detalle_permiso.horas_permiso ?? 0} h · ${s.detalle_permiso.dias_permiso ?? 0} días`}
                />
              </dl>

              {s.detalle_permiso.justificacion && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Justificación</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{s.detalle_permiso.justificacion}</p>
                </div>
              )}

              {s.detalle_permiso.requiere_compensacion && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Compensación del tiempo</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {s.detalle_permiso.plan_compensacion ?? 'Sin plan descrito'}
                  </p>
                </div>
              )}

              {s.detalle_permiso.requiere_soporte_posterior && !s.detalle_permiso.soporte_posterior_entregado && (
                <p className="mt-4 rounded-md bg-[var(--advertencia-suave)] p-3 text-sm text-[#8a6400] dark:text-[var(--advertencia)]">
                  Pendiente de soporte
                  {s.detalle_permiso.fecha_limite_soporte &&
                    ` · plazo hasta el ${formatearFechaLarga(s.detalle_permiso.fecha_limite_soporte)}`}
                  .
                </p>
              )}
            </Card>
          )}

          {esVacaciones && s.detalle_vacaciones && (
            <Card className="p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Periodo a disfrutar
              </h2>
              <dl className="grid gap-4 sm:grid-cols-3">
                <Dato etiqueta="Días que corresponden" valor={s.detalle_vacaciones.dias_corresponden} />
                <Dato etiqueta="Días a disfrutar" valor={s.detalle_vacaciones.dias_a_disfrutar} />
                <Dato etiqueta="Días pendientes" valor={s.detalle_vacaciones.dias_pendientes} />
                <Dato etiqueta="Días hábiles calculados" valor={s.detalle_vacaciones.dias_habiles_calculados} />
                <Dato
                  etiqueta="Se presenta a laborar"
                  valor={formatearFecha(s.detalle_vacaciones.fecha_reintegro)}
                />
                <Dato
                  etiqueta="Saldo validado por TH"
                  valor={
                    s.detalle_vacaciones.saldo_validado_en
                      ? formatearFecha(s.detalle_vacaciones.saldo_validado_en.slice(0, 10))
                      : 'Pendiente'
                  }
                />
              </dl>

              {s.observaciones && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Observaciones</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{s.observaciones}</p>
                </div>
              )}
            </Card>
          )}

          {s.motivo_rechazo && (
            <Card className="border-[var(--error)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--error)]">
                Causa del rechazo
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{s.motivo_rechazo}</p>
            </Card>
          )}
        </div>

        {/* --------------------------------------------------------- Trazabilidad */}
        <Card relieve className="h-fit p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial
          </h2>
          <ol className="space-y-3">
            {(historial ?? []).map((h) => (
              <li key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 size-2 rounded-full bg-[var(--cac-azul)]" />
                  <span className="w-px flex-1 bg-border" />
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-sm font-medium">{h.accion}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.actor_nombre ?? 'Sistema'} ·{' '}
                    {new Date(h.created_at).toLocaleString('es-CO', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ETIQUETA_ESTADO[h.estado_nuevo as Estado] ?? h.estado_nuevo}
                  </p>
                  {h.motivo && <p className="mt-1 text-xs italic">«{h.motivo}»</p>}
                </div>
              </li>
            ))}
            {(historial ?? []).length === 0 && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" /> Sin movimientos todavía.
              </li>
            )}
          </ol>
        </Card>
      </div>

      <DialogoDecision
        abierto={Boolean(dialogo)}
        onCerrar={() => setDialogo(null)}
        tipo={dialogo?.tipo ?? 'aprobar'}
        cantidad={1}
        etiquetaAprobar={dialogo?.etiqueta ?? 'Autorizar'}
        onConfirmar={aplicar}
      />
    </div>
  )
}
