import { useState } from 'react'
import { AlertCircle, Check, Pencil, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useAlternarActivo,
  useCatalogo,
  useGuardarFila,
  type TablaCatalogo,
} from '@/application/admin/useCatalogoCrud'
import { Button } from '@/presentation/components/ui/button'
import { Checkbox } from '@/presentation/components/ui/checkbox'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { SkeletonTabla } from '@/presentation/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

export interface CampoCatalogo {
  clave: string
  etiqueta: string
  tipo: 'texto' | 'numero' | 'booleano' | 'seleccion'
  opciones?: { valor: string; etiqueta: string }[]
  ayuda?: string
  requerido?: boolean
  /** Ancho relativo en la tabla. */
  ancho?: string
  /** No se muestra en la tabla, solo al editar. */
  soloEnFormulario?: boolean
}

interface FilaCatalogo {
  id: number
  activo: boolean
  [clave: string]: unknown
}

/**
 * Editor de catálogos reutilizable.
 *
 * Los cinco catálogos administrables tienen la misma forma, así que se
 * describen por configuración en vez de escribir cinco pantallas casi
 * idénticas. La edición es en línea: quien administra ve la lista completa
 * mientras cambia una fila, que es como se trabaja con un catálogo.
 */
export function EditorCatalogo({
  tabla,
  campos,
  titulo,
  descripcion,
  orden = 'orden',
  valoresPorDefecto = {},
  advertencia,
}: {
  tabla: TablaCatalogo
  campos: CampoCatalogo[]
  titulo: string
  descripcion: string
  orden?: string
  valoresPorDefecto?: Record<string, unknown>
  /** Aviso destacado, p. ej. cuando el catálogo lo comparten dos aplicaciones. */
  advertencia?: string
}) {
  const { data: filas, isLoading } = useCatalogo<FilaCatalogo>(tabla, orden)
  const guardar = useGuardarFila(tabla)
  const alternar = useAlternarActivo(tabla)

  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const [borrador, setBorrador] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)

  const enTabla = campos.filter((c) => !c.soloEnFormulario)

  function abrir(fila?: FilaCatalogo) {
    setError(null)
    if (fila) {
      setEditando(fila.id)
      setBorrador(Object.fromEntries(campos.map((c) => [c.clave, fila[c.clave]])))
    } else {
      setEditando('nuevo')
      setBorrador({ activo: true, ...valoresPorDefecto })
    }
  }

  async function confirmar() {
    setError(null)

    const faltante = campos.find(
      (c) => c.requerido && (borrador[c.clave] === undefined || borrador[c.clave] === '')
    )
    if (faltante) {
      setError(`El campo «${faltante.etiqueta}» es obligatorio.`)
      return
    }

    try {
      await guardar.mutateAsync(editando === 'nuevo' ? borrador : { ...borrador, id: editando as number })
      setEditando(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible guardar.')
    }
  }

  function mostrar(fila: FilaCatalogo, campo: CampoCatalogo): React.ReactNode {
    const v = fila[campo.clave]
    if (campo.tipo === 'booleano') return v ? 'Sí' : 'No'
    if (campo.tipo === 'seleccion') {
      return campo.opciones?.find((o) => o.valor === String(v))?.etiqueta ?? String(v ?? '—')
    }
    return v === null || v === undefined || v === '' ? '—' : String(v)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        <Button size="sm" onClick={() => abrir()} disabled={editando !== null}>
          <Plus /> Agregar
        </Button>
      </div>

      {advertencia && (
        <p className="flex items-start gap-2 rounded-md border border-[var(--tinte-ambar-borde)] bg-[var(--tinte-ambar)] p-3 text-sm text-[var(--acento-ambar)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {advertencia}
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {editando === 'nuevo' && (
        <FormularioFila
          campos={campos}
          borrador={borrador}
          setBorrador={setBorrador}
          guardando={guardar.isPending}
          onConfirmar={confirmar}
          onCancelar={() => setEditando(null)}
        />
      )}

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <SkeletonTabla filas={4} columnas={enTabla.length + 1} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="tabla-cac w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/60">
              <tr>
                {enTabla.map((c) => (
                  <th key={c.clave} className={cn('px-3 py-2.5 text-left font-semibold text-muted-foreground', c.ancho)}>
                    {c.etiqueta}
                  </th>
                ))}
                <th className="w-32 px-3 py-2.5 text-right font-semibold text-muted-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {(filas ?? []).map((fila) =>
                editando === fila.id ? (
                  <tr key={fila.id}>
                    <td colSpan={enTabla.length + 1} className="p-3">
                      <FormularioFila
                        campos={campos}
                        borrador={borrador}
                        setBorrador={setBorrador}
                        guardando={guardar.isPending}
                        onConfirmar={confirmar}
                        onCancelar={() => setEditando(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={fila.id} className={cn('border-t border-border', !fila.activo && 'opacity-55')}>
                    {enTabla.map((c) => (
                      <td key={c.clave} className="px-3 py-2.5">
                        {mostrar(fila, c)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrir(fila)}
                          disabled={editando !== null}
                          aria-label={`Editar ${String(fila.nombre ?? fila.id)}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          cargando={alternar.isPending}
                          onClick={() => void alternar.mutateAsync({ id: fila.id, activo: !fila.activo })}
                          title={
                            fila.activo
                              ? 'Desactivar: deja de aparecer en los formularios, pero el histórico se conserva'
                              : 'Reactivar'
                          }
                        >
                          {fila.activo ? <X /> : <Check />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Los catálogos no se eliminan: se desactivan. Así desaparecen de los formularios sin romper
        las solicitudes que ya los usaron.
      </p>
    </section>
  )
}

function FormularioFila({
  campos,
  borrador,
  setBorrador,
  guardando,
  onConfirmar,
  onCancelar,
}: {
  campos: CampoCatalogo[]
  borrador: Record<string, unknown>
  setBorrador: (v: Record<string, unknown>) => void
  guardando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  function set(clave: string, valor: unknown) {
    setBorrador({ ...borrador, [clave]: valor })
  }

  return (
    <div className="bloque-datos bloque-teal space-y-3 p-3">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {campos.map((c) => (
          <div key={c.clave} className="space-y-1">
            <Label htmlFor={`campo-${c.clave}`}>
              {c.etiqueta}
              {c.requerido && <span className="text-[var(--error)]"> *</span>}
            </Label>

            {c.tipo === 'booleano' ? (
              <label className="flex h-10 items-center gap-2 text-sm">
                <Checkbox
                  id={`campo-${c.clave}`}
                  checked={Boolean(borrador[c.clave])}
                  onCheckedChange={(v) => set(c.clave, v === true)}
                />
                {borrador[c.clave] ? 'Sí' : 'No'}
              </label>
            ) : c.tipo === 'seleccion' ? (
              <Select
                value={borrador[c.clave] === undefined || borrador[c.clave] === null ? '' : String(borrador[c.clave])}
                onValueChange={(v) => set(c.clave, v)}
              >
                <SelectTrigger id={`campo-${c.clave}`}>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {c.opciones?.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`campo-${c.clave}`}
                type={c.tipo === 'numero' ? 'number' : 'text'}
                value={borrador[c.clave] === null || borrador[c.clave] === undefined ? '' : String(borrador[c.clave])}
                onChange={(e) =>
                  set(
                    c.clave,
                    c.tipo === 'numero'
                      ? e.target.value === ''
                        ? null
                        : Number(e.target.value)
                      : e.target.value
                  )
                }
              />
            )}

            {c.ayuda && <p className="text-xs text-muted-foreground">{c.ayuda}</p>}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button size="sm" cargando={guardando} onClick={onConfirmar}>
          <Check /> Guardar
        </Button>
      </div>
    </div>
  )
}
