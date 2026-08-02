import { FilterX, Search } from 'lucide-react'
import { MESES_CORTOS, ETIQUETA_NATURALEZA } from '@/domain/ausentismo'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'
import type { Area, Cargo, Empresa, Tipo } from '@/application/catalogos/useCatalogos'

export interface FiltroAusentismo {
  anio: number
  mes: number | null
  areaId: number | null
  cargoId: number | null
  empresaId: number | null
  tipoId: number | null
  naturaleza: string | null
  tramite: 'permiso' | 'vacaciones' | null
  /** Busca por nombre o documento del colaborador. */
  texto: string
  /** Fechas exactas: mandan sobre año y mes cuando se diligencian. */
  desde: string
  hasta: string
}

export const FILTRO_AUSENTISMO_VACIO = (anio: number): FiltroAusentismo => ({
  anio,
  mes: null,
  areaId: null,
  cargoId: null,
  empresaId: null,
  tipoId: null,
  naturaleza: null,
  tramite: null,
  texto: '',
  desde: '',
  hasta: '',
})

const TODOS = '__todos__'

/** Filtros activos en texto, para encabezar el Excel y el PDF. */
export function describirFiltroAusentismo(
  v: FiltroAusentismo,
  catalogos: { areas?: Area[]; cargos?: Cargo[]; empresas?: Empresa[]; tipos?: Tipo[] }
): string[] {
  const texto: string[] = []

  if (v.desde || v.hasta) texto.push(`Periodo: ${v.desde || 'inicio'} → ${v.hasta || 'hoy'}`)
  else {
    texto.push(`Año ${v.anio}`)
    if (v.mes !== null) texto.push(`Mes: ${MESES_CORTOS[v.mes]}`)
  }

  if (v.areaId) texto.push(`Proceso o área: ${nombre(catalogos.areas, v.areaId)}`)
  if (v.cargoId) texto.push(`Cargo: ${nombre(catalogos.cargos, v.cargoId)}`)
  if (v.empresaId) texto.push(`Empresa: ${nombre(catalogos.empresas, v.empresaId)}`)
  if (v.tipoId) texto.push(`Motivo: ${nombre(catalogos.tipos, v.tipoId)}`)
  if (v.naturaleza) texto.push(`Naturaleza: ${ETIQUETA_NATURALEZA[v.naturaleza] ?? v.naturaleza}`)
  if (v.tramite) texto.push(`Trámite: ${v.tramite === 'vacaciones' ? 'Vacaciones' : 'Permisos'}`)
  if (v.texto.trim()) texto.push(`Colaborador: «${v.texto.trim()}»`)

  return texto
}

function nombre(lista: { id: number; nombre: string }[] | undefined, id: number): string {
  return lista?.find((x) => x.id === id)?.nombre ?? String(id)
}

/**
 * Barra de filtros del módulo de ausentismo.
 *
 * Talento Humano pidió poder cruzar por todo: proceso, fechas, colaborador y
 * lo que haga falta. Se resuelve en una sola barra pegada arriba, porque el
 * flujo real es filtrar, mirar la tabla y volver a filtrar sin perder el
 * contexto.
 *
 * El rango de fechas manda sobre año y mes cuando se diligencia: son dos formas
 * de decir lo mismo y mezclarlas producía resultados vacíos que parecían un
 * fallo de datos.
 */
