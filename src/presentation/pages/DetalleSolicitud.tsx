import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  CalendarRange,
  CheckCircle2,
  Clock,
  MessageSquareQuote,
  Palmtree,
  Stethoscope,
  UserCheck,
  UserRound,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/application/auth/AuthProvider'
import { useDecidir, useHistorial, useSolicitud } from '@/application/solicitudes/useSolicitudes'
import { notificar, tipoNotificacionPara } from '@/application/solicitudes/api'
import {
  ETIQUETA_ESTADO,
  TONO_ESTADO,
  esSoporteDevuelto,
  estadoTrasVistoBueno,
  puedeEjecutar,
  type Estado,
} from '@/domain/estados'
import { formatearFecha } from '@/lib/utils'
import { BadgeEstado } from '@/presentation/components/ui/badge'
import { Button } from '@/presentation/components/ui/button'
import { Card } from '@/presentation/components/ui/card'
import { Skeleton } from '@/presentation/components/ui/skeleton'
import { DialogoDecision, type TipoDecision } from '@/presentation/components/DialogoDecision'
import { PanelDocumentos } from '@/presentation/components/PanelDocumentos'

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  const vacio = valor === null || valor === undefined || valor === ''

  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </dt>
      <dd className={cn('mt-1 text-sm', vacio ? 'text-muted-foreground' : 'font-medium')}>
        {vacio ? '—' : valor}
      </dd>
    </div>
  )
}

/**
 * Bloque de datos con franja de acento.
 *
 * Reutiliza las utilidades `bloque-*` del sistema en vez de inventar estilos:
 * el color agrupa los campos de un vistazo, que es lo que le faltaba a esta
 * pantalla cuando todo era una tarjeta blanca detrás de otra.
 */
function Bloque({
  titulo,
  icono: Icono,
  tinte,
  children,
}: {
  titulo: string
  icono: typeof UserRound
  tinte: 'azul' | 'violeta' | 'teal' | 'verde' | 'rojo'
  children: React.ReactNode
}) {
  return (
    <section className={cn('bloque-datos p-4', `bloque-${tinte}`)}>
      <h2 className="bloque-titulo mb-3 flex items-center gap-2">
        <Icono className="size-4" />
        {titulo}
      </h2>
      {children}
    </section>
  )
}

