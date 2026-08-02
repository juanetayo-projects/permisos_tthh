import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ExternalLink,
  FileCheck2,
  FileText,
  Files,
  Hourglass,
  Maximize2,
  Undo2,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  abrirSoporte,
  useAdjuntos,
  useEntregarSoporte,
  useUrlsAdjuntos,
  type Adjunto,
} from '@/application/solicitudes/useAdjuntos'
import { documentosDelTipo, useMatrizDocumentos } from '@/application/catalogos/useCatalogos'
import type { SolicitudLista } from '@/application/solicitudes/useSolicitudes'
import { avisoDeVencimiento, evaluarChecklist } from '@/domain/soportes'
import { aISO } from '@/domain/festivos'
import { Button } from '@/presentation/components/ui/button'
import { CampoArchivo } from '@/presentation/components/CampoArchivo'
import { ListaDocumentos } from '@/presentation/components/ListaDocumentos'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

const ETIQUETA_MOMENTO = {
  previo: 'Al solicitar',
  posterior: 'Al regresar',
} as const

const esImagen = (a: Adjunto) => (a.mime ?? '').startsWith('image/')

/**
 * Documentos de la solicitud: vista previa y gestión, en un solo sitio.
 *
 * Antes había dos piezas —una lista de soportes en la columna principal y este
 * panel— que mostraban los mismos archivos, y entre las dos empujaban el
 * detalle por debajo del pliegue. Aquí se unen: el documento se ve mientras se
 * leen los datos de la solicitud, que es lo que necesita quien decide.
 *
 * Las miniaturas son el archivo real —un PDF incrustado sin barras, una imagen
 * recortada—, no un icono genérico, y se amplían en modal para no perder el
 * contexto de la solicitud.
 */
