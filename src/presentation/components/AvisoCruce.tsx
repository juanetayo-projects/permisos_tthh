import { CalendarClock, GitBranch, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatearFecha } from '@/lib/utils'
import type { Cruce, Resolucion } from '@/domain/concurrencia'

const ESTILO: Record<Resolucion, string> = {
  interrumpe: 'border-[var(--tinte-ambar-borde)] bg-[var(--tinte-ambar)]',
  duplicado: 'border-[var(--tinte-rojo-borde)] bg-[var(--tinte-rojo)]',
  convive: 'border-[var(--tinte-azul-borde)] bg-[var(--tinte-azul)]',
}

const ICONO: Record<Resolucion, typeof GitBranch> = {
  interrumpe: GitBranch,
  duplicado: TriangleAlert,
  convive: CalendarClock,
}

const TITULO: Record<Resolucion, string> = {
  interrumpe: 'Interrumpiría un periodo en curso',
  duplicado: 'Puede estar duplicada',
  convive: 'Se cruza con otra solicitud',
}

/**
 * Cruces de fechas detectados, con lo que implicaría cada uno.
 *
 * No bloquea el envío. Una incapacidad que cae en mitad de las vacaciones es un
 * caso legítimo y frecuente —art. 187 CST—: lo que hace falta es que quien
 * solicita y quien autoriza lo vean antes de decidir, no que el sistema decida
 * por ellos.
 */
export function AvisoCruce({ cruces, className }: { cruces: Cruce[]; className?: string }) {
  if (cruces.length === 0) return null

  return (
    <div className={cn('space-y-1.5', className)}>
      {cruces.map((c) => {
        const Icono = ICONO[c.resolucion]

        return (
          <div key={c.periodo.id} className={cn('rounded-md border p-2.5', ESTILO[c.resolucion])}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
              <Icono className="size-3.5 shrink-0" />
              {TITULO[c.resolucion]}
            </p>
            <p className="mt-1 text-xs leading-relaxed">{c.mensaje}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {c.periodo.motivo} · {formatearFecha(c.periodo.fechaInicio)}
              {c.periodo.fechaFin !== c.periodo.fechaInicio &&
                ` → ${formatearFecha(c.periodo.fechaFin)}`}
            </p>
          </div>
        )
      })}
    </div>
  )
}
