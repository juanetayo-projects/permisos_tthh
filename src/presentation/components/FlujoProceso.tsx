import { CheckCircle2, FileCheck2, FileSignature, Paperclip, Send, Undo2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Rol } from '@/domain/estados'

type Actor = 'colaborador' | 'jefe' | 'th'

interface Paso {
  actor: Actor
  icono: typeof Send
  titulo: string
  /** Qué pasa en este paso, en una frase y sin jerga. */
  guia: string
  /** El paso no siempre ocurre. */
  condicional?: boolean
}

const ACTORES: Record<Actor, { etiqueta: string; color: string; fondo: string; borde: string }> = {
  colaborador: {
    etiqueta: 'Tú',
    color: 'text-[var(--cac-azul-600)] dark:text-[var(--cac-azul-300)]',
    fondo: 'bg-[var(--cac-azul-600)]',
    borde: 'border-[var(--tinte-azul-borde)] bg-[var(--tinte-azul)]',
  },
  jefe: {
    etiqueta: 'Jefe directo',
    color: 'text-[var(--acento-teal)]',
    fondo: 'bg-[var(--acento-teal)]',
    borde: 'border-[var(--tinte-teal-borde)] bg-[var(--tinte-teal)]',
  },
  th: {
    etiqueta: 'Talento Humano',
    color: 'text-[var(--acento-violeta)]',
    fondo: 'bg-[var(--acento-violeta)]',
    borde: 'border-[var(--tinte-violeta-borde)] bg-[var(--tinte-violeta)]',
  },
}

const PASOS: Paso[] = [
  {
    actor: 'colaborador',
    icono: Send,
    titulo: 'Solicitas',
    guia: 'Eliges el motivo, las fechas y confirmas quién es tu jefe directo.',
  },
  {
    actor: 'jefe',
    icono: FileSignature,
    titulo: 'Autoriza tu jefe',
    guia: 'Le llega un correo y decide. Si rechaza, te explica por qué.',
  },
  {
    actor: 'th',
    icono: FileCheck2,
    titulo: 'Visto bueno de TH',
    guia: 'Talento Humano revisa que cumpla el formato y las reglas del trámite.',
  },
  {
    actor: 'colaborador',
    icono: Paperclip,
    titulo: 'Entregas el soporte',
    guia: 'Solo si el motivo lo exige, al regresar. Por ejemplo, la constancia de la cita.',
    condicional: true,
  },
  {
    actor: 'th',
    icono: CheckCircle2,
    titulo: 'Cerrada',
    guia: 'TH valida el soporte y el trámite queda cerrado en tu historial.',
  },
]

/**
 * Carrilera del proceso.
 *
 * Sirve de mapa: quien entra por primera vez no sabe cuántas manos toca su
 * solicitud ni por qué se queda «pendiente» de alguien, y acaba preguntando
 * por teléfono. Cada estación dice **quién** actúa —que es la duda real— y qué
 * ocurre ahí, en una frase.
 *
 * Los pasos del rol de quien mira se destacan: al colaborador le interesa
 * saber qué le toca a él, no memorizar el flujo entero.
 */
export function FlujoProceso({ rol }: { rol?: Rol }) {
  const miActor: Actor | null =
    rol === 'coordinador'
      ? 'jefe'
      : rol === 'analista_th' || rol === 'gerente_th'
        ? 'th'
        : rol === 'colaborador'
          ? 'colaborador'
          : null

  return (
    <section className="panel-relieve panel-destacado shrink-0 overflow-hidden">
      {/* Título y bajada en la misma línea: la carrilera ya ocupa lo suyo y el
          inicio tiene que caber sin scroll. */}
      <header className="flex flex-wrap items-baseline gap-x-3 border-b border-border px-5 py-2.5">
        <h2 className="font-semibold">Así avanza una solicitud</h2>
        <p className="text-sm text-muted-foreground">
          Cinco pasos y tres manos. En cada uno verás de quién depende que siga.
        </p>
      </header>

      <ol className="grid gap-x-2 gap-y-4 px-5 py-3 md:grid-cols-5">
        {PASOS.map((paso, i) => {
          const a = ACTORES[paso.actor]
          const Icono = paso.icono
          const esMio = miActor === paso.actor

          return (
            <li key={paso.titulo} className="flex flex-col">
              {/* La vía: un tramo a cada lado del icono. Dibujarla así, y no
                  con posición absoluta, la mantiene alineada aunque las
                  tarjetas cambien de alto o la rejilla se reordene. */}
              <div className="flex items-center" aria-hidden="true">
                <span
                  className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : 'bg-border')}
                />
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm',
                    a.fondo,
                    esMio && 'ring-2 ring-offset-2 ring-offset-card',
                    esMio && paso.actor === 'colaborador' && 'ring-[var(--cac-azul-600)]',
                    esMio && paso.actor === 'jefe' && 'ring-[var(--acento-teal)]',
                    esMio && paso.actor === 'th' && 'ring-[var(--acento-violeta)]'
                  )}
                >
                  <Icono className="size-5" />
                </span>
                <span
                  className={cn(
                    'h-0.5 flex-1',
                    i === PASOS.length - 1 ? 'bg-transparent' : 'bg-border'
                  )}
                />
              </div>

              <div className="mt-2 text-center">
                <span
                  className={cn(
                    'inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    a.borde,
                    a.color
                  )}
                >
                  {esMio ? `${a.etiqueta} · te toca` : a.etiqueta}
                </span>
                <h3 className="mt-1 text-sm font-semibold">
                  <span className="tabular text-muted-foreground">{i + 1}. </span>
                  {paso.titulo}
                </h3>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{paso.guia}</p>
                {paso.condicional && (
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--acento-ambar)]">
                    No siempre aplica
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Los desvíos, aparte: no son pasos del camino, son lo que pasa cuando
          algo no sale. Mezclarlos en la vía haría el flujo ilegible. */}
      <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border bg-muted/40 px-5 py-2 text-xs">
        <span className="flex min-w-0 flex-1 basis-72 items-start gap-2">
          <XCircle className="mt-0.5 size-4 shrink-0 text-[var(--error)]" />
          <span className="text-muted-foreground">
            <strong className="text-foreground">Si la rechazan</strong>, recibes el motivo por
            correo y el trámite termina ahí.
          </span>
        </span>
        <span className="flex min-w-0 flex-1 basis-72 items-start gap-2">
          <Undo2 className="mt-0.5 size-4 shrink-0 text-[var(--acento-ambar)]" />
          <span className="text-muted-foreground">
            <strong className="text-foreground">Si el soporte no sirve</strong>, TH te lo devuelve
            indicando qué falta y subes otro.
          </span>
        </span>
      </footer>
    </section>
  )
}
