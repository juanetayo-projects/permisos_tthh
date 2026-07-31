import { useState } from 'react'
import { AlertCircle, ExternalLink, FileCheck2, Paperclip, Upload } from 'lucide-react'
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
 * Cierra el hueco que dejaba atascadas las solicitudes en «Pendiente de
 * soporte»: el motor de estados contemplaba ese paso, pero no había ninguna
 * pantalla desde donde entregar el documento ni desde donde verlo, así que
 * `PENDIENTE_SOPORTE → FINALIZADA` era inalcanzable.
 *
 * Los archivos viven en un bucket privado —son datos de salud— y se abren con
 * una URL firmada que caduca en un minuto.
 */
export function BloqueSoportes({
  solicitud,
  puedeValidar,
  onValidar,
  validando,
}: {
  solicitud: SolicitudLista
  /** Talento Humano cierra el trámite cuando el soporte le sirve. */
  puedeValidar: boolean
  onValidar: () => void
  validando: boolean
}) {
  const { perfil, session } = useAuth()
  const { data: adjuntos, isLoading } = useAdjuntos(solicitud.id)
  const entregar = useEntregarSoporte()

  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const esSolicitante = solicitud.solicitante?.user_id === perfil?.user_id
  const enEspera = solicitud.estado === 'PENDIENTE_SOPORTE'
  // Solo el solicitante sube: así lo exige la policy de Storage.
  const puedeEntregar = enEspera && esSolicitante
  const detalle = solicitud.detalle_permiso

  async function entregarSoporte() {
    if (!archivo || !session) return
    setError(null)

    try {
      await entregar.mutateAsync({
        solicitudId: solicitud.id,
        archivo,
        usuarioId: session.user.id,
      })
      setArchivo(null)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No fue posible subir el soporte. Intenta de nuevo.'
      )
    }
  }

  // Sin adjuntos y sin nada que hacer, el bloque solo sería ruido.
  if (!isLoading && (adjuntos ?? []).length === 0 && !puedeEntregar && !puedeValidar) return null

  return (
    <section className={cn('bloque-datos p-5', enEspera ? 'bloque-ambar' : 'bloque-azul')}>
      <h2 className="bloque-titulo mb-4 flex items-center gap-2">
        <Paperclip className="size-4" />
        Soportes
      </h2>

      {enEspera && (
        <p className="mb-4 rounded-md border border-[var(--tinte-ambar-borde)] bg-[var(--tinte-ambar)] p-3 text-sm text-[var(--acento-ambar)]">
          {detalle?.soporte_posterior_entregado
            ? 'El soporte ya está entregado. Talento Humano lo revisará para cerrar el trámite.'
            : 'Falta el soporte de este permiso para poder cerrarlo'}
          {!detalle?.soporte_posterior_entregado && detalle?.fecha_limite_soporte && (
            <> · plazo hasta el {formatearFechaLarga(detalle.fecha_limite_soporte)}</>
          )}
          .
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
                onClick={() => void abrirSoporte(a.ruta_storage).catch(() => setError('No fue posible abrir el archivo.'))}
              >
                <ExternalLink /> Ver
              </Button>
            </li>
          ))}
        </ul>
      )}

      {puedeEntregar && (
        <div className="mt-4 space-y-2">
          <CampoArchivo
            id="soporte-posterior"
            archivo={archivo}
            onCambio={setArchivo}
            obligatorio={!detalle?.soporte_posterior_entregado}
          />
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
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <p className="flex-1 text-sm text-muted-foreground">
            Si el soporte es correcto, valídalo para dar por finalizado el trámite.
          </p>
          <Button variant="exito" cargando={validando} onClick={onValidar}>
            {!validando && <FileCheck2 />} Validar soporte y finalizar
          </Button>
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
