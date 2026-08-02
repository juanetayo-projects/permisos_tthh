import { AlertTriangle, CheckCircle2, ClipboardCheck, Info } from 'lucide-react'
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
  info: 'bg-[var(--tinte-azul)] border-[var(--tinte-azul-borde)] text-[var(--info)] dark:text-[var(--cac-azul-300)]',
  advertencia:
    'bg-[var(--tinte-ambar)] border-[var(--tinte-ambar-borde)] text-[var(--acento-ambar)]',
  exito: 'bg-[var(--tinte-verde)] border-[var(--tinte-verde-borde)] text-[var(--exito)]',
}

/**
 * Panel de resumen en vivo, siguiendo el patrón del proyecto SIAU: cada
 * variable diligenciada se destaca mientras se llena el formulario, junto con
 * lo que la aplicación calcula y las advertencias del caso.
 *
 * Va deliberadamente más marcado que el resto de la pantalla —cabecera azul,
 * relieve y filas alternas— porque es la pieza que el solicitante debe repasar
 * antes de enviar: si compite en peso visual con los campos, se ignora.
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
    <aside
      className="panel-relieve flex h-full flex-col overflow-hidden border border-[var(--tinte-azul-borde)]"
      aria-label={titulo}
    >
      <header className="franja-institucional flex items-center gap-2 px-4 py-2.5">
        <ClipboardCheck className="size-4 shrink-0 text-white/90" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white">{titulo}</h2>
      </header>

      <dl className="shrink-0 divide-y divide-[var(--tinte-azul-borde)]">
        {filas.map((f, i) => (
          <div
            key={f.etiqueta}
            className={cn(
              'flex items-baseline justify-between gap-3 px-4 py-1.5 text-sm',
              // Filas alternas: con diez datos seguidos, la vista se pierde.
              i % 2 === 1 && 'bg-[var(--tinte-azul)]',
              f.destacado && 'bg-[var(--tinte-teal)]'
            )}
          >
            <dt className="shrink-0 text-xs text-muted-foreground">{f.etiqueta}</dt>
            <dd
              className={cn(
                'min-w-0 truncate text-right tabular',
                f.destacado
                  ? 'text-sm font-semibold text-[var(--acento-teal)]'
                  : 'font-medium text-foreground'
              )}
              title={typeof f.valor === 'string' ? f.valor : undefined}
            >
              {f.valor}
            </dd>
          </div>
        ))}
      </dl>

      {/* Los avisos se llevan el espacio sobrante y se desplazan por dentro:
          con seis advertencias, el pie del formato quedaba fuera del panel. */}
      {avisos.length > 0 && (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto border-t border-[var(--tinte-azul-borde)] p-3">
          {avisos.map((a, i) => {
            const Icono = ICONO[a.tono]
            return (
              <p
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-md border p-2 text-xs leading-relaxed',
                  ESTILO[a.tono]
                )}
              >
                <Icono className="mt-0.5 size-3.5 shrink-0" />
                <span>{a.texto}</span>
              </p>
            )
          })}
        </div>
      )}

      {pie && (
        <p className="mt-auto shrink-0 border-t border-[var(--tinte-azul-borde)] bg-[var(--tinte-azul)] px-4 py-2 text-[11px] leading-snug text-muted-foreground">
          {pie}
        </p>
      )}
    </aside>
  )
}
