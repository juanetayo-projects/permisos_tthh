import { CalendarCheck, CalendarClock, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  contarDiasCalendario,
  contarDiasHabiles,
  desdeISO,
  esDiaHabil,
  sumarDias,
  aISO,
  type FechaISO,
} from '@/domain/festivos'
import { formatearFecha } from '@/lib/utils'

const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
/** Más allá de esto la tira de días deja de leerse; se resume. */
const MAXIMO_PINTADO = 31

/**
 * Línea de tiempo del periodo solicitado.
 *
 * Enseña de un vistazo lo que una pareja de fechas no dice: cuántos días son
 * de verdad, cuáles caen en fin de semana o festivo y cuándo se vuelve. Con
 * dos campos de fecha sueltos, un permiso que se cruza con un puente parecía
 * más largo de lo que era y había que contar con los dedos.
 */
export function LineaTiempoPeriodo({
  inicio,
  fin,
  reintegro,
  className,
}: {
  inicio: FechaISO
  fin: FechaISO
  /** Solo en vacaciones: el día en que se presenta a laborar. */
  reintegro?: FechaISO | null
  className?: string
}) {
  if (!inicio || !fin || fin < inicio) return null

  const total = contarDiasCalendario(inicio, fin)
  const habiles = contarDiasHabiles(inicio, fin)
  const noHabiles = total - habiles

  const dias =
    total <= MAXIMO_PINTADO
      ? Array.from({ length: total }, (_, i) => aISO(sumarDias(desdeISO(inicio), i)))
      : []

  return (
    <section className={cn('bloque-datos bloque-azul p-3', className)}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="bloque-titulo flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          Periodo solicitado
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-[var(--cac-azul-600)] px-2 py-0.5 font-semibold text-white tabular">
            {habiles} {habiles === 1 ? 'día hábil' : 'días hábiles'}
          </span>
          {noHabiles > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground tabular">
              +{noHabiles} no {noHabiles === 1 ? 'hábil' : 'hábiles'}
            </span>
          )}
        </div>
      </div>

      {/* Hitos */}
      <ol className="flex items-stretch gap-2 text-xs">
        <Hito icono={CalendarDays} etiqueta="Inicio" fecha={inicio} tono="azul" />
        <span className="mt-4 h-px flex-1 self-start bg-[var(--tinte-azul-borde)]" />
        <Hito icono={CalendarClock} etiqueta="Fin" fecha={fin} tono="azul" />
        {reintegro && (
          <>
            <span className="mt-4 h-px flex-1 self-start bg-[var(--tinte-azul-borde)]" />
            <Hito icono={CalendarCheck} etiqueta="Reintegro" fecha={reintegro} tono="verde" />
          </>
        )}
      </ol>

      {/* Tira de días: cada cuadro es un día, apagado si no se trabaja. */}
      {dias.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {dias.map((d) => {
            const habil = esDiaHabil(d)
            return (
              <span
                key={d}
                title={`${formatearFecha(d)}${habil ? '' : ' · no hábil'}`}
                className={cn(
                  'flex size-7 flex-col items-center justify-center rounded text-[10px] leading-none',
                  habil
                    ? 'bg-[var(--cac-azul-600)] font-semibold text-white'
                    : 'bg-muted text-muted-foreground line-through'
                )}
              >
                <span className="opacity-70">{DIAS[desdeISO(d).getDay()]}</span>
                <span className="tabular">{desdeISO(d).getDate()}</span>
              </span>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Hito({
  icono: Icono,
  etiqueta,
  fecha,
  tono,
}: {
  icono: typeof CalendarDays
  etiqueta: string
  fecha: FechaISO
  tono: 'azul' | 'verde'
}) {
  return (
    <li className="flex min-w-0 flex-col items-center gap-1 text-center">
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-full text-white',
          tono === 'azul' ? 'bg-[var(--cac-azul-600)]' : 'bg-[var(--exito)]'
        )}
      >
        <Icono className="size-4" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </span>
      <span className="whitespace-nowrap font-medium tabular">{formatearFecha(fecha)}</span>
    </li>
  )
}
