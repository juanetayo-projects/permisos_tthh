import { useEffect, useState } from 'react'
import { useBuscarCie10, type Cie10 } from '@/application/catalogos/useCatalogos'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { Obligatorio } from '@/presentation/components/ui/obligatorio'

/**
 * Busca un diagnóstico en el catálogo CIE10 por código o por nombre.
 *
 * La incapacidad pide hasta cuatro (principal + tres relacionados), todos
 * contra la misma tabla de más de 12.000 filas, así que la búsqueda con
 * debounce vive una sola vez aquí en vez de repetirse por campo.
 */
export function CampoCie10({
  id,
  etiqueta,
  valor,
  onCambio,
  obligatorio,
}: {
  id: string
  etiqueta: string
  valor: Cie10 | null
  onCambio: (dx: Cie10 | null) => void
  obligatorio?: boolean
}) {
  const [termino, setTermino] = useState('')
  const [buscando, setBuscando] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBuscando(termino), 200)
    return () => clearTimeout(t)
  }, [termino])
  const { data: resultados, isFetching: cargando } = useBuscarCie10(buscando)

  return (
    <div className="relative space-y-1">
      <Label htmlFor={id}>
        {etiqueta}
        {obligatorio && <Obligatorio />}
      </Label>
      <Input
        id={id}
        value={valor ? `${valor.codigo} · ${valor.nombre}` : termino}
        onChange={(e) => {
          onCambio(null)
          setTermino(e.target.value)
        }}
        placeholder="Código o nombre del diagnóstico…"
        autoComplete="off"
      />
      {!valor && termino.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {cargando && <p className="p-2 text-xs text-muted-foreground">Buscando…</p>}
          {!cargando && (resultados?.length ?? 0) === 0 && (
            <p className="p-2 text-xs text-muted-foreground">Sin resultados.</p>
          )}
          {resultados?.map((d) => (
            <button
              key={d.codigo}
              type="button"
              className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onCambio(d)
                setTermino('')
              }}
            >
              <span className="font-medium">{d.codigo}</span> · {d.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
