import { useMemo, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  useCategorias,
  useConfig,
  useCoordinadores,
  useEmpresas,
  useTipos,
  useTramite,
} from '@/application/catalogos/useCatalogos'
import { crearSolicitud } from '@/application/solicitudes/api'
import { useColaboradoresVisibles } from '@/application/solicitudes/useColaboradores'
import { calcularDuracion, fechaLimiteSoporte } from '@/domain/reglas'
import { problemaAlGuardar, type Problema } from '@/domain/validacion'
import { formatearFecha, formatearFechaLarga } from '@/lib/utils'
import { PanelResumen, type Aviso } from '@/presentation/components/PanelResumen'
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
 * Es el único formulario de la aplicación que **no** llena el titular. Una
 * incapacidad no se pide, se comunica: la expide la EPS o la ARL, ya ocurrió, y
 * la persona que la sufre suele ser justo la que no está en condiciones de
 * radicar nada. El que se entera el mismo día es el jefe directo.
 *
 * De ahí las tres diferencias con el resto de pantallas:
 *
 * 1. Se elige **a quién** se le reporta. La solicitud nace a nombre del
 *    colaborador —es su ausencia y suyo será el soporte— y el jefe queda
 *    registrado en `reportada_por`.
 * 2. **No pasa por la autorización del jefe directo.** Acaba de radicarla él;
 *    pedirle que se autorice a sí mismo sería un trámite vacío. Entra directa a
 *    la bandeja de Talento Humano.
 * 3. **El soporte no se adjunta aquí.** La certificación la carga el
 *    colaborador desde su propia solicitud, porque la policy de Storage ata la
 *    ruta del archivo a `solicitante_id`. El jefe no la tiene el día que
 *    reporta.
 */
