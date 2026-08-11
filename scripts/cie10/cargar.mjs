// Carga el catálogo CIE10 oficial (Ministerio de Salud) en la tabla
// `public.cie10` de este proyecto de Supabase.
//
// Uso (PowerShell) — datos sueltos, sin armar ninguna URL a mano:
//   $env:PGHOST     = "db.hvbatymkcpsxhuzkagoi.supabase.co"
//   $env:PGPORT     = "5432"
//   $env:PGDATABASE = "postgres"
//   $env:PGUSER     = "postgres"
//   $env:PGPASSWORD = "TU_CLAVE"
//   npm install pg --no-save   # una sola vez, si no está instalado
//   node scripts/cie10/cargar.mjs
//
// Esos cinco valores salen de Supabase → proyecto permisos_tthh →
// Settings → Database, sección "Connection parameters" (o el botón verde
// "Connect" arriba de la página): Host, Port, Database name, User, y la
// contraseña aparte (con opción de restablecerla si no la recuerdas).
//
// `pg` los toma solo de leer esas variables de entorno estándar: no hace
// falta construir ninguna cadena de conexión ni escapar caracteres
// especiales de la contraseña.
//
// No requiere tocar el proyecto ni sus migraciones: `cie10_seed.sql` ya
// trae `insert ... on conflict (codigo) do update`, así que se puede
// correr más de una vez sin duplicar filas.
import { readFileSync } from 'node:fs'
import pg from 'pg'

if (!process.env.PGHOST || !process.env.PGPASSWORD) {
  console.error('Faltan PGHOST y/o PGPASSWORD. Ver el comentario al inicio de este archivo.')
  process.exit(1)
}

const RUTA = new URL('./cie10_seed.sql', import.meta.url)
const sql = readFileSync(RUTA, 'utf8')

// Cada `insert ... values (...) on conflict ...;` es un bloque independiente:
// se ejecutan uno a uno para poder mostrar avance y para que un bloque que
// falle no tumbe los 12.000 códigos que ya entraron.
const bloques = sql
  .split(/(?=insert into public\.cie10)/g)
  .map((b) => b.trim())
  .filter((b) => b.startsWith('insert into'))

console.log(`${bloques.length} lotes por aplicar…`)

// Sin `connectionString`: pg arma la conexión solo de PGHOST/PGPORT/PGUSER/
// PGPASSWORD/PGDATABASE, que ya están en el entorno.
const client = new pg.Client({ ssl: { rejectUnauthorized: false } })
await client.connect()

let aplicados = 0
try {
  for (const [i, bloque] of bloques.entries()) {
    await client.query(bloque)
    aplicados++
    console.log(`Lote ${i + 1}/${bloques.length} aplicado.`)
  }
  const { rows } = await client.query('select count(*)::int as total from public.cie10')
  console.log(`Listo. La tabla cie10 tiene ahora ${rows[0].total} códigos.`)
} catch (e) {
  console.error(`Falló en el lote ${aplicados + 1}/${bloques.length}:`, e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
