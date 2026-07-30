import { FilterX } from 'lucide-react'
import { MESES } from '@/domain/metricas'
import { ESTADOS, ETIQUETA_ESTADO, type Estado } from '@/domain/estados'
import { Button } from '@/presentation/components/ui/button'
import { Label } from '@/presentation/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'
import type { Area, Empresa } from '@/application/catalogos/useCatalogos'

export interface ValoresFiltro {
  anio: number
  mes: number | null
  areaId: number | null
  empresaId: number | null
  tramite: 'permiso' | 'vacaciones' | null
  estado: Estado | null
}

export const FILTRO_VACIO = (anio: number): ValoresFiltro => ({
  anio,
  mes: null,
  areaId: null,
  empresaId: null,
  tramite: null,
  estado: null,
})

const TODOS = '__todos__'

/** Convierte los filtros activos en texto, para el encabezado de los reportes. */
export function describirFiltros(
  v: ValoresFiltro,
  areas?: Area[],
  empresas?: Empresa[]
): string[] {
  const texto: string[] = [`Año ${v.anio}`]
  if (v.mes !== null) texto.push(`Mes: ${MESES[v.mes]}`)
  if (v.areaId) texto.push(`Área: ${areas?.find((a) => a.id === v.areaId)?.nombre ?? v.areaId}`)
  if (v.empresaId) texto.push(`Empresa: ${empresas?.find((e) => e.id === v.empresaId)?.nombre ?? v.empresaId}`)
  if (v.tramite) texto.push(`Trámite: ${v.tramite === 'vacaciones' ? 'Vacaciones' : 'Permisos'}`)
  if (v.estado) texto.push(`Estado: ${ETIQUETA_ESTADO[v.estado]}`)
  return texto
}

export function FiltrosDashboard({
  valores,
  onCambio,
  anios,
  areas,
  empresas,
}: {
  valores: ValoresFiltro
  onCambio: (v: ValoresFiltro) => void
  anios: number[]
  areas?: Area[]
  empresas?: Empresa[]
}) {
  function set<K extends keyof ValoresFiltro>(campo: K, valor: ValoresFiltro[K]) {
    onCambio({ ...valores, [campo]: valor })
  }

  const hayFiltros =
    valores.mes !== null ||
    valores.areaId !== null ||
    valores.empresaId !== null ||
    valores.tramite !== null ||
    valores.estado !== null

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/95 p-3 backdrop-blur">
      <div className="min-w-24 space-y-1">
        <Label htmlFor="f-anio" className="text-xs">Año</Label>
        <Select value={String(valores.anio)} onValueChange={(v) => set('anio', Number(v))}>
          <SelectTrigger id="f-anio" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anios.map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-28 space-y-1">
        <Label htmlFor="f-mes" className="text-xs">Mes</Label>
        <Select
          value={valores.mes === null ? TODOS : String(valores.mes)}
          onValueChange={(v) => set('mes', v === TODOS ? null : Number(v))}
        >
          <SelectTrigger id="f-mes" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {MESES.map((m, i) => (
              <SelectItem key={m} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-44 flex-1 space-y-1">
        <Label htmlFor="f-area" className="text-xs">Área o servicio</Label>
        <Select
          value={valores.areaId === null ? TODOS : String(valores.areaId)}
          onValueChange={(v) => set('areaId', v === TODOS ? null : Number(v))}
        >
          <SelectTrigger id="f-area" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {areas?.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-36 space-y-1">
        <Label htmlFor="f-empresa" className="text-xs">Empresa</Label>
        <Select
          value={valores.empresaId === null ? TODOS : String(valores.empresaId)}
          onValueChange={(v) => set('empresaId', v === TODOS ? null : Number(v))}
        >
          <SelectTrigger id="f-empresa" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {empresas?.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-32 space-y-1">
        <Label htmlFor="f-tramite" className="text-xs">Trámite</Label>
        <Select
          value={valores.tramite ?? TODOS}
          onValueChange={(v) => set('tramite', v === TODOS ? null : (v as 'permiso' | 'vacaciones'))}
        >
          <SelectTrigger id="f-tramite" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Ambos</SelectItem>
            <SelectItem value="permiso">Permisos</SelectItem>
            <SelectItem value="vacaciones">Vacaciones</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-44 space-y-1">
        <Label htmlFor="f-estado" className="text-xs">Estado</Label>
        <Select
          value={valores.estado ?? TODOS}
          onValueChange={(v) => set('estado', v === TODOS ? null : (v as Estado))}
        >
          <SelectTrigger id="f-estado" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>{ETIQUETA_ESTADO[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hayFiltros && (
        <Button variant="ghost" size="sm" onClick={() => onCambio(FILTRO_VACIO(valores.anio))}>
          <FilterX /> Limpiar
        </Button>
      )}
    </div>
  )
}
