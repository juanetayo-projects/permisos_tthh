import ExcelJS from 'exceljs'
import { writeFileSync } from 'node:fs'

const RUTA_ORIGEN =
  'C:/Users/Juan Carlos Etayo/AppData/Local/Temp/claude/C--Users-Juan-Carlos-Etayo/136219da-821b-4317-aae2-43f1731b4aa2/scratchpad/cie10/Tabla-CIE-10-2018_08022021 sin restricciones.xlsx'

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(RUTA_ORIGEN)
const hoja = wb.getWorksheet('Final')

/** [null, capituloNum, nombreCapitulo, codigo3, nombre3, codigo4, nombre4] */
const vistos = new Map()
let filasLeidas = 0
let filasOmitidas = 0

hoja.eachRow((row, n) => {
  const v = row.values
  const capituloNum = v[1]
  const nombreCapitulo = v[2]
  const codigo4 = v[5]
  const nombre4 = v[6]

  if (typeof capituloNum !== 'number' || !codigo4 || !nombre4) {
    filasOmitidas++
    return
  }
  filasLeidas++

  const codigo = String(codigo4).trim().toUpperCase()
  const nombre = String(nombre4).trim().replace(/\s+/g, ' ')
  const capitulo = `${capituloNum} - ${String(nombreCapitulo).trim()}`

  if (!vistos.has(codigo)) {
    vistos.set(codigo, { codigo, nombre, capitulo })
  }
})

console.log(`Filas leídas: ${filasLeidas}, omitidas: ${filasOmitidas}, códigos únicos: ${vistos.size}`)

const filas = [...vistos.values()]

function sqlLiteral(texto) {
  return `'${texto.replace(/'/g, "''")}'`
}

const LOTE = 1000
let sql = `-- =============================================================================
-- PERMISOS TTHH — Carga del catálogo CIE10 oficial (Ministerio de Salud)
-- =============================================================================
-- Fuente: "Catálogo de patologías - Tabla de CIE-10. Instrumentos RIPS",
-- Ministerio de Salud y Protección Social, actualizada a Excel del
-- 08/02/2021 (tabla-cie-10.zip, hoja "Final").
-- ${filas.length} códigos de cuatro caracteres, uno por diagnóstico.
-- -----------------------------------------------------------------------------

`

for (let i = 0; i < filas.length; i += LOTE) {
  const lote = filas.slice(i, i + LOTE)
  const valores = lote
    .map((f) => `  (${sqlLiteral(f.codigo)}, ${sqlLiteral(f.nombre)}, ${sqlLiteral(f.capitulo)})`)
    .join(',\n')
  sql += `insert into public.cie10 (codigo, nombre, capitulo) values\n${valores}\non conflict (codigo) do update set nombre = excluded.nombre, capitulo = excluded.capitulo;\n\n`
}

writeFileSync('scripts/cie10/cie10_seed.sql', sql, 'utf8')
console.log(`Escrito scripts/cie10/cie10_seed.sql (${(sql.length / 1024 / 1024).toFixed(2)} MB)`)
