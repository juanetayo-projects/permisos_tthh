# Carga del catálogo CIE10

`cie10_seed.sql` trae los 12.568 códigos de cuatro caracteres del **Catálogo
de patologías - Tabla de CIE-10. Instrumentos RIPS** (Ministerio de Salud y
Protección Social, Excel actualizado al 08/02/2021, descargado de
`minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/OT/tabla-cie-10.zip`).
Se generó con `generar.mjs` a partir de la hoja "Final" de ese Excel.

## Cómo cargarlo

1. En Supabase → proyecto **permisos_tthh** (`hvbatymkcpsxhuzkagoi`) →
   **Settings → Database**, busca la sección **"Connection parameters"** (o
   el botón verde **"Connect"** arriba de la página). Ahí están el Host, el
   Port, el Database name y el User sueltos, y la contraseña aparte (con
   opción de restablecerla si no la recuerdas).
2. En PowerShell, dentro de `C:\www\permisos_tthh`:

   ```powershell
   $env:PGHOST     = "db.hvbatymkcpsxhuzkagoi.supabase.co"
   $env:PGPORT     = "5432"
   $env:PGDATABASE = "postgres"
   $env:PGUSER     = "postgres"
   $env:PGPASSWORD = "TU_CLAVE"
   npm install pg --no-save   # solo la primera vez
   node scripts/cie10/cargar.mjs
   ```

   No hace falta armar ninguna URL a mano: `pg` lee esas cinco variables
   directamente, así que una contraseña con `@`, `#` u otros caracteres
   especiales no da problema.
3. El script aplica los ~13 lotes uno a uno, mostrando el avance, y al final
   confirma cuántos códigos quedaron en la tabla. Es seguro volver a
   correrlo: usa `on conflict (codigo) do update`, no duplica filas.

`pg` se instala con `--no-save` a propósito: es una dependencia solo para
este script puntual, no del proyecto.
