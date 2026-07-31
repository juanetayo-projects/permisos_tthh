import type { Workbook, Worksheet } from 'exceljs'
import { logoInstitucional, soloBase64 } from './logo'

const AZUL = 'FF0D2D6B'
const AZUL_CLARO = 'FFE8EEF8'
const GRIS_FILA = 'FFF6F8FC'

export interface ColumnaExcel<T> {
  titulo: string
  ancho?: number
  valor: (fila: T) => string | number | null
}

export interface OpcionesExcel<T> {
  nombreArchivo: string
  titulo: string
  subtitulo?: string
  filtrosAplicados?: string[]
  columnas: ColumnaExcel<T>[]
  filas: T[]
  nombreHoja?: string
}

/**
 * Exporta a Excel con el encabezado institucional.
 *
 * ExcelJS se importa de forma diferida: pesa bastante y solo hace falta cuando
 * el usuario pulsa exportar, no en la carga inicial de la aplicación.
 */
export async function exportarExcel<T>(opciones: OpcionesExcel<T>): Promise<void> {
  const ExcelJS = await import('exceljs')
  const libro: Workbook = new ExcelJS.Workbook()

  libro.creator = 'Clínica de Alta Complejidad Santa Bárbara'
  libro.created = new Date()

  const hoja = libro.addWorksheet(opciones.nombreHoja ?? 'Reporte', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const totalColumnas = Math.max(opciones.columnas.length, 4)
  await encabezado(libro, hoja, opciones, totalColumnas)

  // ------------------------------------------------------------- Encabezados
  const filaTitulos = hoja.getRow(6)
  opciones.columnas.forEach((c, i) => {
    const celda = filaTitulos.getCell(i + 1)
    celda.value = c.titulo
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    celda.border = { bottom: { style: 'thin', color: { argb: AZUL } } }
  })
  filaTitulos.height = 24

  hoja.columns = opciones.columnas.map((c) => ({ width: c.ancho ?? 18 }))

  // ------------------------------------------------------------------ Datos
  opciones.filas.forEach((fila, indice) => {
    const f = hoja.getRow(7 + indice)
    opciones.columnas.forEach((c, i) => {
      const celda = f.getCell(i + 1)
      celda.value = c.valor(fila)
      celda.alignment = { vertical: 'middle', wrapText: true }
      celda.font = { size: 10 }
      // Filas pares e impares diferenciadas, igual que en las tablas de la app.
      if (indice % 2 === 1) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_FILA } }
      }
    })
  })

  hoja.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6 + opciones.filas.length, column: opciones.columnas.length },
  }

  const total = hoja.getRow(7 + opciones.filas.length + 1)
  total.getCell(1).value = `Total de registros: ${opciones.filas.length}`
  total.getCell(1).font = { bold: true, size: 10 }

  await descargar(libro, opciones.nombreArchivo)
}

async function encabezado<T>(
  libro: Workbook,
  hoja: Worksheet,
  opciones: OpcionesExcel<T>,
  totalColumnas: number
): Promise<void> {
  try {
    const dataUrl = await logoInstitucional()
    const id = libro.addImage({ base64: soloBase64(dataUrl), extension: 'png' })
    // Confinado al rango A1:A3 en vez de dimensionado en píxeles: con `ext`
    // medía 150 px fijos, se salía de la columna A —que es tan ancha como pida
    // el consecutivo— y se montaba encima del título.
    hoja.addImage(id, 'A1:A3')
  } catch {
    // Sin logo el reporte sigue siendo válido: no se aborta la exportación.
  }

  hoja.mergeCells(1, 2, 1, totalColumnas)
  const titulo = hoja.getCell(1, 2)
  titulo.value = 'Clínica de Alta Complejidad Santa Bárbara'
  titulo.font = { bold: true, size: 14, color: { argb: AZUL } }
  titulo.alignment = { vertical: 'middle' }

  hoja.mergeCells(2, 2, 2, totalColumnas)
  const sub = hoja.getCell(2, 2)
  sub.value = opciones.titulo
  sub.font = { bold: true, size: 12 }

  hoja.mergeCells(3, 2, 3, totalColumnas)
  const detalle = hoja.getCell(3, 2)
  detalle.value = opciones.subtitulo ?? 'Gestión de permisos y vacaciones · Talento Humano'
  detalle.font = { size: 10, color: { argb: 'FF64748B' } }

  hoja.mergeCells(4, 1, 4, totalColumnas)
  const meta = hoja.getCell(4, 1)
  const filtros = opciones.filtrosAplicados?.length
    ? ` · Filtros: ${opciones.filtrosAplicados.join(' · ')}`
    : ''
  meta.value = `Generado el ${new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}${filtros}`
  meta.font = { size: 9, italic: true, color: { argb: 'FF64748B' } }
  meta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }

  // Las tres primeras filas alojan el logo, así que necesitan alto suficiente
  // para que no quede aplastado.
  hoja.getRow(1).height = 22
  hoja.getRow(2).height = 20
  hoja.getRow(3).height = 16
  hoja.getRow(5).height = 6
}

async function descargar(libro: Workbook, nombreArchivo: string): Promise<void> {
  const buffer = await libro.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${nombreArchivo}.xlsx`
  enlace.click()
  URL.revokeObjectURL(url)
}
