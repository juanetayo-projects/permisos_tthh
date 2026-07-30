import { useMemo, useState } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
import { useAuditoria, type RegistroAuditoria } from '@/application/admin/useCatalogoCrud'
import { Badge } from '@/presentation/components/ui/badge'
import { Input } from '@/presentation/components/ui/input'
import { SkeletonTabla } from '@/presentation/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'

const TONO_ACCION = {
  INSERT: 'exito',
  UPDATE: 'info',
  DELETE: 'error',
} as const

const ETIQUETA_ACCION: Record<string, string> = {
  INSERT: 'Creación',
  UPDATE: 'Modificación',
  DELETE: 'Eliminación',
}

const NOMBRE_TABLA: Record<string, string> = {
  permisos_solicitudes: 'Solicitudes',
  permisos_detalle_permiso: 'Detalle de permiso',
  permisos_detalle_vacaciones: 'Detalle de vacaciones',
  permisos_perfiles: 'Perfiles',
  permisos_adjuntos: 'Adjuntos',
  permisos_empresas: 'Empresas',
  permisos_categorias: 'Categorías',
  permisos_tipos: 'Tipos de permiso',
  permisos_tramites: 'Trámites',
  permisos_config: 'Parámetros',
}

/**
 * Consulta del registro de auditoría exigido por ISO 9001.
 *
 * Es solo de lectura por diseño: la tabla tiene revocados UPDATE y DELETE, así
 * que ni siquiera un administrador puede reescribir la historia desde la app.
 */
export function PanelAuditoria() {
  const { data: registros, isLoading } = useAuditoria(300)
  const [busqueda, setBusqueda] = useState('')
  const [detalle, setDetalle] = useState<RegistroAuditoria | null>(null)

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return registros ?? []
    return (registros ?? []).filter((r) =>
      [r.tabla, NOMBRE_TABLA[r.tabla], r.actor_correo, r.accion, r.registro_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t))
    )
  }, [registros, busqueda])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Auditoría</h2>
          <p className="text-sm text-muted-foreground">
            Últimos {registros?.length ?? 0} movimientos. Solo lectura: el registro no se puede
            modificar ni borrar desde la aplicación.
          </p>
        </div>

        <div className="relative min-w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por tabla, usuario o acción…"
            className="pl-9"
            aria-label="Buscar en la auditoría"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <SkeletonTabla filas={6} columnas={5} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">
            {busqueda ? 'Sin resultados' : 'Todavía no hay movimientos registrados'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada creación, cambio o borrado quedará aquí con su autor y su marca de tiempo.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="tabla-cac w-full min-w-[48rem] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="w-44 px-3 py-2.5 text-left font-semibold text-muted-foreground">Fecha</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Tabla</th>
                <th className="w-36 px-3 py-2.5 text-left font-semibold text-muted-foreground">Acción</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Usuario</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Campos</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-border"
                  onClick={() => setDetalle(r)}
                >
                  <td className="px-3 py-2.5 tabular text-xs">
                    {new Date(r.created_at).toLocaleString('es-CO', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td className="px-3 py-2.5">{NOMBRE_TABLA[r.tabla] ?? r.tabla}</td>
                  <td className="px-3 py-2.5">
                    <Badge tono={TONO_ACCION[r.accion as keyof typeof TONO_ACCION] ?? 'neutro'}>
                      {ETIQUETA_ACCION[r.accion] ?? r.accion}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{r.actor_correo ?? 'Sistema'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.campos_cambiados?.length ? r.campos_cambiados.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(detalle)} onOpenChange={(v) => !v && setDetalle(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {ETIQUETA_ACCION[detalle?.accion ?? ''] ?? detalle?.accion} ·{' '}
              {NOMBRE_TABLA[detalle?.tabla ?? ''] ?? detalle?.tabla}
            </DialogTitle>
            <DialogDescription>
              {detalle?.actor_correo ?? 'Sistema'} ·{' '}
              {detalle && new Date(detalle.created_at).toLocaleString('es-CO')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Antes</p>
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                {detalle?.datos_antes ? JSON.stringify(detalle.datos_antes, null, 2) : '—'}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Después</p>
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                {detalle?.datos_despues ? JSON.stringify(detalle.datos_despues, null, 2) : '—'}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
