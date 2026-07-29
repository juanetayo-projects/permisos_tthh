import { useState } from 'react'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/presentation/components/ui/button'
import { Textarea } from '@/presentation/components/ui/textarea'
import { Label } from '@/presentation/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'

export type TipoDecision = 'aprobar' | 'rechazar'

/**
 * Confirmación de una decisión del flujo.
 *
 * El rechazo exige motivo por diseño: es lo que verá el solicitante en el
 * correo y lo que queda en el historial para la auditoría ISO 9001.
 */
export function DialogoDecision({
  abierto,
  onCerrar,
  tipo,
  cantidad,
  etiquetaAprobar = 'Autorizar',
  onConfirmar,
}: {
  abierto: boolean
  onCerrar: () => void
  tipo: TipoDecision
  cantidad: number
  etiquetaAprobar?: string
  onConfirmar: (motivo: string | null) => Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const esRechazo = tipo === 'rechazar'

  async function confirmar() {
    setError(null)

    if (esRechazo && motivo.trim().length < 10) {
      setError('Describe la causa del rechazo: el solicitante la recibirá por correo.')
      return
    }

    setEnviando(true)
    try {
      await onConfirmar(esRechazo ? motivo.trim() : motivo.trim() || null)
      setMotivo('')
      onCerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la decisión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (!v && !enviando) {
          setMotivo('')
          setError(null)
          onCerrar()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {esRechazo ? (
              <XCircle className="size-5 text-[var(--error)]" />
            ) : (
              <CheckCircle2 className="size-5 text-[var(--exito)]" />
            )}
            {esRechazo ? 'Rechazar' : etiquetaAprobar}
            {cantidad > 1 && ` ${cantidad} solicitudes`}
          </DialogTitle>
          <DialogDescription>
            {esRechazo
              ? 'El solicitante recibirá la causa por correo y quedará registrada en el historial.'
              : `Se notificará al solicitante y la solicitud avanzará al siguiente paso del flujo.${
                  cantidad > 1 ? ' La decisión aplica a todas las seleccionadas.' : ''
                }`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo">
            {esRechazo ? 'Causa del rechazo' : 'Observación (opcional)'}
          </Label>
          <Textarea
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={
              esRechazo
                ? 'Explica por qué no se autoriza…'
                : 'Cualquier anotación que deba quedar en el historial…'
            }
            autoFocus
          />
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant={esRechazo ? 'destructive' : 'exito'}
            cargando={enviando}
            onClick={() => void confirmar()}
          >
            {esRechazo ? 'Rechazar' : etiquetaAprobar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
