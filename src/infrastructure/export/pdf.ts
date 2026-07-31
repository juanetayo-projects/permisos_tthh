import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { logoInstitucional } from './logo'

const AZUL = '#0D2D6B'
const AZUL_CLARO = '#E8EEF8'
const GRIS = '#64748B'

export interface ColumnaPdf<T> {
  titulo: string
  ancho?: string | number
  valor: (fila: T) => string
}

export interface OpcionesPdf<T> {
  nombreArchivo: string
  titulo: string
  subtitulo?: string
  filtrosAplicados?: string[]
  columnas: ColumnaPdf<T>[]
  filas: T[]
  orientacion?: 'portrait' | 'landscape'
}

/**
 * Exporta un listado a PDF con el encabezado institucional.
 *
 * pdfmake se importa de forma diferida por el mismo motivo que ExcelJS: pesa
 * y solo hace falta al exportar. La fuente se carga desde el CDN de vfs_fonts
 * empaquetado con la librería, sin pedir nada a la red.
 */
export async function exportarPdf<T>(opciones: OpcionesPdf<T>): Promise<void> {
  const pdfMake = await cargarPdfMake()

  let logo: string | null = null
  try {
    logo = await logoInstitucional()
  } catch {
    // Sin logo el reporte sigue siendo válido.
  }

  const anchos = opciones.columnas.map((c) => c.ancho ?? '*')

  const cuerpo = [
    opciones.columnas.map((c) => ({
      text: c.titulo,
      style: 'th',
    })),
    ...opciones.filas.map((fila, indice) =>
      opciones.columnas.map((c) => ({
        text: c.valor(fila),
        style: 'td',
        fillColor: indice % 2 === 1 ? '#F6F8FC' : undefined,
      }))
    ),
  ]

  const definicion: TDocumentDefinitions = {
    pageOrientation: opciones.orientacion ?? 'landscape',
    pageSize: 'LETTER',
    pageMargins: [28, 96, 28, 44],
    info: {
      title: opciones.titulo,
      author: 'Clínica de Alta Complejidad Santa Bárbara',
      subject: 'Gestión de permisos y vacaciones',
    },

    header: () => ({
      margin: [28, 20, 28, 0],
      columns: [
        // `fit` en vez de `width`: con `width` la altura crece según la
        // proporción del PNG, el bloque de cabecera se pasa del margen
        // superior y el contenido acaba pisándolo. Con `fit` la imagen se
        // acota por los dos lados y la cabecera nunca crece más de lo previsto.
        logo
          ? { image: logo, fit: [120, 44] as [number, number], width: 132, margin: [0, 2, 12, 0] }
          : { text: '', width: 0 },
        {
          stack: [
            { text: 'Clínica de Alta Complejidad Santa Bárbara', style: 'marca' },
            { text: opciones.titulo, style: 'titulo' },
            {
              text: opciones.subtitulo ?? 'Gestión de permisos y vacaciones · Talento Humano',
              style: 'subtitulo',
            },
          ],
        },
      ],
    }),

    footer: (pagina, total) => ({
      margin: [28, 8, 28, 0],
      columns: [
        {
          text: `Generado el ${new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}`,
          style: 'pie',
        },
        { text: `Página ${pagina} de ${total}`, style: 'pie', alignment: 'right' },
      ],
    }),

    content: [
      ...(opciones.filtrosAplicados?.length
        ? [
            {
              text: `Filtros aplicados: ${opciones.filtrosAplicados.join(' · ')}`,
              style: 'filtros',
              margin: [0, 0, 0, 8] as [number, number, number, number],
            },
          ]
        : []),
      {
        table: { headerRows: 1, widths: anchos, body: cuerpo },
        layout: {
          hLineWidth: (i: number) => (i <= 1 ? 1 : 0.5),
          hLineColor: (i: number) => (i <= 1 ? AZUL : '#E2E8F0'),
          vLineWidth: () => 0,
          paddingTop: () => 5,
          paddingBottom: () => 5,
          paddingLeft: () => 6,
          paddingRight: () => 6,
        },
      },
      {
        text: `Total de registros: ${opciones.filas.length}`,
        style: 'total',
        margin: [0, 10, 0, 0] as [number, number, number, number],
      },
    ],

    styles: {
      marca: { fontSize: 12, bold: true, color: AZUL },
      titulo: { fontSize: 11, bold: true, margin: [0, 2, 0, 0] },
      subtitulo: { fontSize: 8, color: GRIS },
      filtros: { fontSize: 8, italics: true, color: GRIS },
      th: { fontSize: 8, bold: true, color: 'white', fillColor: AZUL, alignment: 'center' },
      td: { fontSize: 8 },
      total: { fontSize: 9, bold: true, color: AZUL, fillColor: AZUL_CLARO },
      pie: { fontSize: 7, color: GRIS },
    },

    defaultStyle: { font: 'Roboto' },
  }

  pdfMake.createPdf(definicion).download(`${opciones.nombreArchivo}.pdf`)
}

/**
 * pdfmake reparte su fuente por defecto en un módulo aparte y hay que
 * ensamblarlos a mano, porque el paquete no lo hace solo en ESM.
 *
 * El formato del módulo de fuentes ha cambiado entre versiones, así que se
 * prueban las tres formas conocidas. Si ninguna aparece se lanza un error:
 * sin `vfs`, pdfmake no encuentra la tipografía y **falla en silencio**, sin
 * generar el archivo ni avisar de nada.
 */
async function cargarPdfMake() {
  const [modulo, fuentes] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])

  const pdfMake = (modulo as { default?: unknown }).default ?? modulo
  const f = fuentes as unknown as {
    pdfMake?: { vfs?: Record<string, string> }
    default?: { vfs?: Record<string, string> } | Record<string, string>
    vfs?: Record<string, string>
  }

  const vfs =
    f.pdfMake?.vfs ??
    (f.default as { vfs?: Record<string, string> } | undefined)?.vfs ??
    f.vfs ??
    // Algunas versiones exportan el diccionario de fuentes directamente.
    (esDiccionarioDeFuentes(f.default) ? (f.default as Record<string, string>) : undefined)

  if (!vfs) {
    throw new Error(
      'No se pudo cargar la tipografía de pdfmake (vfs_fonts). El PDF no se puede generar.'
    )
  }

  const instancia = pdfMake as { vfs?: Record<string, string>; createPdf: typeof import('pdfmake/build/pdfmake').createPdf }
  instancia.vfs = vfs
  return instancia
}

function esDiccionarioDeFuentes(valor: unknown): boolean {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    Object.keys(valor).some((k) => k.toLowerCase().includes('roboto'))
  )
}
