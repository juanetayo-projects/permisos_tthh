import { useState } from 'react'
import { AlertCircle, Check, RotateCcw } from 'lucide-react'
import { useGuardarParametro, useParametros } from '@/application/admin/useCatalogoCrud'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Skeleton } from '@/presentation/components/ui/skeleton'

/**
 * Parámetros de operación.
 *
 * Son los valores que el negocio ajusta sin desplegar: las horas de antelación,
 * el umbral de días que obliga a soporte, el tamaño máximo de los adjuntos.
 * Se guardan como JSON, así que el editor detecta el tipo por el valor actual
 * en vez de exigir que el usuario escriba comillas o corchetes.
 */
export function PanelParametros() {
  const { data: parametros, isLoading } = useParametros()
  const guardar = useGuardarParametro()

  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<string | null>(null)

  function textoDe(valor: unknown): string {
    if (typeof valor === 'string') return valor
    return JSON.stringify(valor)
  }

  async function confirmar(clave: string, valorOriginal: unknown) {
    setError(null)
    setGuardado(null)

    const texto = borradores[clave]
    if (texto === undefined) return

    let valor: unknown
    if (typeof valorOriginal === 'string') {
      valor = texto
    } else {
      try {
        valor = JSON.parse(texto)
      } catch {
        setError(
          `El valor de «${clave}» no es válido. Usa un número (48), una lista (["dominio.com"]) o true/false.`
        )
        return
      }
    }

    try {
      await guardar.mutateAsync({ clave, valor })
      setBorradores((b) => {
        const n = { ...b }
        delete n[clave]
        return n
      })
      setGuardado(clave)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible guardar el parámetro.')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Parámetros de operación</h2>
        <p className="text-sm text-muted-foreground">
          Reglas que la clínica puede ajustar sin volver a desplegar la aplicación.
        </p>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="space-y-2">
        {(parametros ?? []).map((p) => {
          const original = textoDe(p.valor)
          const editado = borradores[p.clave]
          const cambiado = editado !== undefined && editado !== original

          return (
            <div key={p.clave} className="bloque-datos bloque-violeta p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-56 flex-1">
                  <p className="font-mono text-sm font-medium">{p.clave}</p>
                  {p.descripcion && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.descripcion}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    value={editado ?? original}
                    onChange={(e) => setBorradores((b) => ({ ...b, [p.clave]: e.target.value }))}
                    className="w-56 font-mono text-sm"
                    aria-label={`Valor de ${p.clave}`}
                  />
                  {cambiado ? (
                    <>
                      <Button
                        size="sm"
                        cargando={guardar.isPending}
                        onClick={() => void confirmar(p.clave, p.valor)}
                      >
                        <Check /> Guardar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setBorradores((b) => {
                            const n = { ...b }
                            delete n[p.clave]
                            return n
                          })
                        }
                        aria-label="Descartar cambio"
                      >
                        <RotateCcw />
                      </Button>
                    </>
                  ) : guardado === p.clave ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--exito)]">
                      <Check className="size-3.5" /> Guardado
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
