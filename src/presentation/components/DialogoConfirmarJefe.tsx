import { AlertTriangle, Send, UserCheck } from 'lucide-react'
import { Button } from '@/presentation/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'

/**
 * Última comprobación antes de enviar: ¿es este el jefe que debe autorizar?
 *
 * El jefe se propone a partir del área, y esa propuesta acierta casi siempre
 * —por eso se deja—, pero cuando falla el aviso le llega por correo a alguien
 * que no tiene nada que ver con esa persona, y el error solo se descubre
 * cuando la solicitud lleva días parada. Confirmarlo cuesta un clic.
 */
export function DialogoConfirmarJefe({
  abierto,
  jefe,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  abierto: boolean
  jefe: { nombre: string | null; cargo: string | null; correo: string } | undefined
  enviando: boolean
  onCancelar: () => void
  onConfirmar: () => void
}) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && !enviando && onCancelar()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 [&>button]:text-white/80 [&>button]:hover:bg-white/20 [&>button]:hover:text-white">
        <DialogHeader className="franja-institucional gap-1 p-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-white">
            <UserCheck className="size-5" /> Confirma quién autoriza
          </DialogTitle>
          <DialogDescription className="text-white/80">
            La solicitud le llegará por correo a esta persona.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-5">
          {jefe ? (
            <div className="rounded-xl border border-[var(--tinte-teal-borde)] bg-[var(--tinte-teal)] p-4 text-center">
              <p className="text-lg font-bold">{jefe.nombre}</p>
              {jefe.cargo && <p className="text-sm text-muted-foreground">{jefe.cargo}</p>}
              <p className="mt-1 truncate text-xs text-muted-foreground">{jefe.correo}</p>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-md border border-[var(--tinte-ambar-borde)] bg-[var(--tinte-ambar)] p-3 text-sm text-[var(--acento-ambar)]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              No hay jefe directo seleccionado. Ciérrala y elige uno antes de enviar.
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Si no es quien debe autorizarte, cierra y cámbialo en el formulario.
          </p>
        </div>

        <DialogFooter className="border-t border-border bg-muted/40 p-4">
          <Button variant="ghost" onClick={onCancelar} disabled={enviando}>
            Revisar
          </Button>
          <Button cargando={enviando} disabled={!jefe} onClick={onConfirmar}>
            {!enviando && <Send />} Sí, enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
