import { HardHat } from 'lucide-react'
import { Card } from '@/presentation/components/ui/card'

/** Marcador honesto para los módulos que aún no están construidos. */
export default function EnConstruccion({ modulo }: { modulo: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--advertencia-suave)]">
          <HardHat className="size-7 text-[#8a6400] dark:text-[var(--advertencia)]" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{modulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Este módulo está en construcción. El resto de la aplicación ya funciona.
        </p>
      </Card>
    </div>
  )
}
