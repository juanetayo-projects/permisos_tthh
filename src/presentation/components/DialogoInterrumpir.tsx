import { useMemo, useState } from 'react'
import { GitBranch, TriangleAlert } from 'lucide-react'
import { diasNoDisfrutados } from '@/domain/concurrencia'
import { formatearFecha } from '@/lib/utils'
import type { SolicitudLista } from '@/application/solicitudes/useSolicitudes'
import { Button } from '@/presentation/components/ui/button'
import { CampoFecha } from '@/presentation/components/CampoFecha'
import { Label } from '@/presentation/components/ui/label'
import { Textarea } from '@/presentation/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'

/**
 * Interrupción de un periodo en curso.
 *
 * Es la operación que faltaba para cumplir el art. 187 CST: cuando una
 * incapacidad cae dentro de unas vacaciones, el descanso se suspende y los días
 * no disfrutados quedan pendientes. Antes la aplicación cerraba el periodo
 * completo y esos días se perdían sin dejar rastro.
 *
 * Los días pendientes se calculan aquí y no en la base de datos porque el
 * cómputo depende del calendario colombiano —festivos y Ley Emiliani— que ya
 * está resuelto y probado en el dominio; reimplementarlo en SQL sería tener dos
 * versiones de la misma regla.
 */
export function DialogoInterrumpir({
  solicitud,
  abierto,
  onCerrar,
  onConfirmar,
  procesando,
}: {
  solicitud: SolicitudLista
  abierto: boolean
  onCerrar: () => void
  onConfirmar: (params: { fecha: string; dias: number; nota: string | null }) => void
  procesando: boolean
}) {
  const esVacaciones = solicitud.tramite?.codigo === 'vacaciones'
  // Un periodo de vacaciones se cuenta siempre en días hábiles; un permiso,
  // según lo que diga su motivo.
  const porCalendario = !esVacaciones && Boolean(solicitud.detalle_permiso?.tipo?.dias_calendario)

  // Nunca el primer día: si el permiso no llegó a disfrutarse no se interrumpe,
  // se cancela. La RPC lo rechaza igualmente, pero avisar aquí evita el viaje.
  const minimo = useMemo(() => {
    const d = new Date(`${solicitud.fecha_inicio}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  }, [solicitud.fecha_inicio])

  const [fecha, setFecha] = useState(minimo)
  const [nota, setNota] = useState('')

  const dias = useMemo(
    () => diasNoDisfrutados({ fechaInterrupcion: fecha, fechaFin: solicitud.fecha_fin, porCalendario }),
    [fecha, solicitud.fecha_fin, porCalendario]
  )

  const fueraDeRango = fecha < minimo || fecha > solicitud.fecha_fin

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            Interrumpir el periodo
          </DialogTitle>
          <DialogDescription>
            {esVacaciones
              ? 'Las vacaciones son descanso y una incapacidad no lo es: el periodo se suspende y los días no disfrutados quedan pendientes de reprogramar (art. 187 CST).'
              : 'El periodo se suspende desde la fecha que indiques y los días restantes quedan pendientes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded-md border border-border bg-muted/50 p-2.5 text-sm">
            {solicitud.consecutivo ?? 'Sin numerar'} · {formatearFecha(solicitud.fecha_inicio)} →{' '}
            {formatearFecha(solicitud.fecha_fin)}
          </p>

          <div className="space-y-1">
            <Label htmlFor="fecha-interrupcion">Primer día que ya no se disfruta</Label>
            <CampoFecha
              id="fecha-interrupcion"
              valor={fecha}
              min={minimo}
              max={solicitud.fecha_fin}
              soloHabiles={!porCalendario}
              onCambio={setFecha}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="nota-interrupcion">Motivo de la interrupción</Label>
            <Textarea
              id="nota-interrupcion"
              className="min-h-16"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Incapacidad expedida el… / consecutivo de la solicitud que la origina…"
            />
          </div>

          {fueraDeRango ? (
            <p className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-2.5 text-sm text-[var(--error)]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              La fecha debe estar dentro del periodo y después de su primer día. Si el permiso no
              llegó a disfrutarse, cancélalo en vez de interrumpirlo.
            </p>
          ) : (
            <p className="rounded-md border border-[var(--tinte-ambar-borde)] bg-[var(--tinte-ambar)] p-2.5 text-sm">
              El periodo quedará del {formatearFecha(solicitud.fecha_inicio)} al{' '}
              {formatearFecha(retroceder(fecha))} y quedarán{' '}
              <strong>
                {dias} día{dias === 1 ? '' : 's'}
              </strong>{' '}
              por reprogramar, contados en días {porCalendario ? 'calendario' : 'hábiles'}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={procesando}>
            Cancelar
          </Button>
          <Button
            disabled={fueraDeRango}
            cargando={procesando}
            onClick={() => onConfirmar({ fecha, dias, nota: nota.trim() || null })}
          >
            Interrumpir y dejar {dias} día{dias === 1 ? '' : 's'} pendientes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function retroceder(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
