import { AlertCircle, ArrowRight } from 'lucide-react'
import type { Problema } from '@/domain/validacion'
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
 * Lo que impide enviar la solicitud, en un modal y con el porqué.
 *
 * Antes esto era una frase roja al pie del formulario, y en un formato que
 * ocupa toda la pantalla quedaba fuera de la vista justo cuando aparecía. Peor:
 * decía *qué* faltaba pero nunca *por qué*, así que exigir el cargo —que va
 * impreso en el TH-F-002 y es uno de los cortes del informe de ausentismo—
 * parecía un capricho del sistema.
 *
 * El modal interrumpe a propósito: es la única forma de que un aviso se lea
 * cuando el formulario ya no cabe entero en pantalla. Y lista todos los
 * problemas a la vez, en vez de soltarlos de uno en uno a cada intento.
 */
export function DialogoProblemas({
  problemas,
  onCerrar,
  titulo = 'Faltan datos para enviar la solicitud',
}: {
  problemas: Problema[]
  onCerrar: () => void
  titulo?: string
}) {
  const abierto = problemas.length > 0
  const uno = problemas.length === 1

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8 text-[var(--error)]">
            <AlertCircle className="size-5 shrink-0" />
            {titulo}
          </DialogTitle>
          <DialogDescription>
            {uno
              ? 'Corrige este punto y vuelve a enviarla.'
              : `Hay ${problemas.length} puntos por corregir. Se muestran todos para que no tengas que enviarla varias veces.`}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5">
          {problemas.map((p, i) => (
            <li
              key={`${p.campo}-${i}`}
              className="rounded-lg border border-[var(--tinte-rojo-borde)] bg-[var(--tinte-rojo)] p-3"
            >
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {p.campo}
              </p>
              <p className="mt-1 text-sm font-medium">{p.causa}</p>
              {/* El motivo es la mitad que faltaba: sin él, la regla se lee
                  como un obstáculo y no como algo que el formato necesita. */}
              <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <ArrowRight className="mt-0.5 size-3 shrink-0" />
                {p.motivo}
              </p>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button onClick={onCerrar}>Entendido, lo corrijo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
