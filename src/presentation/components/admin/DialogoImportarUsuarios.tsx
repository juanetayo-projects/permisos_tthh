import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Upload, XCircle } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  useImportarUsuariosMasivo,
  type DatosNuevoUsuario,
  type ResultadoFilaImportacion,
} from '@/application/admin/usePerfiles'
import { useAreas, useCargos, useCoordinadores, useEmpresas } from '@/application/catalogos/useCatalogos'
import { ROLES, type Rol } from '@/domain/estados'
import { Button } from '@/presentation/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'

const COLUMNAS_PLANTILLA = [
  'nombre',
  'correo',
  'tipo_documento',
  'documento',
  'telefono',
  'empresa',
  'servicio',
  'cargo',
  'jefe_directo',
  'rol',
]

const MARCAS_DIACRITICAS = /[̀-ͯ]/g

/** Quita acentos y mayúsculas: así "N.° Documento" calza con "documento". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(MARCAS_DIACRITICAS, '').trim().toLowerCase()
}

interface FilaImportacion {
  fila: number
  nombre: string
  correo: string
  tipoDocumento: string
  documento: string
  telefono: string
  empresaNombre: string
  servicioNombre: string
  cargoNombre: string
  jefeDirectoTexto: string
  rolTexto: string
  // Resuelto contra los catálogos.
  empresaId: number | null
  areaId: number | null
  cargoId: number | null
  coordinadorId: number | null
  rol: Rol
  errores: string[]
  resultado?: ResultadoFilaImportacion
}

/**
 * Carga masiva de usuarios desde un Excel.
 *
 * Es lo que puebla por primera vez empresa/servicio/cargo/jefe directo del
 * perfil de cada colaborador -esos campos dejaron de editarse en las
 * solicitudes precisamente porque nacen de aquí-. Cada fila se valida y se
 * resuelve contra los catálogos ya cargados antes de permitir el envío, y el
 * resultado se muestra fila por fila: un correo repetido no debe tumbar el
 * resto del archivo.
 */
