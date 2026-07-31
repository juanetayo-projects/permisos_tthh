import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardList, FileText } from 'lucide-react'
import { Button } from '@/presentation/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'

export interface SolicitudEnviada {
  id: string
  consecutivo: string | null
  /** Resumen de lo que se guardó, para repasarlo sin volver al formulario. */
  filas: { etiqueta: string; valor: React.ReactNode }[]
  /** A quién le queda ahora la solicitud. */
  siguiente: string
}

/**
 * Confirmación de una solicitud enviada.
 *
 * Antes se navegaba a «Mis solicitudes» con una línea de texto verde, y el
 * consecutivo —que es el número por el que se pregunta en Talento Humano y el
 * que va impreso en el formato— pasaba desapercibido. Aquí se muestra en
 * grande y con el resumen al lado, para poder anotarlo antes de cerrar.
 */
export function DialogoSolicitudEnviada({ datos }: { datos: SolicitudEnviada | null }) {
  const navigate = useNavigate()

  if (!datos) return null

  const irA = (ruta: string) => navigate(ruta, { replace: true })

  return (
    <Dialog open onOpenChange={() => irA('/mis-solicitudes')}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 [&>button]:text-white/80 [&>button]:hover:bg-white/20 [&>button]:hover:text-white">
        <DialogHeader className="franja-institucional gap-1 p-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-white">
            <CheckCircle2 className="size-5" />
            {datos.consecutivo ? 'Solicitud enviada' : 'Borrador guardado'}
          </DialogTitle>
          <DialogDescription className="text-white/80">{datos.siguiente}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          {datos.consecutivo && (
            <div className="rounded-xl border border-[var(--tinte-azul-borde)] bg-[var(--tinte-azul)] p-4 text-center">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Número de solicitud
              </p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight tabular text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]">
                {datos.consecutivo}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Anótalo: es el número por el que se consulta esta solicitud.
              </p>
            </div>
          )}

          <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {datos.filas.map((f) => (
              <div
                key={f.etiqueta}
                className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
              >
                <dt className="shrink-0 text-xs text-muted-foreground">{f.etiqueta}</dt>
                <dd className="min-w-0 truncate text-right font-medium">{f.valor}</dd>
              </div>
            ))}
          </dl>
        </div>

        <DialogFooter className="border-t border-border bg-muted/40 p-4">
          <Button variant="outline" onClick={() => irA('/mis-solicitudes')}>
            <ClipboardList /> Ver mis solicitudes
          </Button>
          <Button onClick={() => irA(`/solicitud/${datos.id}`)}>
            <FileText /> Abrir la solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
