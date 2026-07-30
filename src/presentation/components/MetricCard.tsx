import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TonoMetrica = 'azul' | 'exito' | 'advertencia' | 'error' | 'neutro'

const TONOS: Record<TonoMetrica, { icono: string; valor: string; barra: string }> = {
  azul: {
    icono: 'bg-[var(--info-suave)] text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]',
    valor: 'text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]',
    barra: 'bg-[var(--cac-azul)]',
  },
  exito: {
    icono: 'bg-[var(--exito-suave)] text-[var(--exito)]',
    valor: 'text-[var(--exito)]',
    barra: 'bg-[var(--exito)]',
  },
  advertencia: {
    icono: 'bg-[var(--advertencia-suave)] text-[#8a6400] dark:text-[var(--advertencia)]',
    valor: 'text-[#8a6400] dark:text-[var(--advertencia)]',
    barra: 'bg-[var(--advertencia)]',
  },
  error: {
    icono: 'bg-[var(--error-suave)] text-[var(--error)]',
    valor: 'text-[var(--error)]',
    barra: 'bg-[var(--error)]',
  },
  neutro: {
    icono: 'bg-[var(--neutro-suave)] text-[var(--neutro)]',
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
        'panel-relieve group relative overflow-hidden p-4 text-left transition-transform',
        onClick && 'cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-1', t.barra)} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', t.icono)}>
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
