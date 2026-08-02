import { CheckCircle2, Circle, FileText, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentoConEstado, MomentoSoporte } from '@/domain/soportes'

const TITULO: Record<MomentoSoporte, string> = {
  previo: 'Documentos al solicitar',
  posterior: 'Documentos al finalizar',
}

const VACIO: Record<MomentoSoporte, string> = {
  previo: 'Este motivo no exige adjuntar nada al solicitar.',
  posterior: 'Este motivo no exige documentos al regresar.',
}

/**
 * Lista de documentos que exige el motivo, con su norma y su estado.
 *
 * Sustituye al mensaje genérico «adjunta el soporte», que era la causa más
 * frecuente de que un trámite diera una vuelta completa: el colaborador subía
 * lo que creía y Talento Humano lo devolvía. Aquí cada documento se nombra, se
 * dice si es obligatorio y se cita la norma que lo pide, que es lo que evita la
 * conversación de «¿y esto por qué?».
 *
 * Se usa en los dos momentos con la misma pieza: al solicitar como aviso
 * anticipado, y al regresar como lista de verificación real.
 */
export function ListaDocumentos({
  documentos,
  momento,
  className,
  /** Muestra el círculo de entregado/pendiente. Al solicitar todavía no aplica. */
  conEstado = false,
  /** Se pinta al final de cada documento: el control para subirlo, por ejemplo. */
  accion,
}: {
  documentos: DocumentoConEstado[]
  momento: MomentoSoporte
  className?: string
  conEstado?: boolean
  accion?: (d: DocumentoConEstado) => React.ReactNode
}) {
  // Los que no aplican por el umbral de días se ocultan: enseñar un documento
  // que no se va a pedir es ruido, y el aviso del umbral ya lo cuenta aparte.
  const visibles = documentos.filter((d) => d.exigible || d.obligatorio)

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {TITULO[momento]}
      </p>

      {visibles.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
          {VACIO[momento]}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visibles.map((d) => (
            <li
              key={`${d.id}-${d.momento}`}
              className={cn(
                'rounded-md border p-2',
                d.entregado
                  ? 'border-[var(--tinte-verde-borde)] bg-[var(--tinte-verde)]'
                  : d.exigible && d.obligatorio
                    ? 'border-[var(--tinte-ambar-borde)] bg-[var(--tinte-ambar)]'
                    : 'border-border bg-card'
              )}
            >
              <div className="flex items-start gap-2">
                {conEstado ? (
                  d.entregado ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--exito)]" />
                  ) : (
                    <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  )
                ) : (
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-snug">
                    {d.nombre}
                    <span
                      className={cn(
                        'ml-1.5 rounded px-1 py-px text-[10px] font-semibold uppercase',
                        d.exigible && d.obligatorio
                          ? 'bg-[var(--advertencia-suave)] text-[#8a6400] dark:text-[var(--advertencia)]'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {d.exigible && d.obligatorio ? 'Obligatorio' : 'Opcional'}
                    </span>
                  </p>

                  {d.nota && (
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{d.nota}</p>
                  )}

                  {/* La norma no es decoración: es lo que sustenta la exigencia
                      cuando el colaborador pregunta por qué se le pide. */}
                  {d.norma && (
                    <p className="mt-0.5 flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
                      <Scale className="mt-px size-2.5 shrink-0" />
                      {d.norma}
                    </p>
                  )}
                </div>
              </div>

              {accion && <div className="mt-1.5">{accion(d)}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
