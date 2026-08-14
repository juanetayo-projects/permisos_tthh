import { useMemo, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  documentosDelTipo,
  useAreas,
  useCargos,
  useCategorias,
  useConfig,
  useCoordinadores,
  useEmpresas,
  useEntidadesSalud,
  useMatrizDocumentos,
  useTipos,
  useTramite,
  type Cie10,
} from '@/application/catalogos/useCatalogos'
import { crearSolicitud, guardarDocumentoPropio, subirSoporte } from '@/application/solicitudes/api'
import {
  esRegistroExtemporaneoDeIncapacidad,
  fechaFinDesdeDias,
  fechaLimiteRegistroIncapacidad,
  fechaLimiteSoporte,
} from '@/domain/reglas'
import { aISO } from '@/domain/festivos'
import { documentosDelMomento, type DocumentoConEstado } from '@/domain/soportes'
import { problemaAlGuardar, validarIncapacidad, type Problema } from '@/domain/validacion'
import { formatearFecha, formatearFechaLarga } from '@/lib/utils'
import { PanelResumen, type Aviso } from '@/presentation/components/PanelResumen'
import { CampoArchivo } from '@/presentation/components/CampoArchivo'
import { CampoCie10 } from '@/presentation/components/CampoCie10'
import { CampoFecha } from '@/presentation/components/CampoFecha'
import { LineaTiempoPeriodo } from '@/presentation/components/LineaTiempoPeriodo'
import { DialogoProblemas } from '@/presentation/components/DialogoProblemas'
import {
  DialogoSolicitudEnviada,
  type SolicitudEnviada,
} from '@/presentation/components/DialogoSolicitudEnviada'
import { Pantalla } from '@/presentation/layouts/Pantalla'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { Obligatorio } from '@/presentation/components/ui/obligatorio'
import { Textarea } from '@/presentation/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

const HOY = new Date().toISOString().slice(0, 10)

/**
 * Reporte de incapacidad.
 *
 * Autoservicio: cada quien registra únicamente la suya propia, igual que el
 * resto de trámites de la aplicación. No pasa por la autorización del jefe
 * directo -la incapacidad ya ocurrió y nadie tiene que autorizarla-, así que
 * entra directa a la bandeja de Talento Humano.
 */