export default function ReporteIncapacidad() {
  const { perfil, session } = useAuth()
  const { data: tramite } = useTramite('incapacidad')
  const { data: empresas } = useEmpresas()
  const { data: categorias } = useCategorias()
  const { data: tipos } = useTipos()
  const { data: coordinadores } = useCoordinadores()
  const { data: colaboradores } = useColaboradoresVisibles()
  const { data: config } = useConfig()

  const [form, setForm] = useState({
    colaboradorId: '',
    tipoId: '',
    fechaInicio: HOY,
    fechaFin: HOY,
    entidad: '',
    observaciones: '',
  })
  const [problemas, setProblemas] = useState<Problema[]>([])
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState<SolicitudEnviada | null>(null)

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  /** Solo los motivos de incapacidad: accidente de trabajo, laboral, común. */
  const motivos = useMemo(
    () => tipos?.filter((t) => t.naturaleza === 'incapacidad') ?? [],
    [tipos]
  )
  const tipo = motivos.find((t) => String(t.id) === form.tipoId)

  // Se excluye a uno mismo: para la propia incapacidad, que la reporte su jefe.
  // Si no, el jefe podría saltarse la revisión radicando la suya y validándola.
  const gente = useMemo(
    () => (colaboradores ?? []).filter((c) => c.user_id !== perfil?.user_id),
    [colaboradores, perfil]
  )
  const colaborador = gente.find((c) => c.user_id === form.colaboradorId)

  // Sin horas: una incapacidad se cuenta en días completos, así que
  // `calcularDuracion` cae por sí solo al conteo por días.
  const duracion = useMemo(
    () => calcularDuracion({ fechaInicio: form.fechaInicio, fechaFin: form.fechaFin }),
    [form.fechaInicio, form.fechaFin]
  )

  /** Hasta cuándo tiene el colaborador para subir la certificación. */
  const limiteSoporte = useMemo(
    () =>
      fechaLimiteSoporte({
        fechaFin: form.fechaFin,
        plazoDelMotivo: tipo?.plazo_soporte_dias,
        plazoEnHabiles: tipo?.plazo_soporte_habiles ?? true,
        plazoDiasHabiles: Number(config?.plazo_soporte_dias ?? 3),
      }),
    [form.fechaFin, tipo, config]
  )

  /**
   * Jefe que queda registrado en la solicitud.
   *
   * Es quien reporta, si figura en el catálogo de jefes del servicio. Cuando
   * quien radica es Talento Humano —que no coordina ningún área— se cae al jefe
   * que el colaborador tenga en su perfil.
   */
  const coordinadorRegistrado = useMemo(() => {
    const mio = coordinadores?.find(
      (c) => c.correo?.toLowerCase() === perfil?.correo?.toLowerCase()
        && c.area_id === colaborador?.area_id
    )
    return mio ?? coordinadores?.find((c) => c.id === colaborador?.coordinador_id) ?? null
  }, [coordinadores, perfil, colaborador])

  const avisos = useMemo(() => {
    const lista: Aviso[] = []

    lista.push({
      tono: 'info',
      texto:
        'La incapacidad entra directa a Talento Humano: no pasa por tu autorización, porque la estás radicando tú.',
    })

    if (colaborador) {
      lista.push({
        tono: 'info',
        texto: `${colaborador.nombre} recibirá un correo pidiéndole la certificación, y se le repetirá a diario mientras no la cargue.`,
      })
    }

    if (form.fechaFin < form.fechaInicio) {
      lista.push({ tono: 'advertencia', texto: 'La fecha final es anterior a la de inicio.' })
    }

    if (tipo) {
      lista.push({
        tono: 'advertencia',
        texto: `El colaborador tiene hasta el ${formatearFechaLarga(limiteSoporte)} para cargar la certificación.`,
      })
    }

    return lista
  }, [colaborador, form.fechaInicio, form.fechaFin, tipo, limiteSoporte])

  function hayProblemas(): boolean {
    const encontrados: Problema[] = []

    if (!form.colaboradorId) {
      encontrados.push({
        campo: 'Colaborador',
        causa: 'No indicaste a quién le reportas la incapacidad.',
        motivo:
          'La solicitud se radica a su nombre: es su ausencia y es él quien tiene que cargar la certificación.',
      })
    }

    if (!form.tipoId) {
      encontrados.push({
        campo: 'Origen de la incapacidad',
        causa: 'No elegiste el origen.',
        motivo:
          'Separa la de enfermedad general de las de accidente de trabajo y enfermedad laboral, que van a indicadores distintos y las paga la ARL, no la EPS.',
      })
    }

    if (form.fechaFin < form.fechaInicio) {
      encontrados.push({
        campo: 'Periodo',
        causa: 'La fecha final es anterior a la de inicio.',
        motivo: 'Sin un periodo válido no se puede calcular el tiempo no laborado.',
      })
    }

    setProblemas(encontrados)
    return encontrados.length > 0
  }

  async function guardar() {
    setProblemas([])
    if (!perfil || !session || !tramite || !colaborador) return
    if (hayProblemas()) return

    setEnviando(true)
    try {
      const { id, consecutivo } = await crearSolicitud({
        base: {
          tramite_id: tramite.id,
          // A nombre del colaborador, no de quien reporta.
          solicitante_id: colaborador.user_id,
          reportada_por: session.user.id,
          empresa_id: colaborador.empresa_id,
          area_id: colaborador.area_id,
          cargo_id: colaborador.cargo_id,
          coordinador_id: coordinadorRegistrado?.id ?? null,
          fecha_inicio: form.fechaInicio,
          fecha_fin: form.fechaFin,
          observaciones: form.observaciones.trim() || null,
          // Una incapacidad no puede ser extemporánea: se reporta cuando ocurre.
          extemporanea: false,
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
            : 'Incapacidad reportada por el jefe directo.',
          // Siempre: la certificación es el soporte y llega después.
          requiere_soporte_posterior: true,
          fecha_limite_soporte: limiteSoporte,
        },
      })

      setEnviada({
        id,
        consecutivo,
        siguiente: `Queda en la bandeja de Talento Humano. A ${colaborador.nombre} se le pedirá la certificación por correo.`,
        filas: [
          { etiqueta: 'Colaborador', valor: colaborador.nombre },
          {
            etiqueta: 'Periodo',
            valor: `${formatearFecha(form.fechaInicio)} → ${formatearFecha(form.fechaFin)}`,
          },
          { etiqueta: 'Días', valor: duracion.dias },
          { etiqueta: 'Soporte antes del', valor: formatearFecha(limiteSoporte) },
        ],
      })
    } catch (err) {
      setProblemas([problemaAlGuardar(err)])
    } finally {
      setEnviando(false)
    }
  }

  const nombreEmpresa = empresas?.find((e) => e.id === colaborador?.empresa_id)?.nombre
  const nombreCategoria = categorias?.find((c) => c.id === tipo?.categoria_id)?.nombre

  return (
    <Pantalla
      titulo="Reportar una incapacidad"
      descripcion="La radica el jefe directo y entra a Talento Humano. El colaborador carga la certificación después."
    >
      <form
        className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_19rem] lg:overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
      >
        <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pr-1">
          <section className="bloque-datos bloque-azul p-3">
            <h2 className="bloque-titulo mb-2">A quién se le reporta</h2>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="colaborador">Colaborador<Obligatorio /></Label>
                <Select
                  value={form.colaboradorId}
                  onValueChange={(v) => set('colaboradorId', v)}
                >
                  <SelectTrigger id="colaborador">
                    <SelectValue placeholder="Busca a la persona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {gente.map((c) => (
                      <SelectItem key={c.user_id} value={c.user_id}>
                        {c.nombre}
                        {c.documento ? ` · ${c.documento}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Solo aparece la gente de los servicios que coordinas.
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
                {tipo?.fundamento_legal && (
                  <p className="text-xs text-muted-foreground">{tipo.fundamento_legal}</p>
                )}
              </div>
            </div>
          </section>

          <section className="bloque-datos bloque-teal p-3">
            <h2 className="bloque-titulo mb-2">Periodo de la ausencia</h2>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="inicio">Desde<Obligatorio /></Label>
                <CampoFecha
                  id="inicio"
                  valor={form.fechaInicio}
                  onCambio={(f) => {
                    set('fechaInicio', f)
                    if (form.fechaFin < f) set('fechaFin', f)
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fin">Hasta<Obligatorio /></Label>
                <CampoFecha
                  id="fin"
                  min={form.fechaInicio}
                  valor={form.fechaFin}
                  onCambio={(f) => set('fechaFin', f)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="entidad">EPS o ARL que la expide</Label>
                <Input
                  id="entidad"
                  value={form.entidad}
                  onChange={(e) => set('entidad', e.target.value)}
                  placeholder="Por ejemplo: Sura"
                />
              </div>
            </div>

            <LineaTiempoPeriodo
              className="mt-2.5"
              compacto
              inicio={form.fechaInicio}
              fin={form.fechaFin}
              reintegro={form.fechaFin}
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
              placeholder="Cómo te enteraste, número de la incapacidad si lo tienes…"
            />
          </section>
        </div>

        <PanelResumen
          filas={[
            { etiqueta: 'Reporta', valor: perfil?.nombre ?? '—' },
            { etiqueta: 'Colaborador', valor: colaborador?.nombre ?? '—' },
            { etiqueta: 'Documento', valor: colaborador?.documento ?? '—' },
            { etiqueta: 'Empresa', valor: nombreEmpresa ?? '—' },
            { etiqueta: 'Categoría', valor: nombreCategoria ?? '—' },
            {
              etiqueta: 'Periodo',
              valor: `${formatearFechaLarga(form.fechaInicio)} → ${formatearFechaLarga(form.fechaFin)}`,
            },
            { etiqueta: 'Días calendario', valor: duracion.dias, destacado: true },
            { etiqueta: 'Soporte antes del', valor: formatearFechaLarga(limiteSoporte), destacado: true },
            { etiqueta: 'Aprueba', valor: 'Talento Humano' },
          ]}
          avisos={avisos}
          pie={tramite?.nota_pie}
        />

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end lg:col-span-2">
          <Button type="submit" cargando={enviando}>
            {!enviando && <Stethoscope />} Reportar la incapacidad
          </Button>
        </div>
      </form>

      <DialogoProblemas problemas={problemas} onCerrar={() => setProblemas([])} />
      <DialogoSolicitudEnviada datos={enviada} />
    </Pantalla>
  )
}
