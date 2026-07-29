import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { ETIQUETA_ESTADO, TONO_ESTADO, type Estado, type TonoEstado } from '@/domain/estados'

const badgeVariantes = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      tono: {
        exito: 'border-transparent bg-[var(--exito-suave)] text-[var(--exito)]',
        advertencia: 'border-transparent bg-[var(--advertencia-suave)] text-[#8a6400] dark:text-[var(--advertencia)]',
        error: 'border-transparent bg-[var(--error-suave)] text-[var(--error)]',
        info: 'border-transparent bg-[var(--info-suave)] text-[var(--info)] dark:text-[var(--cac-azul-300)]',
        neutro: 'border-transparent bg-[var(--neutro-suave)] text-[var(--neutro)]',
        contorno: 'border-border text-foreground',
      },
    },
    defaultVariants: { tono: 'neutro' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariantes> {}

export function Badge({ className, tono, ...props }: BadgeProps) {
  return <span className={cn(badgeVariantes({ tono }), className)} {...props} />
}

const PUNTO: Record<TonoEstado, string> = {
  exito: 'bg-[var(--exito)]',
  advertencia: 'bg-[var(--advertencia)]',
  error: 'bg-[var(--error)]',
  info: 'bg-[var(--info)]',
  neutro: 'bg-[var(--neutro)]',
}

/** Estado de una solicitud con su color y etiqueta en español. */
export function BadgeEstado({ estado, className }: { estado: Estado; className?: string }) {
  const tono = TONO_ESTADO[estado]
  return (
    <Badge tono={tono} className={className}>
      <span className={cn('size-1.5 rounded-full', PUNTO[tono])} aria-hidden />
      {ETIQUETA_ESTADO[estado]}
    </Badge>
  )
}
