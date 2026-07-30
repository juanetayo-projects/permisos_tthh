import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TonoMetrica = 'azul' | 'exito' | 'advertencia' | 'error' | 'teal' | 'violeta' | 'neutro'

/**
 * Cada tono tiñe la tarjeta entera, no solo el icono.
 *
 * Con todas las tarjetas en blanco sobre fondo claro, la retícula se leía como
 * una masa uniforme y había que leer cada cifra para orientarse. El tinte usa
 * las variables de bloque, que ya están definidas para tema claro y oscuro.
 */
const TONOS: Record<TonoMetrica, { fondo: string; icono: string; valor: string; barra: string }> = {
  azul: {
    fondo: 'bg-[var(--tinte-azul)] border-[var(--tinte-azul-borde)]',
    icono: 'bg-[var(--cac-azul)] text-white',
    valor: 'text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]',
    barra: 'bg-[var(--cac-azul)]',
  },
  exito: {
    fondo: 'bg-[var(--tinte-verde)] border-[var(--tinte-verde-borde)]',
    icono: 'bg-[var(--exito)] text-white',
    valor: 'text-[var(--exito)]',
    barra: 'bg-[var(--exito)]',
  },
  advertencia: {
    fondo: 'bg-[var(--tinte-ambar)] border-[var(--tinte-ambar-borde)]',
    icono: 'bg-[var(--acento-ambar)] text-white dark:text-[#221c0e]',
    valor: 'text-[var(--acento-ambar)]',
    barra: 'bg-[var(--acento-ambar)]',
  },
  error: {
    fondo: 'bg-[var(--error-suave)] border-[var(--error)]/25',
    icono: 'bg-[var(--error)] text-white',
    valor: 'text-[var(--error)]',
    barra: 'bg-[var(--error)]',
  },
  teal: {
    fondo: 'bg-[var(--tinte-teal)] border-[var(--tinte-teal-borde)]',
    icono: 'bg-[var(--acento-teal)] text-white',
    valor: 'text-[var(--acento-teal)]',
    barra: 'bg-[var(--acento-teal)]',
  },
  violeta: {
    fondo: 'bg-[var(--tinte-violeta)] border-[var(--tinte-violeta-borde)]',
    icono: 'bg-[var(--acento-violeta)] text-white',
    valor: 'text-[var(--acento-violeta)]',
    barra: 'bg-[var(--acento-violeta)]',
  },
  neutro: {
    fondo: 'bg-[var(--neutro-suave)] border-[var(--neutro)]/30',
    icono: 'bg-[var(--neutro)] text-white',
    valor: 'text-foreground',
    barra: 'bg-[var(--neutro)]',
  },
}

/**
 * Tarjeta de métrica con relieve, según la decisión D3: el neumorfismo se
 * reserva para las tarjetas del dashboard, donde ayuda a jerarquizar, y no se
 * aplica a tablas ni formularios, donde restaría legibilidad.
 */
export function MetricCard({
  etiqueta,
  valor,
  sufijo,
  detalle,
  icono: Icono,
  tono = 'azul',
  variacion,
  onClick,
}: {
  etiqueta: string
  valor: string | number
  sufijo?: string
  detalle?: string
  icono: LucideIcon
  tono?: TonoMetrica
  /** Variación porcentual frente al periodo anterior. */
  variacion?: number | null
  onClick?: () => void
}) {
  const t = TONOS[tono]
  const Elemento = onClick ? 'button' : 'div'

  return (
    <Elemento
      onClick={onClick}
      className={cn(
        'panel-relieve group relative overflow-hidden border p-4 text-left transition-transform',
        t.fondo,
        onClick && 'cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-1', t.barra)} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm', t.icono)}>
          <Icono className="size-4" />
        </span>
      </div>

      <p className={cn('mt-3 text-2xl font-semibold tabular', t.valor)}>
        {valor}
        {sufijo && <span className="ml-1 text-base font-normal text-muted-foreground">{sufijo}</span>}
      </p>

      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {variacion != null && variacion !== 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              variacion > 0 ? 'text-[var(--error)]' : 'text-[var(--exito)]'
            )}
            title="Comparado con el periodo anterior"
          >
            {variacion > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(variacion)}%
          </span>
        )}
        {detalle && <span className="truncate">{detalle}</span>}
      </div>
    </Elemento>
  )
}
