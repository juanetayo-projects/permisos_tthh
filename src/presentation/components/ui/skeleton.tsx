import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

/** Esqueleto de tabla, para que la carga no produzca saltos de layout. */
export function SkeletonTabla({ filas = 6, columnas = 6 }: { filas?: number; columnas?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Cargando registros">
      {Array.from({ length: filas }).map((_, f) => (
        <div key={f} className="flex gap-3">
          {Array.from({ length: columnas }).map((_, c) => (
            <Skeleton key={c} className={cn('h-9 flex-1', c === 0 && 'max-w-28')} />
          ))}
        </div>
      ))}
    </div>
  )
}
