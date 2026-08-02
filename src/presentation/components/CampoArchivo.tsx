import { useRef, useState } from 'react'
import { FileUp, Paperclip, X } from 'lucide-react'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

const MIME = 'application/pdf,image/jpeg,image/png,image/webp'

/**
 * Selector de soportes, con validación de tamaño y tipo antes de subir nada.
 *
 * Acepta **varios archivos**: casi ningún soporte real viene en un solo PDF —el
 * registro de defunción y la prueba de parentesco son dos documentos, y una
 * incapacidad escaneada suele llegar en varias fotos—. Con un único archivo, el
 * colaborador tenía que elegir cuál subía y Talento Humano le devolvía la
 * solicitud para pedirle el resto.
 *
 * Los archivos se acumulan en vez de reemplazarse: quien adjunta de dos en dos
 * desde el celular no pierde lo que ya había elegido.
 */
export function CampoArchivo({
  archivos,
  onCambio,
  maxMB = 10,
  obligatorio = false,
  id = 'soporte',
  max = 10,
}: {
  archivos: File[]
  onCambio: (a: File[]) => void
  maxMB?: number
  obligatorio?: boolean
  id?: string
  /** Tope de archivos por entrega, para no convertir un soporte en un álbum. */
  max?: number
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function agregar(nuevos: FileList | null) {
    setError(null)
    if (!nuevos || nuevos.length === 0) return

    const aceptados: File[] = []
    const rechazados: string[] = []

    for (const f of Array.from(nuevos)) {
      if (f.size > maxMB * 1024 * 1024) {
        rechazados.push(`${f.name} pesa ${(f.size / 1048576).toFixed(1)} MB`)
        continue
      }
      if (!MIME.split(',').includes(f.type)) {
        rechazados.push(`${f.name} no es PDF, JPG, PNG ni WEBP`)
        continue
      }
      // Reelegir el mismo archivo es un gesto habitual: no se duplica.
      const yaEsta = archivos.some((a) => a.name === f.name && a.size === f.size)
      if (!yaEsta) aceptados.push(f)
    }

    const total = [...archivos, ...aceptados].slice(0, max)
    if (archivos.length + aceptados.length > max) {
      rechazados.push(`solo caben ${max} archivos por entrega`)
    }

    onCambio(total)
    if (rechazados.length > 0) setError(`No se adjuntó: ${rechazados.join('; ')}.`)

    // Permite volver a elegir el mismo archivo tras quitarlo.
    if (input.current) input.current.value = ''
  }

  function quitar(indice: number) {
    setError(null)
    onCambio(archivos.filter((_, i) => i !== indice))
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={input}
        id={id}
        type="file"
        multiple
        accept={MIME}
        className="sr-only"
        onChange={(e) => agregar(e.target.files)}
      />

      {archivos.length > 0 && (
        <ul className="space-y-1">
          {archivos.map((a, i) => (
            <li
              key={`${a.name}-${a.size}-${i}`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm"
            >
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={a.name}>
                {a.name}
              </span>
              <span className="shrink-0 text-xs tabular text-muted-foreground">
                {(a.size / 1048576).toFixed(1)} MB
              </span>
              <button
                type="button"
                onClick={() => quitar(i)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`Quitar ${a.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'w-full justify-start font-normal',
          obligatorio && archivos.length === 0 && 'border-[var(--advertencia)]'
        )}
        onClick={() => input.current?.click()}
      >
        <FileUp />
        {archivos.length === 0
          ? obligatorio
            ? 'Adjuntar soportes (obligatorio)'
            : 'Adjuntar soportes (opcional)'
          : 'Adjuntar otro archivo'}
      </Button>

      {error ? (
        <p className="text-xs text-[var(--error)]">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Puedes elegir varios a la vez · PDF, JPG, PNG o WEBP · máximo {maxMB} MB cada uno
        </p>
      )}
    </div>
  )
}
