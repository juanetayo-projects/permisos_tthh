import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Download, Upload, XCircle } from 'lucide-react'
import { supabase } from '@/infrastructure/supabase/client'
import { Button } from '@/presentation/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'

export interface CampoImportacion {
  clave: string
  etiqueta: string
  requerido?: boolean
  /** Si trae opciones, el valor de la celda debe calzar con uno de los `valor`. */
  opciones?: { valor: string; etiqueta: string }[]
}

/** Quita acentos y mayúsculas para que el encabezado del Excel no tenga que ser exacto. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

interface FilaImportacion {
  fila: number
  valores: Record<string, string>
  errores: string[]
  ok?: boolean
  error?: string
}

/**
 * Carga masiva por Excel para catálogos simples (una tabla, columnas planas,
 * sin cuentas de usuario de por medio). A diferencia de la importación de
 * usuarios, el insert va directo desde el cliente: la policy de escritura
 * del catálogo (`permisos_gestiona_catalogos()`) ya protege quién puede
 * hacerlo, y no hay nada que solo pueda hacer una Edge Function con
 * service role.
 */
export function DialogoImportarCatalogo({
  abierto,
  onCerrar,
  titulo,
  tabla,
  campos,
  conflictoEn,
  nombreArchivo,
  filaEjemplo,
  queryKey,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  tabla: string
  campos: CampoImportacion[]
  /** Columna con restricción `unique` de la tabla, para actualizar en vez de duplicar. */
  conflictoEn: string
  nombreArchivo: string
  filaEjemplo: string[]
  queryKey: string
}) {
  const qc = useQueryClient()
  const [filas, setFilas] = useState<FilaImportacion[]>([])
  const [nombreLeido, setNombreLeido] = useState('')
  const [cargandoArchivo, setCargandoArchivo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  function cerrar() {
    setFilas([])
    setNombreLeido('')
    setError(null)
    setEnviado(false)
    onCerrar()
  }

  async function descargarPlantilla() {
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    const hoja = wb.addWorksheet('Datos')
    hoja.addRow(campos.map((c) => c.clave))
    hoja.addRow(filaEjemplo)
    hoja.columns.forEach((c) => (c.width = 24))
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(blob)
    enlace.download = nombreArchivo
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  async function leerArchivo(archivo: File) {
    setError(null)
    setEnviado(false)
    setCargandoArchivo(true)
    setNombreLeido(archivo.name)

    try {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await archivo.arrayBuffer())
      const hoja = wb.worksheets[0]
      if (!hoja) {
        setError('El archivo no tiene ninguna hoja.')
        return
      }

      const encabezado = (hoja.getRow(1).values as unknown[]).map((v) =>
        v == null ? '' : normalizar(String(v))
      )
      const indices = Object.fromEntries(campos.map((c) => [c.clave, encabezado.indexOf(normalizar(c.clave))]))

      const faltantes = campos.filter((c) => c.requerido && indices[c.clave] < 0)
      if (faltantes.length > 0) {
        setError(`Faltan columnas obligatorias: ${faltantes.map((c) => c.clave).join(', ')}.`)
        return
      }

      const leida: FilaImportacion[] = []
      const celda = (fila: import('exceljs').Row, i: number) =>
        i < 0 ? '' : String((fila.values as unknown[])?.[i] ?? '').trim()

      hoja.eachRow((fila, n) => {
        if (n === 1) return
        const valores: Record<string, string> = {}
        for (const c of campos) valores[c.clave] = celda(fila, indices[c.clave])
        if (Object.values(valores).every((v) => !v)) return // fila en blanco

        const errores: string[] = []
        for (const c of campos) {
          if (c.requerido && !valores[c.clave]) errores.push(`Falta "${c.etiqueta}".`)
          if (c.opciones && valores[c.clave]) {
            const valido = c.opciones.some((o) => o.valor === valores[c.clave])
            if (!valido) {
              errores.push(
                `"${c.etiqueta}" debe ser una de: ${c.opciones.map((o) => o.valor).join(', ')} (llegó "${valores[c.clave]}").`
              )
            }
          }
        }

        leida.push({ fila: n, valores, errores })
      })

      if (leida.length === 0) setError('No encontré filas con datos debajo del encabezado.')
      setFilas(leida)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible leer el archivo.')
    } finally {
      setCargandoArchivo(false)
    }
  }

  const filasValidas = useMemo(() => filas.filter((f) => f.errores.length === 0), [filas])

  async function enviar() {
    setError(null)
    setEnviando(true)
    try {
      const { error: errorInsert } = await supabase
        .from(tabla)
        .upsert(
          filasValidas.map((f) => f.valores),
          { onConflict: conflictoEn }
        )

      if (errorInsert) throw errorInsert

      setFilas((actual) =>
        actual.map((f) => (f.errores.length === 0 ? { ...f, ok: true } : f))
      )
      setEnviado(true)
      void qc.invalidateQueries({ queryKey: [queryKey] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible importar el archivo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && !enviando && cerrar()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 [&>button]:text-white/80 [&>button]:hover:bg-white/20 [&>button]:hover:text-white">
        <DialogHeader className="franja-institucional gap-1 p-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Upload className="size-5" /> {titulo}
          </DialogTitle>
          <DialogDescription className="text-white/80">
            Columnas: {campos.map((c) => c.clave).join(', ')}. Las filas repetidas actualizan la fila
            existente en vez de duplicarla.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void descargarPlantilla()}>
              <Download /> Descargar plantilla
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Upload className="size-4" />
              {nombreLeido || 'Elegir archivo .xlsx'}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (archivo) void leerArchivo(archivo)
                }}
              />
            </label>
            {cargandoArchivo && <span className="text-xs text-muted-foreground">Leyendo…</span>}
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          {filas.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {filasValidas.length} de {filas.length} fila{filas.length === 1 ? '' : 's'} lista
                {filasValidas.length === 1 ? '' : 's'} para importar.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Fila</th>
                      {campos.map((c) => (
                        <th key={c.clave} className="px-2 py-1.5 text-left font-semibold text-muted-foreground">
                          {c.etiqueta}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.fila} className="border-t border-border">
                        <td className="px-2 py-1.5 text-muted-foreground">{f.fila}</td>
                        {campos.map((c) => (
                          <td key={c.clave} className="px-2 py-1.5">{f.valores[c.clave] || '—'}</td>
                        ))}
                        <td className="px-2 py-1.5">
                          {f.ok ? (
                            <span className="flex items-center gap-1 text-xs text-[var(--exito)]">
                              <CheckCircle2 className="size-3.5 shrink-0" /> Importada
                            </span>
                          ) : f.errores.length > 0 ? (
                            <span
                              className="flex items-center gap-1 text-xs text-[var(--error)]"
                              title={f.errores.join(' ')}
                            >
                              <XCircle className="size-3.5 shrink-0" /> {f.errores[0]}
                              {f.errores.length > 1 && ` (+${f.errores.length - 1})`}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Lista</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-muted/40 p-4">
          <Button variant="ghost" onClick={cerrar} disabled={enviando}>
            {enviado ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!enviado && (
            <Button cargando={enviando} disabled={filasValidas.length === 0} onClick={() => void enviar()}>
              {!enviando && <Upload />} Importar {filasValidas.length || ''} fila
              {filasValidas.length === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