/** Texto largo dentro de un bloque, sobre superficie propia para que respire. */
function Parrafo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-md border border-border/60 bg-card/70 p-3">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{children}</p>
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

  const [dialogo, setDialogo] = useState<{
    tipo: TipoDecision
    destino: Estado
    etiqueta: string
  } | null>(null)

  if (isLoading || !s) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
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
  const puedeValidarSoporte = puedeEjecutar('validar_soporte', ctx)

  const tono = TONO_ESTADO[s.estado]
  const esDevolucion = dialogo?.destino === 'PENDIENTE_SOPORTE'

  // El historial viene en orden ascendente, así que el último es el paso actual.
  const soporteDevuelto = esSoporteDevuelto((historial ?? []).at(-1))

  /** El jefe ya firmó: la solicitud salió de su bandeja en algún momento. */
  const yaAutorizoElJefe = Boolean(s.coord_fecha)

  /** Cierra el trámite cuando Talento Humano da por bueno el soporte. */
  async function validarSoporte() {
    if (!session || !s) return

    await decidir.mutateAsync({
      ids: [s.id],
      estado: 'FINALIZADA',
      campos: { th_fecha: new Date().toISOString(), th_actor_id: session.user.id },
    })

    await notificar('finalizada', s.id)
  }


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
    // Altura fija: la ventana no scrollea. La cabecera y las acciones quedan
    // siempre visibles y, si el contenido no cabe, se desplaza dentro de su
    // columna. Con una solicitud normal cabe entero en un portátil de 720 px.
    <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:h-full lg:overflow-hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="-ml-2 shrink-0 self-start"
      >
        <ArrowLeft /> Volver
      </Button>

      {/* Cabecera con relieve: es el ancla de la pantalla, no una fila de texto. */}
      <header className="panel-relieve shrink-0 overflow-hidden">
        <div
          className={cn(
            'h-1 w-full',
            tono === 'exito' && 'bg-[var(--exito)]',
            tono === 'error' && 'bg-[var(--error)]',
            tono === 'advertencia' && 'bg-[var(--acento-ambar)]',
            tono === 'info' && 'bg-[var(--cac-azul-500)]',
            tono === 'neutro' && 'bg-border'
          )}
        />
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight tabular text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]">
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

            {/* Quién autoriza, en la cabecera y no solo en su bloque: es lo
                primero que quiere confirmar el solicitante, y en la columna
                izquierda puede quedar por debajo del pliegue. */}
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
              <UserCheck className="size-4 shrink-0 text-[var(--acento-teal)]" />
              <span className="text-muted-foreground">
                {yaAutorizoElJefe ? 'Autorizada por:' : 'Autoriza:'}
              </span>
              <strong>{s.coordinador?.nombre ?? 'sin jefe directo asignado'}</strong>
              {s.coordinador?.cargo && (
                <span className="text-muted-foreground">· {s.coordinador.cargo}</span>
              )}
              {/* Cuándo firmó: cierra el primer ciclo y da trazabilidad. */}
              {yaAutorizoElJefe && s.coord_fecha && (
                <span className="text-muted-foreground">
                  ·{' '}
                  {new Date(s.coord_fecha).toLocaleString('es-CO', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              )}
              {s.coordinador?.area?.nombre && (
                <span className="rounded-full bg-[var(--tinte-teal)] px-2 py-0.5 text-xs text-[var(--acento-teal)]">
                  {s.coordinador.area.nombre}
                </span>
              )}
            </p>
          </div>

          {/* Qué falta para cerrar, en la cabecera y en una sola frase: el
              estado dice dónde está, pero no qué se espera de quién. */}
          {s.estado === 'PENDIENTE_TH' && (
            <p className="w-full rounded-md border border-[var(--tinte-ambar-borde)] bg-[var(--tinte-ambar)] px-3 py-2 text-sm text-[var(--acento-ambar)]">
              El jefe directo ya autorizó. Falta el <strong>visto bueno de Talento Humano</strong>
              {s.detalle_permiso?.requiere_soporte_posterior
                ? ' y que el colaborador entregue después el soporte.'
                : ' para cerrar el trámite.'}
            </p>
          )}

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
        </div>
      </header>

      {/* La fila implícita se estira sola al alto de la rejilla —`align-content`
          vale `stretch` por defecto—, así que cada columna hereda la altura
          disponible y se desplaza por dentro. */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pr-1">
          <Bloque titulo="Información general" icono={UserRound} tinte="azul">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Dato etiqueta="Solicitante" valor={s.solicitante?.nombre} />
              <Dato etiqueta="Identificación" valor={s.solicitante?.documento} />
              <Dato etiqueta="Empresa" valor={s.empresa?.nombre} />
              <Dato etiqueta="Área o servicio" valor={s.area?.nombre} />
              <Dato etiqueta="Fecha de solicitud" valor={formatearFecha(s.fecha_solicitud)} />
              <Dato
                etiqueta="Periodo"
                valor={
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="size-3.5 text-muted-foreground" />
                    {formatearFecha(s.fecha_inicio)}
                    {s.fecha_fin !== s.fecha_inicio && ` → ${formatearFecha(s.fecha_fin)}`}
                  </span>
                }
              />
            </dl>
          </Bloque>

          {!esVacaciones && s.detalle_permiso && (
            <Bloque titulo="Motivo del permiso" icono={Stethoscope} tinte="violeta">
              <dl className="grid gap-3 sm:grid-cols-3">
                <Dato etiqueta="Categoría" valor={s.detalle_permiso.categoria?.nombre} />
                <Dato etiqueta="Motivo" valor={s.detalle_permiso.tipo?.nombre} />
                <Dato
                  etiqueta="Remunerado"
                  valor={
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        s.detalle_permiso.remunerado
                          ? 'bg-[var(--exito-suave)] text-[var(--exito)]'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {s.detalle_permiso.remunerado ? 'Sí' : 'No'}
                    </span>
                  }
                />
                <Dato etiqueta="Hora de salida" valor={s.detalle_permiso.hora_salida?.slice(0, 5)} />
                <Dato etiqueta="Hora de regreso" valor={s.detalle_permiso.hora_regreso?.slice(0, 5)} />
                <Dato
                  etiqueta="Duración"
                  valor={
                    <span className="tabular">
                      {s.detalle_permiso.horas_permiso ?? 0} h · {s.detalle_permiso.dias_permiso ?? 0} días
                    </span>
                  }
                />
              </dl>

              {s.detalle_permiso.justificacion && (
                <Parrafo etiqueta="Justificación">{s.detalle_permiso.justificacion}</Parrafo>
              )}

              {s.detalle_permiso.requiere_compensacion && (
                <Parrafo etiqueta="Compensación del tiempo">
                  {s.detalle_permiso.plan_compensacion ?? 'Sin plan descrito'}
                </Parrafo>
              )}

              {/* El aviso de soporte pendiente vive en el bloque de Soportes,
                  que además ofrece dónde entregarlo. */}
            </Bloque>
          )}

          {esVacaciones && s.detalle_vacaciones && (
            <Bloque titulo="Periodo a disfrutar" icono={Palmtree} tinte="teal">
              <dl className="grid gap-3 sm:grid-cols-3">
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

              {s.observaciones && <Parrafo etiqueta="Observaciones">{s.observaciones}</Parrafo>}
            </Bloque>
          )}

          {/* Quién autoriza vive en la cabecera, siempre visible. Tenerlo
              además aquí lo repetía y empujaba el resto fuera de pantalla. */}

          {/* Los soportes están en el panel de la derecha: ahí se ven mientras
              se leen los datos, en vez de empujarlos fuera de la pantalla. */}

          {/* La causa del rechazo y la observación de quien autoriza son cosas
              opuestas: nunca deben compartir color ni título. */}
          {s.motivo_rechazo && (
            <Bloque titulo="Causa del rechazo" icono={XCircle} tinte="rojo">
              <p className="whitespace-pre-wrap text-sm">{s.motivo_rechazo}</p>
            </Bloque>
          )}

          {s.observacion_decision && (
            <Bloque titulo="Observación de quien autorizó" icono={MessageSquareQuote} tinte="verde">
              <p className="whitespace-pre-wrap text-sm">{s.observacion_decision}</p>
            </Bloque>
          )}
        </div>

        {/* ------------------------------------------- Documentos y trazabilidad */}
        {/* Los documentos se llevan el espacio sobrante y el historial se queda
            con lo justo: al decidir se mira el soporte, no la cronología. */}
        <div className="flex min-h-0 flex-col gap-3">
          {!esVacaciones && (
            <PanelDocumentos
              solicitud={s}
              soporteDevuelto={soporteDevuelto}
              puedeValidar={puedeValidarSoporte}
              onValidar={() => void validarSoporte()}
              onDevolver={() =>
                setDialogo({
                  tipo: 'rechazar',
                  destino: 'PENDIENTE_SOPORTE',
                  etiqueta: 'Devolver soporte',
                })
              }
              procesando={decidir.isPending}
            />
          )}

          <Card relieve className="flex max-h-64 shrink-0 flex-col overflow-hidden p-3">
          <h2 className="mb-2 shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Historial
          </h2>
          <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {(historial ?? []).map((h, i, todos) => {
              const tonoPaso = TONO_ESTADO[h.estado_nuevo as Estado] ?? 'neutro'

              return (
                <li key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-card',
                        tonoPaso === 'exito' && 'bg-[var(--exito)]',
                        tonoPaso === 'error' && 'bg-[var(--error)]',
                        tonoPaso === 'advertencia' && 'bg-[var(--acento-ambar)]',
                        tonoPaso === 'info' && 'bg-[var(--cac-azul-500)]',
                        tonoPaso === 'neutro' && 'bg-muted-foreground'
                      )}
                    />
                    {i < todos.length - 1 && <span className="w-px flex-1 bg-border" />}
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
                    {h.motivo && (
                      <p className="mt-1 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                        «{h.motivo}»
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
            {(historial ?? []).length === 0 && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" /> Sin movimientos todavía.
              </li>
            )}
          </ol>
          </Card>
        </div>
      </div>

      <DialogoDecision
        abierto={Boolean(dialogo)}
        onCerrar={() => setDialogo(null)}
        tipo={dialogo?.tipo ?? 'aprobar'}
        cantidad={1}
        etiquetaAprobar={dialogo?.etiqueta ?? 'Autorizar'}
        etiquetaRechazar={dialogo?.etiqueta ?? 'Rechazar'}
        etiquetaMotivo={esDevolucion ? 'Qué falta en el soporte' : 'Causa del rechazo'}
        descripcionRechazo={
          esDevolucion
            ? 'El colaborador recibirá este texto por correo y podrá subir otro documento.'
            : 'El solicitante recibirá la causa por correo y quedará registrada en el historial.'
        }
        onConfirmar={aplicar}
      />
    </div>
  )
}