export default function ReporteIncapacidad() {
  const { perfil, session } = useAuth()
  const { data: tramite } = useTramite('incapacidad')
  const { data: empresas } = useEmpresas()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: categorias } = useCategorias()
  const { data: tipos } = useTipos()
  const { data: coordinadores } = useCoordinadores()
  const { data: config } = useConfig()
  const { data: matriz } = useMatrizDocumentos()
  const { data: entidadesSalud } = useEntidadesSalud()

  const [form, setForm] = useState({
    /** Vacío = se toma el del perfil; si el perfil no lo tiene, se pide aquí. */
    documento: '',
    tipoId: '',
    fechaInicio: HOY,
    /** Solo se pide cuando el motivo no tiene duración legal fija. */
    numeroDias: '',
    entidad: '',
    observaciones: '',
  })
  const [problemas, setProblemas] = useState<Problema[]>([])
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState<SolicitudEnviada | null>(null)
  /**
   * Un campo de carga por cada documento de la matriz, en vez de uno genérico:
   * con hasta cuatro documentos distintos (maternidad, por ejemplo), no queda
   * a la vista cuál archivo era cuál.
   */
  const [archivosPorDocumento, setArchivosPorDocumento] = useState<Record<number, File[]>>({})
  /** Diagnóstico CIE10 principal, como lo exigen los RIPS. */
  const [dxPrincipal, setDxPrincipal] = useState<Cie10 | null>(null)

  function setArchivosDeDocumento(documentoId: number, archivos: File[]) {
    setArchivosPorDocumento((m) => ({ ...m, [documentoId]: archivos }))
  }

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  // Empresa, servicio y cargo ya no se piden: nacen del perfil, igual que en
  // el resto de formularios.
  const empresaId = perfil?.empresa_id ? String(perfil.empresa_id) : ''
  const areaId = perfil?.area_id ? String(perfil.area_id) : ''
  const cargoId = perfil?.cargo_id ? String(perfil.cargo_id) : ''
  const documento = form.documento || perfil?.documento || ''
  const perfilIncompleto = !empresaId || !areaId || !cargoId

  /** Solo los motivos de incapacidad: accidente de trabajo, enfermedad común, licencias. */
  const motivos = useMemo(
    () => tipos?.filter((t) => t.naturaleza === 'incapacidad') ?? [],
    [tipos]
  )
  const tipo = motivos.find((t) => String(t.id) === form.tipoId)

  /**
   * Jefe directo del área propia.
   *
   * La incapacidad no pasa por su autorización, pero queda registrado en la
   * solicitud para que aparezca en la bandeja de su área.
   */
  const coordinador = useMemo(() => {
    const delArea = coordinadores?.find((c) => String(c.area_id) === areaId)
    if (delArea) return delArea
    return coordinadores?.find((c) => c.id === perfil?.coordinador_id)
  }, [coordinadores, perfil, areaId])

  /**
   * Duración en días: fija por ley para maternidad/paternidad (no se
   * pregunta), o el número de días que reporta quien registra para el resto
   * de incapacidades. Sin horas: una incapacidad siempre se cuenta en días
   * completos.
   */
  const dias = tipo?.duracion_en_dias_fija
    ? (tipo.duracion_maxima_dias ?? 0)
    : Number(form.numeroDias) || 0
  const duracion = useMemo(() => ({ dias, horas: dias * 8 }), [dias])

  /** Documentos que el motivo exige, con su norma. */
  const docsDelTipo = useMemo(() => documentosDelTipo(matriz, tipo?.id), [matriz, tipo])
  const docsPrevios = useMemo(
    () => documentosDelMomento({ matriz: docsDelTipo, momento: 'previo', diasPermiso: duracion.dias }),
    [docsDelTipo, duracion.dias]
  )
  const docsPosteriores = useMemo(
    () => documentosDelMomento({ matriz: docsDelTipo, momento: 'posterior', diasPermiso: duracion.dias }),
    [docsDelTipo, duracion.dias]
  )

  /**
   * El certificado es siempre obligatorio; de dos días de incapacidad en
   * adelante, la matriz suma la historia clínica -o el radicado ante la EPS/
   * ARL, que la reemplaza-. Los dos bloquean el envío: quien registra la
   * incapacidad ya la tiene toda encima, así que no hay razón para diferir el
   * segundo documento a después, como sí pasa en otros trámites.
   */
  const faltanSoportesObligatorios = [...docsPrevios, ...docsPosteriores].some(
    (d) => d.exigible && d.obligatorio && (archivosPorDocumento[d.documentoId]?.length ?? 0) === 0
  )

  /** La fecha final nunca se digita: siempre sale de inicio + días corridos. */
  const fechaFin = useMemo(
    () => (dias > 0 ? fechaFinDesdeDias(form.fechaInicio, dias) : form.fechaInicio),
    [form.fechaInicio, dias]
  )

  /** Hasta cuándo hay plazo para cargar los documentos que quedan pendientes. */
  const limiteSoporte = useMemo(
    () =>
      fechaLimiteSoporte({
        fechaFin,
        plazoDelMotivo: tipo?.plazo_soporte_dias,
        plazoEnHabiles: tipo?.plazo_soporte_habiles ?? true,
        plazoDiasHabiles: Number(config?.plazo_soporte_dias ?? 3),
      }),
    [fechaFin, tipo, config]
  )

  /** Último día para registrarla sin quedar extemporánea. */
  const limiteRegistro = useMemo(
    () => fechaLimiteRegistroIncapacidad(form.fechaInicio),
    [form.fechaInicio]
  )

  /**
   * ¿Se está registrando fuera de plazo?
   *
   * Se recalcula con la fecha real de hoy -no con la constante congelada al
   * cargar la página- para que no se equivoque si el formulario se deja
   * abierto de un día para otro.
   */
  const extemporanea = useMemo(
    () =>
      esRegistroExtemporaneoDeIncapacidad({
        fechaExpedicion: form.fechaInicio,
        fechaRegistro: aISO(new Date()),
      }),
    [form.fechaInicio]
  )

  const avisos = useMemo(() => {
    const lista: Aviso[] = []

    lista.push({
      tono: 'info',
      texto:
        'La incapacidad entra directa a Talento Humano: no pasa por la autorización de tu jefe directo.',
    })

    if (tipo) {
      lista.push({
        tono: 'advertencia',
        texto: extemporanea
          ? `El plazo para registrarla vencía el ${formatearFechaLarga(limiteRegistro)} (día hábil siguiente a la fecha de expedición). Quedará marcada como extemporánea.`
          : `Tienes hasta el ${formatearFechaLarga(limiteRegistro)} para registrarla sin que quede extemporánea.`,
      })
    }

    if (!coordinador) {
      lista.push({
        tono: 'advertencia',
        texto: perfilIncompleto
          ? 'Tu perfil todavía no tiene servicio o cargo asignado: contacta a Talento Humano antes de registrar.'
          : 'Tu servicio no tiene jefe directo asignado en el catálogo. Contacta a Talento Humano.',
      })
    }

    return lista
  }, [tipo, extemporanea, limiteRegistro, coordinador, perfilIncompleto])

  function hayProblemas(): boolean {
    const encontrados = validarIncapacidad({
      documento,
      empresaId,
      areaId,
      cargoId,
      tipoId: form.tipoId,
      numeroDiasRequerido: Boolean(tipo && !tipo.duracion_en_dias_fija),
      numeroDias: dias,
      tieneDxPrincipal: Boolean(dxPrincipal),
      faltanSoportesObligatorios,
    })

    setProblemas(encontrados)
    return encontrados.length > 0
  }

  async function guardar() {
    setProblemas([])
    if (!perfil || !session || !tramite) return
    if (hayProblemas()) return

    setEnviando(true)
    try {
      // Se guarda una sola vez: a partir de aquí viene del perfil.
      if (documento.trim() && documento.trim() !== perfil.documento) {
        await guardarDocumentoPropio(perfil.user_id, documento)
      }

      // Recalculada con la hora real del envío, no con la constante del
      // montaje de la página.
      const extemporaneaFinal = esRegistroExtemporaneoDeIncapacidad({
        fechaExpedicion: form.fechaInicio,
        fechaRegistro: aISO(new Date()),
      })

      const { id, consecutivo } = await crearSolicitud({
        base: {
          tramite_id: tramite.id,
          solicitante_id: perfil.user_id,
          empresa_id: empresaId ? Number(empresaId) : null,
          area_id: areaId ? Number(areaId) : null,
          cargo_id: cargoId ? Number(cargoId) : null,
          coordinador_id: coordinador?.id ?? null,
          fecha_inicio: form.fechaInicio,
          fecha_fin: fechaFin,
          observaciones: form.observaciones.trim() || null,
          extemporanea: extemporaneaFinal,
        },
        enviar: true,
        rutaAprobacion: 'th_directo',
        detallePermiso: {
          categoria_id: tipo?.categoria_id ?? null,
          tipo_id: tipo?.id ?? null,
          horas_permiso: duracion.horas,
          dias_permiso: duracion.dias,
          remunerado: true,
          requiere_compensacion: false,
          justificacion: form.entidad.trim()
            ? `Incapacidad expedida por ${form.entidad.trim()}.`
            : null,
          requiere_soporte_posterior: docsPosteriores.some((d) => d.exigible && d.obligatorio),
          fecha_limite_soporte: limiteSoporte,
          cie10_codigo: dxPrincipal?.codigo ?? null,
        },
      })

      // Cada archivo ya sabe qué documento es: viene de su propio campo de
      // carga, no de un orden que había que adivinar.
      for (const doc of [...docsPrevios, ...docsPosteriores]) {
        for (const archivo of archivosPorDocumento[doc.documentoId] ?? []) {
          await subirSoporte({
            solicitudId: id,
            archivo,
            momento: doc.momento,
            usuarioId: session.user.id,
            maxMB: Number(config?.max_mb_adjunto ?? 10),
            documentoId: doc.documentoId,
          })
        }
      }

      setEnviada({
        id,
        consecutivo,
        siguiente: 'Queda en la bandeja de Talento Humano.',
        filas: [
          {
            etiqueta: 'Periodo',
            valor: `${formatearFecha(form.fechaInicio)} → ${formatearFecha(fechaFin)}`,
          },
          { etiqueta: 'Días', valor: duracion.dias },
          ...(docsPosteriores.some((d) => d.exigible && d.obligatorio)
            ? [{ etiqueta: 'Documentos pendientes antes del', valor: formatearFecha(limiteSoporte) }]
            : []),
        ],
      })
    } catch (err) {
      setProblemas([problemaAlGuardar(err)])
    } finally {
      setEnviando(false)
    }
  }

  const nombreEmpresa = empresas?.find((e) => String(e.id) === empresaId)?.nombre
  const nombreArea = areas?.find((a) => String(a.id) === areaId)?.nombre
  const nombreCargo = cargos?.find((c) => String(c.id) === cargoId)?.nombre
  const nombreCategoria = categorias?.find((c) => c.id === tipo?.categoria_id)?.nombre

  return (
    <Pantalla
      titulo="Reportar una incapacidad"
      descripcion="Registra tu propia incapacidad. Entra directa a Talento Humano, sin pasar por tu jefe directo."
    >
      <form
        className="grid min-h-0 flex-1 gap-3 md:grid-cols-[1fr_19rem] md:overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
      >
        <div className="min-h-0 space-y-3 md:overflow-y-auto md:pr-1">
          <section className="bloque-datos bloque-azul p-3">
            <h2 className="bloque-titulo mb-2">Información general</h2>

            <div className="grid items-end gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label htmlFor="documento">N.° de identificación<Obligatorio /></Label>
                <Input
                  id="documento"
                  inputMode="numeric"
                  value={documento}
                  onChange={(e) => set('documento', e.target.value)}
                  placeholder="Cédula"
                />
              </div>

              <div className="space-y-1">
                <Label>Empresa</Label>
                <p className="flex h-9 items-center rounded-md border border-input bg-muted/60 px-3 text-sm">
                  {nombreEmpresa ?? 'Sin asignar'}
                </p>
              </div>

              <div className="space-y-1">
                <Label>Servicio actual</Label>
                <p className="flex h-9 items-center rounded-md border border-input bg-muted/60 px-3 text-sm">
                  {nombreArea ?? 'Sin asignar'}
                </p>
              </div>

              <div className="space-y-1">
                <Label>Cargo</Label>
                <p className="flex h-9 items-center rounded-md border border-input bg-muted/60 px-3 text-sm">
                  {nombreCargo ?? 'Sin asignar'}
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="origen">Origen de la incapacidad<Obligatorio /></Label>
                <Select value={form.tipoId} onValueChange={(v) => set('tipoId', v)}>
                  <SelectTrigger id="origen">
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivos.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {tipo?.fundamento_legal && (
              <p className="mt-2 truncate text-[11px] leading-snug text-muted-foreground" title={tipo.fundamento_legal}>
                {tipo.fundamento_legal}
              </p>
            )}

            {perfilIncompleto && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Tu perfil no tiene empresa, servicio o cargo asignado. Contacta a Talento Humano
                antes de registrar la incapacidad.
              </p>
            )}
          </section>

          <section className="bloque-datos bloque-teal p-3">
            <h2 className="bloque-titulo mb-2">Periodo de la ausencia</h2>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="inicio">Desde<Obligatorio /></Label>
                <CampoFecha
                  id="inicio"
                  valor={form.fechaInicio}
                  // Una incapacidad empieza el día que la expide la EPS o la ARL,
                  // aunque sea fin de semana o festivo: nunca se corrige.
                  soloHabiles={false}
                  onCambio={(f) => set('fechaInicio', f)}
                />
              </div>

              {tipo?.duracion_en_dias_fija ? (
                <div className="space-y-1">
                  <Label>Duración</Label>
                  <p className="flex h-9 items-center text-sm font-medium">
                    {tipo.duracion_maxima_dias} días corridos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    La fija la ley: no se pregunta ni se puede cambiar aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="dias">Número de días<Obligatorio /></Label>
                  <Input
                    id="dias"
                    type="number"
                    min={1}
                    step={1}
                    value={form.numeroDias}
                    onChange={(e) => set('numeroDias', e.target.value)}
                    placeholder="Días corridos que cubre la incapacidad"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="fin">Hasta</Label>
                <Input id="fin" readOnly tabIndex={-1} className="bg-muted/60" value={formatearFecha(fechaFin)} />
                <p className="text-xs text-muted-foreground">Calculada: inicio + días corridos.</p>
              </div>
            </div>

            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_2fr]">
              <div className="space-y-1">
                <Label htmlFor="entidad">EPS o ARL que la expide</Label>
                <Select value={form.entidad} onValueChange={(v) => set('entidad', v)}>
                  <SelectTrigger id="entidad">
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {entidadesSalud?.map((e) => (
                      <SelectItem key={e.id} value={e.nombre}>
                        {e.nombre} · {e.tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <CampoCie10
                id="cie10-principal"
                etiqueta="Diagnóstico CIE10 principal"
                valor={dxPrincipal}
                onCambio={setDxPrincipal}
                obligatorio
              />
            </div>

            {tipo && (
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                {[...docsPrevios, ...docsPosteriores]
                  .filter((d) => d.exigible || d.obligatorio)
                  .map((d) => (
                    <CampoDocumento
                      key={`${d.documentoId}-${d.momento}`}
                      documento={d}
                      archivos={archivosPorDocumento[d.documentoId] ?? []}
                      onCambio={(a) => setArchivosDeDocumento(d.documentoId, a)}
                      maxMB={Number(config?.max_mb_adjunto ?? 10)}
                    />
                  ))}
              </div>
            )}

            <LineaTiempoPeriodo
              className="mt-2.5"
              compacto
              inicio={form.fechaInicio}
              fin={fechaFin}
              reintegro={fechaFin}
            />
          </section>

          <section className="bloque-datos bloque-ambar p-3">
            <Label htmlFor="observaciones" className="bloque-titulo">
              Observaciones
            </Label>
            <Textarea
              id="observaciones"
              className="mt-2 min-h-16"
              value={form.observaciones}
              onChange={(e) => set('observaciones', e.target.value)}
              placeholder="Número de la incapacidad, si lo tienes…"
            />
          </section>
        </div>

        <PanelResumen
          filas={[
            { etiqueta: 'Registra', valor: perfil?.nombre ?? '—' },
            { etiqueta: 'Documento', valor: documento || '—' },
            { etiqueta: 'Empresa', valor: nombreEmpresa ?? '—' },
            { etiqueta: 'Categoría', valor: nombreCategoria ?? '—' },
            {
              etiqueta: 'Periodo',
              valor: `${formatearFechaLarga(form.fechaInicio)} → ${formatearFechaLarga(fechaFin)}`,
            },
            { etiqueta: 'Días calendario', valor: duracion.dias, destacado: true },
            {
              etiqueta: 'Dx principal',
              valor: dxPrincipal ? `${dxPrincipal.codigo} · ${dxPrincipal.nombre}` : '—',
            },
            { etiqueta: 'Registro', valor: extemporanea ? 'Extemporáneo' : 'A tiempo', destacado: extemporanea },
            { etiqueta: 'Aprueba', valor: 'Talento Humano' },
          ]}
          avisos={avisos}
          pie={tramite?.nota_pie}
        />

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end md:col-span-2">
          <Button type="submit" cargando={enviando}>
            {!enviando && <Stethoscope />} Registrar la incapacidad
          </Button>
        </div>
      </form>

      <DialogoProblemas problemas={problemas} onCerrar={() => setProblemas([])} />
      <DialogoSolicitudEnviada datos={enviada} />
    </Pantalla>
  )
}

/**
 * Un campo de carga por documento exigido.
 *
 * Todos los obligatorios bloquean el envío, sean «al solicitar» o «al
 * volver»: quien registra la incapacidad ya la tiene toda encima -la EPS la
 * expide completa-, así que no hay razón para diferir un segundo documento a
 * después, como sí pasa en otros trámites que se piden por adelantado.
 */
function CampoDocumento({
  documento,
  archivos,
  onCambio,
  maxMB,
}: {
  documento: DocumentoConEstado
  archivos: File[]
  onCambio: (archivos: File[]) => void
  maxMB: number
}) {
  const obligatorio = documento.exigible && documento.obligatorio

  return (
    <div className="space-y-1">
      <Label htmlFor={`doc-${documento.documentoId}`} className="text-xs">
        {documento.nombre}
        {obligatorio && <Obligatorio />}
        <span className="ml-1 font-normal text-muted-foreground">
          ({documento.momento === 'previo' ? 'al solicitar' : 'al volver'})
        </span>
      </Label>
      <CampoArchivo
        id={`doc-${documento.documentoId}`}
        archivos={archivos}
        onCambio={onCambio}
        maxMB={maxMB}
        max={3}
        obligatorio={obligatorio}
      />
      {documento.nota && <p className="text-[10px] leading-snug text-muted-foreground">{documento.nota}</p>}
    </div>
  )
}
