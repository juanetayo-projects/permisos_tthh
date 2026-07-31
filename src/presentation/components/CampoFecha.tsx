import { AlertTriangle } from 'lucide-react'
import { esDiaHabil, esFestivo, esFinDeSemana, siguienteDiaHabil, type FechaISO } from '@/domain/festivos'
import { formatearFechaLarga } from '@/lib/utils'
import { Input } from '@/presentation/components/ui/input'

/**
 * Selector de fecha que solo admite días hábiles.
 *
 * `<input type="date">` no permite deshabilitar días sueltos —solo un rango—,
 * así que la restricción se aplica al elegir: si la fecha cae en fin de semana
 * o en un festivo colombiano, se corrige al siguiente día hábil y se explica
 * por qué. Corregir en silencio confundiría; dejar pasar la fecha metería en
 * el formato oficial un permiso para un día que no se trabaja.
 *
 * Los motivos exentos de antelación —calamidad, luto— sí admiten días no
 * hábiles: ocurren cuando ocurren y se formalizan después. Por eso la
 * restricción es opcional.
 */
export function CampoFecha({
  id,
  valor,
  onCambio,
  min,
  soloHabiles = true,
  disabled,
  'aria-label': ariaLabel,
}: {
  id: string
  valor: FechaISO
  onCambio: (f: FechaISO) => void
  min?: string
  /** `false` en los motivos que pueden caer cualquier día. */
  soloHabiles?: boolean
  disabled?: boolean
  'aria-label'?: string
}) {
  const noHabil = soloHabiles && valor && !esDiaHabil(valor)

  function cambiar(elegida: string) {
    if (!elegida) return onCambio(elegida as FechaISO)

    const f = elegida as FechaISO
    onCambio(soloHabiles && !esDiaHabil(f) ? siguienteDiaHabil(f) : f)
  }

  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="date"
        value={valor}
        min={min}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => cambiar(e.target.value)}
      />

      {noHabil && (
        <p className="flex items-start gap-1.5 text-xs text-[var(--acento-ambar)]">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          Se movió al siguiente día hábil.
        </p>
      )}
    </div>
  )
}

/** Explica por qué se corrigió una fecha, para el panel de avisos. */
export function motivoNoHabil(f: FechaISO): string | null {
  if (esFinDeSemana(f)) return `El ${formatearFechaLarga(f)} cae en fin de semana.`
  if (esFestivo(f)) return `El ${formatearFechaLarga(f)} es festivo en Colombia.`
  return null
}
