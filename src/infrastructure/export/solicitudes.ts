import type { SolicitudLista } from '@/application/solicitudes/useSolicitudes'
import { ETIQUETA_ESTADO } from '@/domain/estados'
import { etiquetaTramite } from '@/domain/tramites'
import { formatearFecha } from '@/lib/utils'
import { exportarExcel } from './excel'
import { exportarPdf } from './pdf'

/**
 * Definición única de las columnas exportables.
 *
 * Excel y PDF comparten el mismo mapeo para que ambos archivos digan
 * exactamente lo mismo; solo cambia el ancho, porque el PDF es más estrecho.
 */
const CAMPOS: { titulo: string; anchoExcel: number; anchoPdf?: string | number; valor: (s: SolicitudLista) => string }[] = [
  { titulo: 'Consecutivo', anchoExcel: 16, anchoPdf: 62, valor: (s) => s.consecutivo ?? 'Borrador' },
  { titulo: 'Trámite', anchoExcel: 14, anchoPdf: 52, valor: (s) => etiquetaTramite(s.tramite?.codigo) },
  { titulo: 'Formato', anchoExcel: 14, anchoPdf: 52, valor: (s) => s.tramite?.codigo_formato ?? '' },
  { titulo: 'Solicitante', anchoExcel: 26, valor: (s) => s.solicitante?.nombre ?? '' },
  { titulo: 'Identificación', anchoExcel: 16, anchoPdf: 60, valor: (s) => s.solicitante?.documento ?? '' },
  { titulo: 'Empresa', anchoExcel: 20, valor: (s) => s.empresa?.nombre ?? '' },
  { titulo: 'Área o servicio', anchoExcel: 26, valor: (s) => s.area?.nombre ?? '' },
  {
    titulo: 'Categoría',
    anchoExcel: 18,
    valor: (s) =>
      s.tramite?.codigo === 'permiso'
        ? (s.detalle_permiso?.categoria?.nombre ?? '')
        : etiquetaTramite(s.tramite?.codigo),
  },
  {
    titulo: 'Motivo',
    anchoExcel: 24,
    valor: (s) =>
      s.tramite?.codigo === 'vacaciones' ? 'Periodo de vacaciones' : (s.detalle_permiso?.tipo?.nombre ?? ''),
  },
  { titulo: 'Fecha de solicitud', anchoExcel: 16, anchoPdf: 58, valor: (s) => formatearFecha(s.fecha_solicitud) },
  { titulo: 'Desde', anchoExcel: 14, anchoPdf: 52, valor: (s) => formatearFecha(s.fecha_inicio) },
  { titulo: 'Hasta', anchoExcel: 14, anchoPdf: 52, valor: (s) => formatearFecha(s.fecha_fin) },
  {
    titulo: 'Horas',
    anchoExcel: 10,
    anchoPdf: 34,
    valor: (s) => (s.detalle_permiso?.horas_permiso != null ? String(s.detalle_permiso.horas_permiso) : ''),
  },
  {
    titulo: 'Días',
    anchoExcel: 10,
    anchoPdf: 34,
    valor: (s) =>
      s.detalle_vacaciones?.dias_a_disfrutar != null
        ? String(s.detalle_vacaciones.dias_a_disfrutar)
        : s.detalle_permiso?.dias_permiso != null
          ? String(s.detalle_permiso.dias_permiso)
          : '',
  },
  {
    titulo: 'Remunerado',
    anchoExcel: 13,
    anchoPdf: 46,
    valor: (s) => (s.detalle_permiso ? (s.detalle_permiso.remunerado ? 'Sí' : 'No') : ''),
  },
  { titulo: 'Estado', anchoExcel: 24, valor: (s) => ETIQUETA_ESTADO[s.estado] ?? s.estado },
  { titulo: 'Extemporánea', anchoExcel: 14, anchoPdf: 50, valor: (s) => (s.extemporanea ? 'Sí' : 'No') },
  { titulo: 'Causa del rechazo', anchoExcel: 34, valor: (s) => s.motivo_rechazo ?? '' },
]

/** Columnas que caben cómodamente en un PDF apaisado. */
const CLAVES_PDF = new Set([
  'Consecutivo',
  'Trámite',
  'Solicitante',
  'Área o servicio',
  'Motivo',
  'Desde',
  'Hasta',
  'Días',
  'Estado',
])

function nombreArchivo(base: string): string {
  return `${base}_${new Date().toISOString().slice(0, 10)}`
}

export async function exportarSolicitudesExcel(
  solicitudes: SolicitudLista[],
  filtros: string[] = [],
  titulo = 'Reporte de permisos y vacaciones'
): Promise<void> {
  await exportarExcel({
    nombreArchivo: nombreArchivo('permisos_tthh'),
    titulo,
    filtrosAplicados: filtros,
    nombreHoja: 'Solicitudes',
    columnas: CAMPOS.map((c) => ({ titulo: c.titulo, ancho: c.anchoExcel, valor: c.valor })),
    filas: solicitudes,
  })
}

export async function exportarSolicitudesPdf(
  solicitudes: SolicitudLista[],
  filtros: string[] = [],
  titulo = 'Reporte de permisos y vacaciones'
): Promise<void> {
  await exportarPdf({
    nombreArchivo: nombreArchivo('permisos_tthh'),
    titulo,
    filtrosAplicados: filtros,
    columnas: CAMPOS.filter((c) => CLAVES_PDF.has(c.titulo)).map((c) => ({
      titulo: c.titulo,
      ancho: c.anchoPdf ?? '*',
      valor: c.valor,
    })),
    filas: solicitudes,
  })
}
