/**
 * Carga el logo institucional como data URL.
 *
 * Tanto ExcelJS como pdfmake necesitan la imagen embebida en base64: no
 * aceptan una ruta. Se cachea la promesa para no releer el archivo en cada
 * exportación.
 */
let cache: Promise<string> | null = null

export function logoInstitucional(): Promise<string> {
  cache ??= cargar()
  return cache
}

async function cargar(): Promise<string> {
  const respuesta = await fetch(`${import.meta.env.BASE_URL}images/logo_cacsb2.png`)
  if (!respuesta.ok) throw new Error('No se pudo cargar el logo institucional.')

  const blob = await respuesta.blob()

  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result as string)
    lector.onerror = () => reject(new Error('No se pudo leer el logo institucional.'))
    lector.readAsDataURL(blob)
  })
}

/** Solo la parte base64, sin el prefijo `data:image/png;base64,` (lo exige ExcelJS). */
export function soloBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/\w+;base64,/, '')
}