export function FiltrosAusentismo({
  valores,
  onCambio,
  anios,
  areas,
  cargos,
  empresas,
  tipos,
}: {
  valores: FiltroAusentismo
  onCambio: (v: FiltroAusentismo) => void
  anios: number[]
  areas?: Area[]
  cargos?: Cargo[]
  empresas?: Empresa[]
  tipos?: Tipo[]
}) {
  function set<K extends keyof FiltroAusentismo>(campo: K, valor: FiltroAusentismo[K]) {
    onCambio({ ...valores, [campo]: valor })
  }

  const porFechas = Boolean(valores.desde || valores.hasta)
  const hayFiltros =
    porFechas ||
    valores.mes !== null ||
    valores.areaId !== null ||
    valores.cargoId !== null ||
    valores.empresaId !== null ||
    valores.tipoId !== null ||
    valores.naturaleza !== null ||
    valores.tramite !== null ||
    valores.texto.trim() !== ''

  return (
    <div className="sticky top-0 z-20 space-y-2 rounded-lg border border-border bg-card/95 p-3 backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-24 space-y-1">
          <Label htmlFor="a-anio" className="text-xs">Año</Label>
          <Select
            value={String(valores.anio)}
            onValueChange={(v) => set('anio', Number(v))}
            disabled={porFechas}
          >
            <SelectTrigger id="a-anio" className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-28 space-y-1">
          <Label htmlFor="a-mes" className="text-xs">Mes</Label>
          <Select
            value={valores.mes === null ? TODOS : String(valores.mes)}
            onValueChange={(v) => set('mes', v === TODOS ? null : Number(v))}
            disabled={porFechas}
          >
            <SelectTrigger id="a-mes" className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {MESES_CORTOS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="a-desde" className="text-xs">Desde</Label>
          <Input
            id="a-desde"
            type="date"
            className="h-9"
            value={valores.desde}
            onChange={(e) => set('desde', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="a-hasta" className="text-xs">Hasta</Label>
          <Input
            id="a-hasta"
            type="date"
            className="h-9"
            value={valores.hasta}
            onChange={(e) => set('hasta', e.target.value)}
          />
        </div>

        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="a-colaborador" className="text-xs">Colaborador</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="a-colaborador"
              className="h-9 pl-8"
              placeholder="Nombre o documento…"
              value={valores.texto}
              onChange={(e) => set('texto', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1 space-y-1">
          <Label htmlFor="a-area" className="text-xs">Proceso o área</Label>
          <Select
            value={valores.areaId === null ? TODOS : String(valores.areaId)}
            onValueChange={(v) => set('areaId', v === TODOS ? null : Number(v))}
          >
            <SelectTrigger id="a-area" className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {areas?.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-40 space-y-1">
          <Label htmlFor="a-cargo" className="text-xs">Cargo</Label>
          <Select
            value={valores.cargoId === null ? TODOS : String(valores.cargoId)}
            onValueChange={(v) => set('cargoId', v === TODOS ? null : Number(v))}
          >
            <SelectTrigger id="a-cargo" className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {cargos?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-36 space-y-1">
          <Label htmlFor="a-empresa" className="text-xs">Empresa</Label>
          <Select
            value={valores.empresaId === null ? TODOS : String(valores.empresaId)}
            onValueChange={(v) => set('empresaId', v === TODOS ? null : Number(v))}
          >
            <SelectTrigger id="a-empresa" className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {empresas?.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-44 space-y-1">
          <Label htmlFor="a-motivo" className="text-xs">Motivo</Label>
          <Select
            value={valores.tipoId === null ? TODOS : String(valores.tipoId)}
            onValueChange={(v) => set('tipoId', v === TODOS ? null : Number(v))}
          >
            <SelectTrigger id="a-motivo" className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {tipos?.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-40 space-y-1">
          <Label htmlFor="a-naturaleza" className="text-xs">Naturaleza</Label>
          <Select
            value={valores.naturaleza ?? TODOS}
            onValueChange={(v) => set('naturaleza', v === TODOS ? null : v)}
          >
            <SelectTrigger id="a-naturaleza" className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {Object.entries(ETIQUETA_NATURALEZA)
                .filter(([k]) => k !== 'tramite')
                .map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-32 space-y-1">
          <Label htmlFor="a-tramite" className="text-xs">Trámite</Label>
          <Select
            value={valores.tramite ?? TODOS}
            onValueChange={(v) => set('tramite', v === TODOS ? null : (v as 'permiso' | 'vacaciones'))}
          >
            <SelectTrigger id="a-tramite" className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Ambos</SelectItem>
              <SelectItem value="permiso">Permisos</SelectItem>
              <SelectItem value="vacaciones">Vacaciones</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hayFiltros && (
          <Button variant="ghost" size="sm" onClick={() => onCambio(FILTRO_AUSENTISMO_VACIO(valores.anio))}>
            <FilterX /> Limpiar
          </Button>
        )}
      </div>
    </div>
  )
}
