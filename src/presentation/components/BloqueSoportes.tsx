import { useState } from 'react'
import {
  AlertCircle,
  ExternalLink,
  FileCheck2,
  Hourglass,
  Paperclip,
  Undo2,
  Upload,
} from 'lucide-react'
import { cn, formatearFechaLarga } from '@/lib/utils'
import { useAuth } from '@/application/auth/AuthProvider'
import { useAdjuntos, useEntregarSoporte, abrirSoporte } from '@/application/solicitudes/useAdjuntos'
import type { SolicitudLista } from '@/application/solicitudes/useSolicitudes'
import { Button } from '@/presentation/components/ui/button'
import { CampoArchivo } from '@/presentation/components/CampoArchivo'

const ETIQUETA_MOMENTO = {
  previo: 'Entregado al solicitar',
  posterior: 'Entregado al regresar',
} as const

/**
 * Soportes de la solicitud.
 *
 * Sostiene el tramo final del trámite, que tiene tres papeles distintos:
 *
 * 1. `PENDIENTE_SOPORTE` — le toca al colaborador: sube el documento.
 * 2. `SOPORTE_EN_VALIDACION` — le toca a Talento Humano: lo valida y cierra,
 *    o lo devuelve explicando qué falta.
 * 3. Devuelto — vuelve al punto 1, con el motivo a la vista.
 *
 * Los archivos viven en un bucket privado —son datos de salud— y se abren con
 * una URL firmada que caduca en un minuto.
 */
export function BloqueSoportes({
  solicitud,
  puedeValidar,
  onValidar,
  onDevolver,
  procesando,
}: {
  solicitud: SolicitudLista
  /** Talento Humano cierra el trámite o devuelve el documento. */
  puedeValidar: boolean
  onValidar: () => void
  onDevolver: () => void
  procesando: boolean
}) {
  const { perfil, session } = useAuth()
  const { data: adjuntos, isLoading } = useAdjuntos(solicitud.id)
  const entregar = useEntregarSoporte()

  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const esSolicitante = solicitud.solicitante?.user_id === perfil?.user_id
  const faltaEntregar = solicitud.estado === 'PENDIENTE_SOPORTE'
  const enRevision = solicitud.estado === 'SOPORTE_EN_VALIDACION'
  // Solo el solicitante sube: así lo exige la policy de Storage.
  const puedeEntregar = faltaEntregar && esSolicitante
  const detalle = solicitud.detalle_permiso
  // Tras una devolución el motivo queda aquí, y hay que mostrarlo antes de
  // pedirle al colaborador que vuelva a intentarlo.
  const motivoDevolucion = faltaEntregar ? solicitud.observacion_decision : null

  async function entregarSoporte() {
    if (!archivo || !session) return
    setError(null)

    try {
      await entregar.mutateAsync({ solicitudId: solicitud.id, archivo, usuarioId: session.user.id })
      setArchivo(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible subir el soporte. Intenta de nuevo.')
    }
  }

  // Sin adjuntos y sin nada que hacer, el bloque solo sería ruido.
  if (!isLoading && (adjuntos ?? []).length === 0 && !puedeEntregar && !puedeValidar) return null

  return (
    <section
      className={cn(
        'bloque-datos p-5',
        faltaEntregar ? 'bloque-ambar' : enRevision ? 'bloque-violeta' : 'bloque-azul'
      )}
    >
      <h2 className="bloque-titulo mb-4 flex items-center gap-2">
        <Paperclip className="size-4" />
        Soportes
      </h2>

      {motivoDevolucion && (
        <div className="mb-4 rounded-md border border-[var(--tinte-rojo-borde)] bg-[var(--tinte-rojo)] p-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--error)]">
            Talento Humano devolvió el soporte
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{motivoDevolucion}</p>
        </div>
      )}

      {faltaEntregar && !motivoDevolucion && (
        <p className="mb-4 rounded-md border border-[var(--tinte-ambar-borde)] bg-[var(--tinte-ambar)] p-3 text-sm text-[var(--acento-ambar)]">
          Falta el soporte para poder cerrar este permiso
          {detalle?.fecha_limite_soporte && (
            <> · plazo hasta el {formatearFechaLarga(detalle.fecha_limite_soporte)}</>
          )}
          .
        </p>
      )}

      {enRevision && !puedeValidar && (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-[var(--tinte-violeta-borde)] bg-[var(--tinte-violeta)] p-3 text-sm text-[var(--acento-violeta)]">
          <Hourglass className="mt-0.5 size-4 shrink-0" />
          Ya entregaste el soporte. Talento Humano lo está revisando; si sirve, la solicitud queda
          cerrada.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando archivos…</p>
      ) : (adjuntos ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ningún archivo adjunto.</p>
      ) : (
        <ul className="space-y-2">
          {(adjuntos ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card/70 px-3 py-2 text-sm"
            >
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={a.nombre_archivo}>
                {a.nombre_archivo}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {ETIQUETA_MOMENTO[a.momento]}
                {a.tamano_bytes ? ` · ${(a.tamano_bytes / 1048576).toFixed(1)} MB` : ''}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() =>
                  void abrirSoporte(a.ruta_storage).catch(() =>
                    setError('No fue posible abrir el archivo.')
                  )
                }
              >
                <ExternalLink /> Ver
              </Button>
            </li>
          ))}
        </ul>
      )}

      {puedeEntregar && (
        <div className="mt-4 space-y-2">
          <CampoArchivo id="soporte-posterior" archivo={archivo} onCambio={setArchivo} obligatorio />
          <Button
            className="w-full sm:w-auto"
            disabled={!archivo}
            cargando={entregar.isPending}
            onClick={() => void entregarSoporte()}
          >
            {!entregar.isPending && <Upload />} Entregar soporte
          </Button>
        </div>
      )}

      {puedeValidar && (
        <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
          <p className="text-sm text-muted-foreground">
            Revisa el documento entregado. Si sirve, valídalo y el trámite queda cerrado; si no,
            devuélvelo indicando qué falta para que el colaborador suba otro.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="exito" cargando={procesando} onClick={onValidar}>
              {!procesando && <FileCheck2 />} Validar y cerrar
            </Button>
            <Button variant="outline" disabled={procesando} onClick={onDevolver}>
              <Undo2 /> Devolver soporte
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </section>
  )
}