export function DialogoImportarUsuarios({
  abierto,
  onCerrar,
}: {
  abierto: boolean
  onCerrar: () => void
}) {
  const { perfil: yo } = useAuth()
  const importar = useImportarUsuariosMasivo()

  const { data: empresas } = useEmpresas()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: coordinadores } = useCoordinadores()

  const [filas, setFilas] = useState<FilaImportacion[]>([])
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [cargandoArchivo, setCargandoArchivo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  const puedeElegirRol = yo?.rol === 'administrador'

  function cerrar() {
    setFilas([])
    setNombreArchivo('')
    setError(null)
    setEnviado(false)
    onCerrar()
  }

  function buscarPorNombre<T extends { nombre: string; id: number }>(
    lista: T[] | undefined,
    nombre: string
  ): T | undefined {
    if (!nombre.trim()) return undefined
    const n = normalizar(nombre)
    return lista?.find((x) => normalizar(x.nombre) === n)
  }

  function resolverJefe(texto: string) {
    if (!texto.trim()) return undefined
    const t = normalizar(texto)
    return coordinadores?.find(
      (c) => c.correo?.toLowerCase() === texto.trim().toLowerCase() || normalizar(c.nombre ?? '') === t
    )
  }

  async function descargarPlantilla() {
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    const hoja = wb.addWorksheet('Usuarios')
    hoja.addRow(COLUMNAS_PLANTILLA)
    hoja.addRow([
      'Ana Pérez',
      'ana.perez@cacsantabarbara.co',
      'CC',
      '1020304050',
      '3001234567',
      'Clínica CAC Santa Bárbara',
      'Hospitalización',
      'Auxiliar de enfermería',
      'jefe.hospitalizacion@cacsantabarbara.co',
      'colaborador',
    ])
    hoja.columns.forEach((c) => (c.width = 24))
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(blob)
    enlace.download = 'plantilla_usuarios.xlsx'
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  async function leerArchivo(archivo: File) {
    setError(null)
    setEnviado(false)
    setCargandoArchivo(true)
    setNombreArchivo(archivo.name)

    try {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await archivo.arrayBuffer())
      const hoja = wb.worksheets[0]
      if (!hoja) {
        setError('El archivo no tiene ninguna hoja.')
        return
      }

      const encabezado = (hoja.getRow(1).values as unknown[])
        .map((v) => (v == null ? '' : normalizar(String(v))))

      const columna = (nombre: string) => encabezado.indexOf(normalizar(nombre))
      const idx = {
        nombre: columna('nombre'),
        correo: columna('correo'),
        tipoDocumento: columna('tipo_documento'),
        documento: columna('documento'),
        telefono: columna('telefono'),
        empresa: columna('empresa'),
        servicio: columna('servicio'),
        cargo: columna('cargo'),
        jefe: columna('jefe_directo'),
        rol: columna('rol'),
      }

      if (idx.nombre < 0 || idx.correo < 0) {
        setError('El archivo debe tener al menos las columnas "nombre" y "correo".')
        return
      }

      const leida: FilaImportacion[] = []
      const celda = (fila: import('exceljs').Row, i: number) =>
        i < 0 ? '' : String((fila.values as unknown[])?.[i] ?? '').trim()

      hoja.eachRow((fila, n) => {
        if (n === 1) return // encabezado
        const nombre = celda(fila, idx.nombre)
        const correo = celda(fila, idx.correo)
        if (!nombre && !correo) return // fila en blanco

        const empresaNombre = celda(fila, idx.empresa)
        const servicioNombre = celda(fila, idx.servicio)
        const cargoNombre = celda(fila, idx.cargo)
        const jefeDirectoTexto = celda(fila, idx.jefe)
        const rolTexto = celda(fila, idx.rol).toLowerCase() || 'colaborador'

        const empresa = buscarPorNombre(empresas, empresaNombre)
        const area = buscarPorNombre(areas, servicioNombre)
        const cargo = buscarPorNombre(cargos, cargoNombre)
        const jefe = resolverJefe(jefeDirectoTexto)
        const rolValido = ROLES.includes(rolTexto as Rol) ? (rolTexto as Rol) : null

        const errores: string[] = []
        if (!nombre) errores.push('Falta el nombre.')
        if (!correo.includes('@')) errores.push('Correo inválido.')
        if (empresaNombre && !empresa) errores.push(`Empresa "${empresaNombre}" no existe en el catálogo.`)
        if (servicioNombre && !area) errores.push(`Servicio "${servicioNombre}" no existe en el catálogo.`)
        if (cargoNombre && !cargo) errores.push(`Cargo "${cargoNombre}" no existe en el catálogo.`)
        if (jefeDirectoTexto && !jefe) errores.push(`Jefe directo "${jefeDirectoTexto}" no se encontró.`)
        if (!rolValido) errores.push(`Rol "${rolTexto}" no es válido.`)
        if (rolValido && rolValido !== 'colaborador' && !puedeElegirRol) {
          errores.push('Solo un administrador puede importar roles distintos de colaborador.')
        }

        leida.push({
          fila: n,
          nombre,
          correo: correo.toLowerCase(),
          tipoDocumento: celda(fila, idx.tipoDocumento) || 'CC',
          documento: celda(fila, idx.documento),
          telefono: celda(fila, idx.telefono),
          empresaNombre,
          servicioNombre,
          cargoNombre,
          jefeDirectoTexto,
          rolTexto,
          empresaId: empresa?.id ?? null,
          areaId: area?.id ?? null,
          cargoId: cargo?.id ?? null,
          coordinadorId: jefe?.id ?? null,
          rol: rolValido ?? 'colaborador',
          errores,
        })
      })

      if (leida.length === 0) {
        setError('No encontré filas con datos debajo del encabezado.')
      }
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
    const datos: DatosNuevoUsuario[] = filasValidas.map((f) => ({
      nombre: f.nombre,
      correo: f.correo,
      tipo_documento: f.tipoDocumento,
      documento: f.documento || null,
      telefono: f.telefono || null,
      empresa_id: f.empresaId,
      area_id: f.areaId,
      cargo_id: f.cargoId,
      coordinador_id: f.coordinadorId,
      rol: f.rol,
    }))

    try {
      const resultados = await importar.mutateAsync(datos)
      let i = 0
      setFilas((actual) =>
        actual.map((f) => (f.errores.length === 0 ? { ...f, resultado: resultados[i++] } : f))
      )
      setEnviado(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible importar el archivo.')
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && !importar.isPending && cerrar()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 [&>button]:text-white/80 [&>button]:hover:bg-white/20 [&>button]:hover:text-white">
        <DialogHeader className="franja-institucional gap-1 p-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Upload className="size-5" /> Importar usuarios desde Excel
          </DialogTitle>
          <DialogDescription className="text-white/80">
            Empresa, servicio, cargo y jefe directo se buscan por nombre contra los catálogos ya
            cargados. Las filas con algo sin resolver se marcan y no se envían.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void descargarPlantilla()}>
              <Download /> Descargar plantilla
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Upload className="size-4" />
              {nombreArchivo || 'Elegir archivo .xlsx'}
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
                <table className="w-full min-w-[50rem] text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Fila</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Nombre</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Correo</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Empresa / servicio / cargo</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Jefe directo</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.fila} className="border-t border-border">
                        <td className="px-2 py-1.5 text-muted-foreground">{f.fila}</td>
                        <td className="px-2 py-1.5">{f.nombre || '—'}</td>
                        <td className="px-2 py-1.5">{f.correo || '—'}</td>
                        <td className="px-2 py-1.5 text-xs">
                          {[f.empresaNombre, f.servicioNombre, f.cargoNombre].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-2 py-1.5 text-xs">{f.jefeDirectoTexto || '—'}</td>
                        <td className="px-2 py-1.5">
                          {f.resultado ? (
                            f.resultado.ok ? (
                              <span className="flex items-center gap-1 text-xs text-[var(--exito)]">
                                <CheckCircle2 className="size-3.5 shrink-0" /> Creado
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-[var(--error)]">
                                <XCircle className="size-3.5 shrink-0" /> {f.resultado.error}
                              </span>
                            )
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

          <p className="text-xs text-muted-foreground">
            Columnas esperadas: {COLUMNAS_PLANTILLA.join(', ')}. Rol vacío se importa como
            "colaborador". {puedeElegirRol ? '' : 'Solo un administrador puede importar otros roles.'}
          </p>
        </div>

        <DialogFooter className="border-t border-border bg-muted/40 p-4">
          <Button variant="ghost" onClick={cerrar} disabled={importar.isPending}>
            {enviado ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!enviado && (
            <Button
              cargando={importar.isPending}
              disabled={filasValidas.length === 0}
              onClick={() => void enviar()}
            >
              {!importar.isPending && <Upload />} Importar {filasValidas.length || ''} usuario
              {filasValidas.length === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