export function PanelDocumentos({
  solicitud,
  soporteDevuelto,
  puedeValidar,
  onValidar,
  onDevolver,
  procesando,
}: {
  solicitud: SolicitudLista
  /** El soporte volvió de Talento Humano, en vez de ser la primera entrega. */
  soporteDevuelto: boolean
  puedeValidar: boolean
  onValidar: () => void
  onDevolver: () => void
  procesando: boolean
}) {
  const { perfil, session } = useAuth()
  const { data: adjuntos, isLoading } = useAdjuntos(solicitud.id)
  const { data: urls } = useUrlsAdjuntos(adjuntos)
  const { data: matriz } = useMatrizDocumentos()
  const entregar = useEntregarSoporte()

  const [ampliado, setAmpliado] = useState<Adjunto | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [documentoId, setDocumentoId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const lista = adjuntos ?? []
  const urlAmpliada = ampliado ? urls?.[ampliado.ruta_storage] : undefined

  const esSolicitante = solicitud.solicitante?.user_id === perfil?.user_id
  const faltaEntregar = solicitud.estado === 'PENDIENTE_SOPORTE'
  const enRevision = solicitud.estado === 'SOPORTE_EN_VALIDACION'
  // Solo el solicitante sube: así lo exige la policy de Storage.
  const puedeEntregar = faltaEntregar && esSolicitante
  // El mismo texto significa cosas distintas segun de donde venga el paso: al
  // dar el visto bueno es una nota, al devolver es lo que hay que corregir.
  const nota = faltaEntregar ? solicitud.observacion_decision : null

  /**
   * Lista de verificación de lo que falta al regresar.
   *
   * Antes cualquier archivo daba por entregado el soporte, así que un motivo
   * que exige registro de defunción **y** prueba de parentesco se cerraba con
   * el primero de los dos y Talento Humano tenía que devolverlo para pedir el
   * otro. Ahora el trámite solo avanza cuando no falta ningún obligatorio.
   */
  const checklist = useMemo(() => {
    const docs = documentosDelTipo(matriz, solicitud.detalle_permiso?.tipo?.id)
    const entregados = (adjuntos ?? [])
      .filter((a) => a.momento === 'posterior' && a.documento?.codigo)
      .map((a) => a.documento!.codigo)

    return evaluarChecklist({
      matriz: docs,
      momento: 'posterior',
      diasPermiso: Number(solicitud.detalle_permiso?.dias_permiso ?? 0),
      entregados,
    })
  }, [matriz, adjuntos, solicitud.detalle_permiso])

  const vencimiento = faltaEntregar
    ? avisoDeVencimiento(solicitud.detalle_permiso?.fecha_limite_soporte ?? null, aISO(new Date()))
    : null

  /** Documento seleccionado, o el primero que falte si no se ha elegido nada. */
  const documentoElegido =
    checklist.documentos.find((d) => String(d.documentoId) === documentoId) ??
    checklist.faltantes[0] ??
    null

  async function entregarSoporte() {
    if (!archivo || !session) return
    setError(null)

    // ¿Este archivo cierra la lista? Se resuelve antes de subir porque después
    // el estado ya habrá cambiado y el colaborador no podría corregirlo.
    const pendientesTrasEste = checklist.faltantes.filter(
      (d) => d.documentoId !== documentoElegido?.documentoId
    )

    try {
      await entregar.mutateAsync({
        solicitudId: solicitud.id,
        archivo,
        usuarioId: session.user.id,
        documentoId: documentoElegido?.documentoId ?? null,
        completa: pendientesTrasEste.length === 0,
      })
      setArchivo(null)
      setDocumentoId('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible subir el soporte.')
    }
  }

  return (
    <>
      <aside
        className="panel-relieve flex min-h-0 flex-col overflow-hidden border border-[var(--tinte-azul-borde)]"
        aria-label="Documentos adjuntos"
      >
        <header className="franja-institucional flex shrink-0 items-center gap-2 px-3 py-2">
          <Files className="size-4 shrink-0 text-white/90" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white">Documentos</h2>
          {lista.length > 0 && (
            <span className="ml-auto rounded-full bg-white/20 px-2 text-[11px] font-semibold tabular text-white">
              {lista.length}
            </span>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Cargando documentos…</p>
          ) : lista.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              Todavía no hay documentos adjuntos.
            </p>
          ) : (
            lista.map((a) => {
              const url = urls?.[a.ruta_storage]

              return (
                <figure key={a.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setAmpliado(a)}
                    disabled={!url}
                    className={cn(
                      'group relative block h-28 w-full overflow-hidden bg-muted',
                      url ? 'cursor-zoom-in' : 'cursor-wait'
                    )}
                    aria-label={`Ampliar ${a.nombre_archivo}`}
                  >
                    {!url ? (
                      <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Preparando vista previa…
                      </span>
                    ) : esImagen(a) ? (
                      <img src={url} alt={a.nombre_archivo} className="size-full object-cover object-top" />
                    ) : (
                      // `pointer-events-none` deja que el clic llegue al botón
                      // en vez de quedarse dentro del visor de PDF.
                      <iframe
                        src={`${url}#toolbar=0&navpanes=0&view=FitH`}
                        title={a.nombre_archivo}
                        className="pointer-events-none size-full border-0 bg-white"
                      />
                    )}

                    <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:bg-[var(--cac-azul)]/45 group-hover:opacity-100">
                      <Maximize2 className="size-5 text-white drop-shadow" />
                    </span>
                  </button>

                  <figcaption className="border-t border-border px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <FileText className="size-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[11px]" title={a.nombre_archivo}>
                        {a.nombre_archivo}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                        {ETIQUETA_MOMENTO[a.momento]}
                      </span>
                    </div>
                    {/* Qué documento es, no solo cómo se llama el archivo:
                        «escaneo_001.pdf» no dice si es la incapacidad o la
                        prueba de parentesco. */}
                    {a.documento && (
                      <p className="mt-0.5 truncate text-[10px] text-[var(--acento-teal)]" title={a.documento.nombre}>
                        {a.documento.nombre}
                      </p>
                    )}
                  </figcaption>
                </figure>
              )
            })
          )}
        </div>

        {/* ------------------------------------------------ Gestión del soporte */}
        {(nota || puedeEntregar || enRevision || puedeValidar || error || faltaEntregar) && (
          <div className="shrink-0 space-y-2 border-t border-[var(--tinte-azul-borde)] p-2.5">
            {nota && (
              <div
                className={cn(
                  'rounded-md border p-2',
                  soporteDevuelto
                    ? 'border-[var(--tinte-rojo-borde)] bg-[var(--tinte-rojo)]'
                    : 'border-[var(--tinte-azul-borde)] bg-[var(--tinte-azul)]'
                )}
              >
                <p
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide',
                    soporteDevuelto ? 'text-[var(--error)]' : 'text-[var(--info)] dark:text-[var(--cac-azul-300)]'
                  )}
                >
                  {soporteDevuelto
                    ? 'Talento Humano devolvió el soporte'
                    : 'Nota de Talento Humano'}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs">{nota}</p>
              </div>
            )}

            {enRevision && !puedeValidar && (
              <p className="flex items-start gap-1.5 rounded-md border border-[var(--tinte-violeta-borde)] bg-[var(--tinte-violeta)] p-2 text-xs text-[var(--acento-violeta)]">
                <Hourglass className="mt-0.5 size-3.5 shrink-0" />
                Talento Humano está revisando tu soporte.
              </p>
            )}

            {/* La lista de verificación se muestra también a Talento Humano:
                al validar necesita saber qué documentos debía haber. */}
            {(faltaEntregar || enRevision) && checklist.documentos.length > 0 && (
              <ListaDocumentos documentos={checklist.documentos} momento="posterior" conEstado />
            )}

            {vencimiento && (
              <p
                className={cn(
                  'rounded-md border p-2 text-xs',
                  vencimiento.vencido
                    ? 'border-[var(--tinte-rojo-borde)] bg-[var(--tinte-rojo)] text-[var(--error)]'
                    : 'border-[var(--tinte-ambar-borde)] bg-[var(--tinte-ambar)] text-[var(--acento-ambar)]'
                )}
              >
                {vencimiento.mensaje}
              </p>
            )}

            {puedeEntregar && (
              <>
                {/* Etiquetar el archivo es lo que permite saber cuál de los
                    documentos exigidos acaba de llegar. */}
                {checklist.documentos.length > 1 && (
                  <Select
                    value={documentoElegido ? String(documentoElegido.documentoId) : ''}
                    onValueChange={setDocumentoId}
                  >
                    <SelectTrigger className="h-9" aria-label="Documento que estás entregando">
                      <SelectValue placeholder="¿Qué documento estás entregando?" />
                    </SelectTrigger>
                    <SelectContent>
                      {checklist.documentos
                        .filter((d) => d.exigible || d.obligatorio)
                        .map((d) => (
                          <SelectItem key={d.documentoId} value={String(d.documentoId)}>
                            {d.nombre}
                            {d.entregado ? ' · ya entregado' : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}

                <CampoArchivo id="soporte-posterior" archivo={archivo} onCambio={setArchivo} obligatorio />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!archivo}
                  cargando={entregar.isPending}
                  onClick={() => void entregarSoporte()}
                >
                  {!entregar.isPending && <Upload />}{' '}
                  {checklist.faltantes.length > 1 ? 'Guardar documento' : 'Guardar y enviar a Talento Humano'}
                </Button>
                {/* Decir qué pasa después evita que se quede esperando un
                    cierre que no depende de él. */}
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {checklist.faltantes.length > 1
                    ? `Faltan ${checklist.faltantes.length} documentos. La solicitud pasa a Talento Humano cuando estén todos.`
                    : archivo
                      ? 'Al guardarlo, Talento Humano lo revisa y cierra la solicitud.'
                      : (checklist.mensaje ??
                        'Adjunta el soporte correspondiente para poder cerrar la solicitud.')}
                </p>
              </>
            )}

            {puedeValidar && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="exito" size="sm" cargando={procesando} onClick={onValidar}>
                  {!procesando && <FileCheck2 />} Validar
                </Button>
                <Button variant="outline" size="sm" disabled={procesando} onClick={onDevolver}>
                  <Undo2 /> Devolver
                </Button>
              </div>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-1.5 rounded-md bg-[var(--error-suave)] p-2 text-xs text-[var(--error)]">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}

      </aside>

      <Dialog open={Boolean(ampliado)} onOpenChange={(v) => !v && setAmpliado(null)}>
        <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-3">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
              <FileText className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{ampliado?.nombre_archivo}</span>
              {ampliado && (
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {ETIQUETA_MOMENTO[ampliado.momento]}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted">
            {!urlAmpliada ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Cargando documento…</p>
            ) : ampliado && esImagen(ampliado) ? (
              <img src={urlAmpliada} alt={ampliado.nombre_archivo} className="mx-auto max-w-full" />
            ) : (
              <iframe
                src={urlAmpliada}
                title={ampliado?.nombre_archivo ?? 'Documento'}
                className="size-full border-0 bg-white"
              />
            )}
          </div>

          {ampliado && (
            <div className="flex shrink-0 justify-end">
              {/* Descargar o imprimir necesita el archivo fuera del modal. */}
              <Button variant="outline" size="sm" onClick={() => void abrirSoporte(ampliado.ruta_storage)}>
                <ExternalLink /> Abrir en una pestaña
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
