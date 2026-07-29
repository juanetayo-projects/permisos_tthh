import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const botonVariantes = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--cac-azul)] text-white shadow-sm hover:bg-[var(--cac-azul-contraste)] active:scale-[0.98]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        outline: 'border border-input bg-card hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-[var(--error)] text-white shadow-sm hover:brightness-110',
        exito: 'bg-[var(--exito)] text-white shadow-sm hover:brightness-110',
        link: 'text-[var(--cac-azul-contraste)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface BotonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof botonVariantes> {
  asChild?: boolean
  cargando?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, BotonProps>(
  ({ className, variant, size, asChild = false, cargando = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(botonVariantes({ variant, size, className }))}
        disabled={disabled || cargando}
        {...props}
      >
        {cargando ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, botonVariantes }
