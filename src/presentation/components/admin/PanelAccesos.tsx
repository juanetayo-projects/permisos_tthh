import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, RotateCcw, Save } from 'lucide-react'
import { useAccesos, useGuardarAccesosRol } from '@/application/admin/useAccesos'
import { ETIQUETA_ROL, ROLES, type Rol } from '@/domain/estados'
import {
  ACCESOS_POR_DEFECTO,
  DEFINICION_MODULOS,
  esAccesoFijo,
  type MatrizAccesos,
  type Modulo,
} from '@/domain/modulos'
import { cn } from '@/lib/utils'
import { Button } from '@/presentation/components/ui/button'
import { Checkbox } from '@/presentation/components/ui/checkbox'
import { SkeletonTabla } from '@/presentation/components/ui/skeleton'

type Borrador = Record<Rol, Set<Modulo>>

function aBorrador(matriz: MatrizAccesos): Borrador {
  return Object.fromEntries(ROLES.map((r) => [r, new Set(matriz[r])])) as Borrador
}

/**
 * Reparto de pantallas por rol.
 *
 * Estaba escrito en el código —una lista de roles junto a cada enlace y cada
 * ruta—, así que mover una casilla exigía compilar y publicar. La organización
 * cambia más a menudo que eso.
 *
 * Se edita sobre un borrador y se guarda rol por rol, no casilla por casilla:
 * quitar y volver a poner mientras se piensa el reparto no tiene por qué
 * quedar registrado, y un guardado por clic dejaría a la gente con el menú
 * cambiando debajo a media edición.
 */
export function PanelAccesos() {
  const { data: matriz, isLoading } = useAccesos()
  const guardar = useGuardarAccesosRol()

  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    if (matriz) setBorrador(aBorrador(matriz))
  }, [matriz])

  const sucios = useMemo(() => {
    if (!matriz || !borrador) return new Set<Rol>()

    return new Set(
      ROLES.filter((rol) => {
        const antes = new Set(matriz[rol])
        const ahora = borrador[rol]
        return antes.size !== ahora.size || [...ahora].some((m) => !antes.has(m))
      })
    )
  }, [matriz, borrador])

  function alternar(rol: Rol, modulo: Modulo) {
    if (esAccesoFijo(rol, modulo)) return
    setGuardado(false)
    setBorrador((b) => {
      if (!b) return b
      const copia = { ...b, [rol]: new Set(b[rol]) }
      if (copia[rol].has(modulo)) copia[rol].delete(modulo)
      else copia[rol].add(modulo)
      return copia
    })
  }

  function restaurar() {
    setGuardado(false)
    setError(null)
    setBorrador(aBorrador(ACCESOS_POR_DEFECTO))
  }

  async function aplicar() {
    if (!borrador) return
    setError(null)
    setGuardado(false)

    try {
      for (const rol of sucios) {
        await guardar.mutateAsync({ rol, modulos: [...borrador[rol]] })
      }
      setGuardado(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible guardar el reparto.')
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Accesos por rol</h2>
          <p className="text-sm text-muted-foreground">
            Qué pantallas ve cada rol. Marca y guarda: no hace falta publicar nada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={restaurar} disabled={guardar.isPending}>
            <RotateCcw /> Reparto sugerido
          </Button>
          <Button
            size="sm"
            disabled={sucios.size === 0}
            cargando={guardar.isPending}
            onClick={() => void aplicar()}
          >
            {!guardar.isPending && <Save />}
            {sucios.size === 0
              ? 'Sin cambios'
              : `Guardar ${sucios.size} rol${sucios.size === 1 ? '' : 'es'}`}
          </Button>
        </div>
      </div>

      {/* La distinción que hay que tener clara antes de repartir casillas: esto
          ordena la aplicación, no la asegura. */}
      <p className="bloque-datos flex items-start gap-2 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>
          Esto decide <strong>qué pantallas</strong> ve cada rol, no qué datos alcanza. Marcarle a
          un colaborador «Todas las solicitudes» le da la pantalla, y la pantalla le seguirá
          mostrando <strong>solo las suyas</strong>: el alcance de la información lo decide la base
          de datos y no se toca desde aquí.
        </span>
      </p>

      {guardado && (
        <p className="flex items-center gap-2 rounded-md bg-[var(--exito-suave)] p-3 text-sm text-[var(--exito)]">
          <CheckCircle2 className="size-4 shrink-0" />
          Reparto guardado. Cada persona lo verá al recargar la aplicación.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {isLoading || !borrador ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <SkeletonTabla filas={6} columnas={7} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="tabla-cac w-full min-w-[56rem] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                  Pantalla
                </th>
                {ROLES.map((rol) => (
                  <th
                    key={rol}
                    className={cn(
                      'w-28 px-3 py-2.5 text-center font-semibold text-muted-foreground',
                      sucios.has(rol) && 'text-[var(--acento-ambar)]'
                    )}
                  >
                    {ETIQUETA_ROL[rol]}
                    {sucios.has(rol) && <span className="block text-[11px] font-normal">sin guardar</span>}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {DEFINICION_MODULOS.map((m) => (
                <tr key={m.codigo} className="border-t border-border">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{m.etiqueta}</p>
                    <p className="text-xs text-muted-foreground">{m.descripcion}</p>
                  </td>

                  {ROLES.map((rol) => {
                    const fijo = esAccesoFijo(rol, m.codigo)

                    return (
                      <td key={rol} className="px-3 py-2.5 text-center">
                        <Checkbox
                          checked={borrador[rol].has(m.codigo)}
                          disabled={fijo || guardar.isPending}
                          onCheckedChange={() => alternar(rol, m.codigo)}
                          aria-label={`${m.etiqueta} para ${ETIQUETA_ROL[rol]}`}
                          title={
                            fijo
                              ? 'No se puede quitar: dejaría la aplicación sin quien reparta estos accesos.'
                              : undefined
                          }
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
