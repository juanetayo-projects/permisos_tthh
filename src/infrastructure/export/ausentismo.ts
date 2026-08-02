import type { FilaAgrupada, FilaAusentismo } from '@/domain/ausentismo'
import { ETIQUETA_NATURALEZA } from '@/domain/ausentismo'
import { ETIQUETA_ESTADO } from '@/domain/estados'
import type { Estado } from '@/domain/estados'
import { formatearFecha } from '@/lib/utils'
import { exportarExcel } from './excel'
import { exportarPdf } from './pdf'

/**
 * Exportación del módulo de ausentismo.
 *
 * Separada de la de solicitudes a propósito: el detalle de una ausencia y el de
 * una solicitud tienen columnas distintas —aquí interesan días, horas y
 * naturaleza; allí, quién autorizó y cuándo—, y una única hoja que sirviera
 * para las dos cosas no serviría bien para ninguna.
 */
const CAMPOS: {
  titulo: string
  anchoExcel: number
  anchoPdf?: string | number
  valor: (f: FilaAusentismo) => string
}[] = [
  { titulo: 'Consecutivo', anchoExcel: 16, anchoPdf: 62, valor: (f) => f.consecutivo ?? '' },
  { titulo: 'Colaborador', anchoExcel: 28, valor: (f) => f.colaborador },
  { titulo: 'Identificación', anchoExcel: 16, anchoPdf: 60, valor: (f) => f.documento ?? '' },
  { titulo: 'Proceso o área', anchoExcel: 26, valor: (f) => f.area ?? '' },
  { titulo: 'Cargo', anchoExcel: 24, valor: (f) => f.cargo ?? '' },
  { titulo: 'Empresa', anchoExcel: 20, valor: (f) => f.empresa ?? '' },
  { titulo: 'Categoría', anchoExcel: 18, valor: (f) => f.categoria ?? '' },
  {
    titulo: 'Motivo',
    anchoExcel: 30,
    valor: (f) => f.motivo ?? (f.tramite === 'vacaciones' ? 'Vacaciones' : ''),
  },
  {
    titulo: 'Naturaleza',
    anchoExcel: 20,
    anchoPdf: 62,
    valor: (f) => ETIQUETA_NATURALEZA[f.naturaleza] ?? f.naturaleza,
  },
  { titulo: 'Desde', anchoExcel: 14, anchoPdf: 52, valor: (f) => formatearFecha(f.fecha_inicio) },
  { titulo: 'Hasta', anchoExcel: 14, anchoPdf: 52, valor: (f) => formatearFecha(f.fecha_fin) },
  { titulo: 'Días', anchoExcel: 10, anchoPdf: 34, valor: (f) => String(f.dias ?? 0) },
  { titulo: 'Horas', anchoExcel: 10, anchoPdf: 34, valor: (f) => String(f.horas ?? 0) },
  { titulo: 'Remunerado', anchoExcel: 13, valor: (f) => (f.remunerado ? 'Sí' : 'No') },
  { titulo: 'Estado', anchoExcel: 24, valor: (f) => ETIQUETA_ESTADO[f.estado as Estado] ?? f.estado },
  { titulo: 'Extemporánea', anchoExcel: 14, valor: (f) => (f.extemporanea ? 'Sí' : 'No') },
]

const CLAVES_PDF = new Set([
  'Colaborador',
  'Proceso o área',
  'Motivo',
  'Naturaleza',
  'Desde',
  'Hasta',
  'Días',
])

const CAMPOS_RESUMEN: {
  titulo: string
  anchoExcel: number
  anchoPdf?: string | number
  valor: (f: FilaAgrupada) => string
}[] = [
  { titulo: 'Concepto', anchoExcel: 34, anchoPdf: '*', valor: (f) => f.etiqueta },
  { titulo: 'Detalle', anchoExcel: 28, anchoPdf: '*', valor: (f) => f.detalle ?? '' },
  { titulo: 'Eventos', anchoExcel: 12, anchoPdf: 46, valor: (f) => String(f.eventos) },
  { titulo: 'Días perdidos', anchoExcel: 14, anchoPdf: 56, valor: (f) => String(f.dias) },
  { titulo: 'Horas perdidas', anchoExcel: 14, anchoPdf: 56, valor: (f) => String(f.horas) },
  { titulo: 'Días por causa médica', anchoExcel: 20, anchoPdf: 62, valor: (f) => String(f.diasCausaMedica) },
  { titulo: 'Colaboradores', anchoExcel: 15, anchoPdf: 56, valor: (f) => String(f.colaboradores) },
  { titulo: 'Extemporáneas', anchoExcel: 15, anchoPdf: 56, valor: (f) => String(f.extemporaneas) },
]

function nombreArchivo(base: string): string {
  return `${base}_${new Date().toISOString().slice(0, 10)}`
}

export async function exportarAusentismoExcel(
  filas: FilaAusentismo[],
  filtros: string[] = [],
  titulo = 'Control de ausentismo'
): Promise<void> {
  await exportarExcel({
    nombreArchivo: nombreArchivo('ausentismo_tthh'),
    titulo,
    filtrosAplicados: filtros,
    nombreHoja: 'Ausentismo',
    columnas: CAMPOS.map((c) => ({ titulo: c.titulo, ancho: c.anchoExcel, valor: c.valor })),
    filas,
  })
}

export async function exportarAusentismoPdf(
  filas: FilaAusentismo[],
  filtros: string[] = [],
  titulo = 'Control de ausentismo'
): Promise<void> {
  await exportarPdf({
    nombreArchivo: nombreArchivo('ausentismo_tthh'),
    titulo,
    filtrosAplicados: filtros,
    columnas: CAMPOS.filter((c) => CLAVES_PDF.has(c.titulo)).map((c) => ({
      titulo: c.titulo,
      ancho: c.anchoPdf ?? '*',
      valor: c.valor,
    })),
    filas,
  })
}

/** Exporta un desglose ya agrupado (por colaborador, por área, por motivo…). */
export async function exportarResumenAusentismoExcel(
  filas: FilaAgrupada[],
  titulo: string,
  filtros: string[] = []
): Promise<void> {
  await exportarExcel({
    nombreArchivo: nombreArchivo('ausentismo_resumen'),
    titulo,
    filtrosAplicados: filtros,
    nombreHoja: 'Resumen',
    columnas: CAMPOS_RESUMEN.map((c) => ({ titulo: c.titulo, ancho: c.anchoExcel, valor: c.valor })),
    filas,
  })
}
