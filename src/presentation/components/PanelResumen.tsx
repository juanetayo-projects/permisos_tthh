import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilaResumen {
  etiqueta: string
  valor: React.ReactNode
  destacado?: boolean
}

export type TonoAviso = 'info' | 'advertencia' | 'exito'

export interface Aviso {
  tono: TonoAviso
  texto: string
}

const ICONO: Record<TonoAviso, typeof Info> = {
  info: Info,
  advertencia: AlertTriangle,
  exito: CheckCircle2,
}

const ESTILO: Record<TonoAviso, string> = {
  info: 'bg-[var(--info-suave)] text-[var(--info)] dark:text-[var(--cac-azul-300)]',
  advertencia: 'bg-[var(--advertencia-suave)] text-[#8a6400] dark:text-[var(--advertencia)]',
  exito: 'bg-[var(--exito-suave)] text-[var(--exito)]',
}

/**
 * Panel de resumen en vivo, siguiendo el patrón del proyecto SIAU: cada
 * variable diligenciada se destaca mientras se llena el formulario, junto con
 * lo que la aplicación calcula y las advertencias del caso.
 */
export function PanelResumen({
  titulo = 'Resumen',
  filas,
  avisos = [],
  pie,
}: {
  titulo?: string
  filas: FilaResumen[]
  avisos?: Aviso[]
  pie?: React.ReactNode
}) {
  return (
    <aside className="panel-relieve flex h-full flex-col gap-3 p-4" aria-label={titulo}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h2>

      <dl className="space-y-1.5">
        {filas.map((f) => (
          <div key={f.etiqueta} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="shrink-0 text-muted-foreground">{f.etiqueta}</dt>
            <dd
              className={cn(
                'min-w-0 truncate text-right tabular',
                f.destacado ? 'font-semibold text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]' : 'text-foreground'
              )}
              title={typeof f.valor === 'string' ? f.valor : undefined}
            >
              {f.valor}
            </dd>
          </div>
        ))}
      </dl>

      {avisos.length > 0 && (
        <div className="space-y-2">
          {avisos.map((a, i) => {
            const Icono = ICONO[a.tono]
            return (
              <p
                key={i}
                className={cn('flex items-start gap-2 rounded-md p-2.5 text-xs leading-relaxed', ESTILO[a.tono])}
              >
                <Icono className="mt-0.5 size-3.5 shrink-0" />
                <span>{a.texto}</span>
              </p>
            )
          })}
        </div>
      )}

      {pie && <div className="mt-auto pt-2 text-xs text-muted-foreground">{pie}</div>}
    </aside>
  )
}
