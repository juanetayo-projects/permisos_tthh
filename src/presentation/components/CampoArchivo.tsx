import { useRef, useState } from 'react'
import { FileUp, Paperclip, X } from 'lucide-react'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

const MIME = 'application/pdf,image/jpeg,image/png,image/webp'

/** Selector de soporte con validación de tamaño y tipo antes de subir nada. */
export function CampoArchivo({
  archivo,
  onCambio,
  maxMB = 10,
  obligatorio = false,
  id = 'soporte',
}: {
  archivo: File | null
  onCambio: (a: File | null) => void
  maxMB?: number
  obligatorio?: boolean
  id?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function seleccionar(f: File | null) {
    setError(null)
    if (!f) return onCambio(null)

    if (f.size > maxMB * 1024 * 1024) {
      setError(`El archivo pesa ${(f.size / 1048576).toFixed(1)} MB y el máximo son ${maxMB} MB.`)
      return
    }
    if (!MIME.split(',').includes(f.type)) {
      setError('Solo se aceptan archivos PDF, JPG, PNG o WEBP.')
      return
    }
    onCambio(f)
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={input}
        id={id}
        type="file"
        accept={MIME}
        className="sr-only"
        onChange={(e) => seleccionar(e.target.files?.[0] ?? null)}
      />

      {archivo ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate" title={archivo.name}>
            {archivo.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground tabular">
            {(archivo.size / 1048576).toFixed(1)} MB
          </span>
          <button
            type="button"
            onClick={() => {
              onCambio(null)
              if (input.current) input.current.value = ''
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Quitar archivo"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn('w-full justify-start font-normal', obligatorio && !archivo && 'border-[var(--advertencia)]')}
          onClick={() => input.current?.click()}
        >
          <FileUp />
          {obligatorio ? 'Adjuntar soporte (obligatorio)' : 'Adjuntar soporte (opcional)'}
        </Button>
      )}

      {error ? (
        <p className="text-xs text-[var(--error)]">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP · máximo {maxMB} MB</p>
      )}
    </div>
  )
}
