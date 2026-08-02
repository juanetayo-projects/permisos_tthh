import { useMemo, useState } from 'react'
import { AlertCircle, Save, Send } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  documentosDelTipo,
  useAreas,
  useCargos,
  useCategorias,
  useConfig,
  useCoordinadores,
  etiquetaCoordinador,
  useEmpresas,
  useMatrizDocumentos,
  useTipos,
  useTramite,
} from '@/application/catalogos/useCatalogos'
import { crearSolicitud, guardarDocumentoPropio, subirSoporte } from '@/application/solicitudes/api'
import {
  usePeriodosOcupados,
  usePeriodosSuspendidos,
  useSolicitudes,
} from '@/application/solicitudes/useSolicitudes'
import {
  calcularDuracion,
  evaluarAntelacion,
  evaluarCupo,
  evaluarDuracion,
  evaluarSoporte,
  rangoFechasPermitido,
} from '@/domain/reglas'
import { evaluarSolapamiento } from '@/domain/concurrencia'
import { documentosDelMomento } from '@/domain/soportes'
import { aISO } from '@/domain/festivos'
import { formatearFecha, formatearFechaLarga } from '@/lib/utils'
import { PanelResumen, type Aviso } from '@/presentation/components/PanelResumen'
import { AvisoCruce } from '@/presentation/components/AvisoCruce'
import { CampoArchivo } from '@/presentation/components/CampoArchivo'
import { CampoFecha } from '@/presentation/components/CampoFecha'
import { ListaDocumentos } from '@/presentation/components/ListaDocumentos'
import { LineaTiempoPeriodo } from '@/presentation/components/LineaTiempoPeriodo'
import { DialogoConfirmarJefe } from '@/presentation/components/DialogoConfirmarJefe'
import {
  DialogoSolicitudEnviada,
  type SolicitudEnviada,
} from '@/presentation/components/DialogoSolicitudEnviada'
import { Button } from '@/presentation/components/ui/button'
import { Checkbox } from '@/presentation/components/ui/checkbox'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { Textarea } from '@/presentation/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

const HOY = new Date().toISOString().slice(0, 10)

export default function SolicitudPermiso() {
  const { perfil, session } = useAuth()
  const { data: tramite } = useTramite('permiso')
  const { data: empresas } = useEmpresas()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: coordinadores } = useCoordinadores()
  const { data: categorias } = useCategorias()
  const { data: tipos } = useTipos()
  const { data: config } = useConfig()
  const { data: matriz } = useMatrizDocumentos()
  const { data: ocupados } = usePeriodosOcupados(perfil?.user_id)
  const { data: suspendidos } = usePeriodosSuspendidos(perfil?.user_id)
  const { data: propias } = useSolicitudes({ soloPropias: true }, perfil?.user_id)

  const [form, setForm] = useState({
    empresaId: '',
    areaId: '',
    cargoId: '',
    /** Vacío = se propone el del área. El colaborador puede cambiarlo. */
    coordinadorId: '',
    /** Vacío = se toma el del perfil; si el perfil no lo tiene, se pide aquí. */
    documento: '',
    categoriaId: '',
    tipoId: '',
    tipoOtro: '',
    fechaInicio: HOY,
    fechaFin: HOY,
    horaSalida: '08:00',
    horaRegreso: '12:00',
    remunerado: true,
    requiereCompensacion: false,
    planCompensacion: '',
    justificacion: '',
  })
  const [soporte, setSoporte] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState<SolicitudEnviada | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  // El perfil llena los campos que no debería tener que digitar el colaborador.
  const empresaId = form.empresaId || (perfil?.empresa_id ? String(perfil.empresa_id) : '')
  const areaId = form.areaId || (perfil?.area_id ? String(perfil.area_id) : '')
  const cargoId = form.cargoId || (perfil?.cargo_id ? String(perfil.cargo_id) : '')
  const documento = form.documento || perfil?.documento || ''

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  /**
   * Motivos de la categoría elegida.
   *
   * Los trámites quedan fuera: el retiro parcial de cesantías tiene formulario
   * propio porque no tiene periodo, ni horario, ni antelación que cumplir.
   * Ofrecerlo aquí obligaba a responder preguntas que no significan nada.
   */
  const tiposDeCategoria = useMemo(
    () =>
      tipos?.filter(
        (t) => String(t.categoria_id) === form.categoriaId && t.naturaleza !== 'tramite'
      ) ?? [],
    [tipos, form.categoriaId]
  )
  const tipo = tipos?.find((t) => String(t.id) === form.tipoId)

  /**
   * Jefe directo que autorizará la solicitud.
   *
   * Se elige de forma explícita y no se deduce del perfil: un colaborador puede
   * haber cambiado de servicio, y con el dato del perfil desactualizado la
   * solicitud caería en la bandeja del coordinador equivocado. Se propone el
   * del área seleccionada, pero manda lo que elija quien solicita.
   */
  const coordinadorPropuesto = useMemo(() => {
    const delArea = coordinadores?.find((c) => String(c.area_id) === areaId)
    if (delArea) return delArea
    return coordinadores?.find((c) => c.id === perfil?.coordinador_id)
  }, [coordinadores, perfil, areaId])

  const coordinadorId = form.coordinadorId || (coordinadorPropuesto ? String(coordinadorPropuesto.id) : '')
  const coordinador = coordinadores?.find((c) => String(c.id) === coordinadorId)

  /**
   * Ventana de fechas del motivo.
   *
   * Antes la única regla era «no antes de hoy, salvo calamidad y luto». Con eso
   * una incapacidad expedida el viernes no se podía registrar el lunes, y un
   * permiso para dentro de tres años se aceptaba sin más. Ahora cada motivo
   * declara cuánto admite hacia atrás y hacia adelante, y **aquí sí se acota el
   * selector**: una fecha fuera de rango no es una solicitud extemporánea, es
   * un dato equivocado.
   */
  const rangoFechas = useMemo(
    () =>
      rangoFechasPermitido(
        tipo
          ? {
              nombre: tipo.nombre,
              diasMaxRetroactivo: tipo.dias_max_retroactivo,
              diasMaxFuturo: tipo.dias_max_futuro,
              duracionMaximaDias: tipo.duracion_maxima_dias,
              permiteHoras: tipo.permite_horas,
              diasCalendario: tipo.dias_calendario,
              maxPorPeriodo: tipo.max_por_periodo,
              periodoControl: tipo.periodo_control,
            }
          : null,
        HOY
      ),
    [tipo]
  )

  /**
   * Qué días admite este motivo.
   *
   * Una incapacidad o una licencia corren por calendario: empiezan el día que
   * las expide el médico, aunque sea sábado. Una cita médica o una diligencia,
   * no: no se pide permiso para un día que no se trabaja. Lo decide el propio
   * motivo (`dias_calendario`), configurable desde Administración.
   */
  const admiteNoHabiles = Boolean(tipo?.dias_calendario || tipo?.exento_antelacion)

  /**
   * ¿Este motivo se puede pedir por horas?
   *
   * Una licencia de maternidad o una incapacidad se miden en días completos, y
   * preguntar por la hora de salida y de regreso no solo sobra: hacía que la
   * duración se calculara como una jornada parcial cuando el permiso era de un
   * solo día. Mientras no haya motivo elegido se dejan las horas visibles, que
   * es el caso más común.
   */
  const permiteHoras = tipo ? tipo.permite_horas : true

  const coordinadoresDelArea = useMemo(
    () => coordinadores?.filter((c) => String(c.area_id) === areaId) ?? [],
    [coordinadores, areaId]
  )
  const otrosCoordinadores = useMemo(
    () => coordinadores?.filter((c) => String(c.area_id) !== areaId) ?? [],
    [coordinadores, areaId]
  )

  const duracion = useMemo(
    () =>
      calcularDuracion({
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        horaSalida: permiteHoras ? form.horaSalida : null,
        horaRegreso: permiteHoras ? form.horaRegreso : null,
      }),
    [form.fechaInicio, form.fechaFin, form.horaSalida, form.horaRegreso, permiteHoras]
  )

  const antelacion = useMemo(
    () =>
      tramite
        ? evaluarAntelacion({
            fechaInicio: form.fechaInicio,
            horaSalida: permiteHoras ? form.horaSalida : null,
            antelacionMinima: tramite.antelacion_minima,
            unidad: tramite.unidad_antelacion,
            exento: tipo?.exento_antelacion,
          })
        : null,
    [tramite, form.fechaInicio, form.horaSalida, tipo, permiteHoras]
  )

  const soporteExigido = useMemo(
    () =>
      tipo
        ? evaluarSoporte({
            requiereSoportePrevio: tipo.requiere_soporte_previo,
            requiereSoportePosterior: tipo.requiere_soporte_posterior,
            umbralDias: tipo.soporte_obligatorio_desde_dias,
            diasPermiso: duracion.dias,
            fechaFin: form.fechaFin,
            plazoDiasHabiles: Number(config?.dias_plazo_soporte_posterior ?? 5),
            plazoDelMotivo: tipo.plazo_soporte_dias,
            plazoEnHabiles: tipo.plazo_soporte_habiles,
          })
        : null,
    [tipo, duracion.dias, form.fechaFin, config]
  )

  /** Documentos concretos que exige el motivo, con su norma. */
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
   * Documento que se está adjuntando ahora.
   *
   * El formulario acepta un archivo, así que se etiqueta con el primer
   * documento previo obligatorio: es el que la matriz declara imprescindible.
   * Los demás se entregan desde el detalle, donde ya hay lista de verificación.
   */
  const documentoDelAdjunto = useMemo(
    () => docsPrevios.find((d) => d.exigible && d.obligatorio) ?? docsPrevios[0] ?? null,
    [docsPrevios]
  )

  const avisoDuracion = useMemo(
    () =>
      evaluarDuracion(tipo ? { duracionMaximaDias: tipo.duracion_maxima_dias } : null, duracion.dias),
    [tipo, duracion.dias]
  )

  /** Cupo del motivo en el periodo: el día de la familia es semestral. */
  const avisoCupo = useMemo(() => {
    if (!tipo?.max_por_periodo) return null

    const previas = (propias ?? [])
      .filter(
        (s) =>
          s.detalle_permiso?.tipo?.id === tipo.id &&
          !s.estado.startsWith('RECHAZADA') &&
          s.estado !== 'CANCELADA' &&
          s.estado !== 'BORRADOR'
      )
      .map((s) => s.fecha_inicio)

    return evaluarCupo({
      reglas: { maxPorPeriodo: tipo.max_por_periodo, periodoControl: tipo.periodo_control },
      fechaInicio: form.fechaInicio,
      previas,
    })
  }, [tipo, propias, form.fechaInicio])

  /** Cruces con periodos que este colaborador ya tiene ocupados. */
  const cruces = useMemo(() => {
    if (!tipo) return null

    return evaluarSolapamiento({
      nuevo: {
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        motivo: tipo.nombre,
        prioridad: tipo.prioridad,
        interrumpeOtros: tipo.interrumpe_otros,
      },
      ocupados: ocupados ?? [],
    })
  }, [tipo, form.fechaInicio, form.fechaFin, ocupados])

  const avisos = useMemo(() => {
    const lista: Aviso[] = []
    if (antelacion?.mensaje) {
      lista.push({ tono: antelacion.exenta ? 'info' : 'advertencia', texto: antelacion.mensaje })
    }
    // Los dos momentos pueden coincidir, así que se avisa de cada uno.
    if (soporteExigido?.previo) {
      lista.push({ tono: 'advertencia', texto: soporteExigido.previo.mensaje })
    }
    if (soporteExigido?.posterior) {
      lista.push({
        tono: soporteExigido.posterior.obligatorio ? 'advertencia' : 'info',
        texto: soporteExigido.posterior.mensaje,
      })
    }
    if (avisoDuracion.mensaje) {
      lista.push({ tono: 'advertencia', texto: avisoDuracion.mensaje })
    }
    if (avisoCupo?.mensaje) {
      lista.push({ tono: avisoCupo.excedido ? 'advertencia' : 'info', texto: avisoCupo.mensaje })
    }
    // Un periodo suspendido que nadie reprograma se queda pendiente para
    // siempre; el momento de recordarlo es justo cuando se pide otro permiso.
    for (const s of suspendidos ?? []) {
      lista.push({
        tono: 'info',
        texto: `Tienes ${s.dias_pendientes_reprogramar ?? 0} días pendientes de reprogramar de ${s.consecutivo ?? 'un periodo interrumpido'}.`,
      })
    }
    if (tipo?.ruta_aprobacion === 'gerente_th_directo') {
      lista.push({
        tono: 'info',
        texto:
          tipo.naturaleza === 'tramite'
            ? 'Es un trámite, no un permiso: va directo a la Gerencia de Talento Humano y no cuenta como ausencia.'
            : 'Este trámite va directo a la Gerencia de Talento Humano, sin pasar por tu jefe directo.',
      })
    }
    if (!coordinador && tipo?.ruta_aprobacion !== 'gerente_th_directo') {
      lista.push({
        tono: 'advertencia',
        texto: 'Selecciona el jefe directo que debe autorizar: es quien recibirá la solicitud.',
      })
    }
    // Cambió de servicio respecto a su perfil: conviene que confirme el jefe.
    if (perfil?.area_id && areaId && String(perfil.area_id) !== areaId) {
      lista.push({
        tono: 'info',
        texto: `Estás solicitando desde un servicio distinto al de tu perfil. Verifica que ${coordinador?.nombre ?? 'el jefe directo'} sea quien debe autorizarte hoy.`,
      })
    }
    return lista
  }, [
    antelacion,
    soporteExigido,
    tipo,
    coordinador,
    perfil,
    areaId,
    avisoDuracion,
    avisoCupo,
    suspendidos,
  ])

  async function guardar(enviar: boolean) {
    setError(null)

    if (!perfil || !session || !tramite) return
    if (enviar && !form.tipoId) {
      setError('Selecciona la categoría y el motivo del permiso.')
      return
    }
    if (enviar && !form.justificacion.trim()) {
      setError('Describe la justificación del permiso.')
      return
    }
    if (enviar && soporteExigido?.previo?.obligatorio && !soporte) {
      setError('Este motivo exige adjuntar el soporte al momento de solicitar.')
      return
    }
    if (enviar && !coordinador && tipo?.ruta_aprobacion !== 'gerente_th_directo') {
      setError('Selecciona el jefe directo que debe autorizar la solicitud.')
      return
    }
    if (enviar && !documento.trim()) {
      setError('Indica tu número de identificación: el formato lo exige.')
      return
    }

    setEnviando(true)
    try {
      // Se guarda una sola vez: a partir de aquí viene del perfil.
      if (documento.trim() && documento.trim() !== perfil.documento) {
        await guardarDocumentoPropio(perfil.user_id, documento)
      }

      const { id, consecutivo } = await crearSolicitud({
        base: {
          tramite_id: tramite.id,
          solicitante_id: perfil.user_id,
          empresa_id: empresaId ? Number(empresaId) : null,
          area_id: areaId ? Number(areaId) : null,
          cargo_id: cargoId ? Number(cargoId) : null,
          coordinador_id: coordinador?.id ?? null,
          fecha_inicio: form.fechaInicio,
          fecha_fin: form.fechaFin,
          extemporanea: antelacion?.extemporanea ?? false,
        },
        enviar,
        rutaAprobacion: tipo?.ruta_aprobacion,
        detallePermiso: {
          categoria_id: form.categoriaId ? Number(form.categoriaId) : null,
          tipo_id: form.tipoId ? Number(form.tipoId) : null,
          tipo_otro: form.tipoOtro.trim() || null,
          hora_salida: permiteHoras ? form.horaSalida || null : null,
          hora_regreso: permiteHoras ? form.horaRegreso || null : null,
          horas_permiso: duracion.horas,
          dias_permiso: duracion.dias,
          remunerado: form.remunerado,
          requiere_compensacion: form.requiereCompensacion,
          plan_compensacion: form.planCompensacion.trim() || null,
          justificacion: form.justificacion.trim() || null,
          requiere_soporte_posterior: Boolean(soporteExigido?.posterior?.obligatorio),
          fecha_limite_soporte: soporteExigido?.posterior?.fechaLimite ?? null,
        },
      })

      if (soporte) {
        await subirSoporte({
          solicitudId: id,
          archivo: soporte,
          momento: 'previo',
          usuarioId: session.user.id,
          maxMB: Number(config?.max_mb_adjunto ?? 10),
          documentoId: documentoDelAdjunto?.documentoId ?? null,
        })
      }

      setEnviada({
        id,
        consecutivo,
        siguiente: !enviar
          ? 'Puedes retomarla cuando quieras desde Mis solicitudes.'
          : tipo?.ruta_aprobacion === 'gerente_th_directo'
            ? 'Queda en la bandeja de la Gerencia de Talento Humano.'
            : `Queda en la bandeja de ${coordinador?.nombre ?? 'tu jefe directo'} para su autorización.`,
        filas: [
          { etiqueta: 'Motivo', valor: tipo?.nombre ?? '—' },
          {
            etiqueta: 'Periodo',
            valor:
              form.fechaInicio === form.fechaFin
                ? formatearFecha(form.fechaInicio)
                : `${formatearFecha(form.fechaInicio)} → ${formatearFecha(form.fechaFin)}`,
          },
          { etiqueta: 'Duración', valor: `${duracion.horas} h · ${duracion.dias} días` },
          { etiqueta: 'Jefe directo', valor: coordinador?.nombre ?? 'Sin asignar' },
          { etiqueta: 'Soporte adjunto', valor: soporte ? soporte.name : 'Ninguno' },
        ],
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No fue posible guardar la solicitud. Intenta de nuevo.'
      )
    } finally {
      setEnviando(false)
    }
  }

  const nombreArea = areas?.find((a) => String(a.id) === areaId)?.nombre
  const nombreEmpresa = empresas?.find((e) => String(e.id) === empresaId)?.nombre

  return (
    // Altura fija y scroll por dentro. Sin esto, el formulario se salía de la
    // ventana —que en escritorio no scrollea— y quedaban fuera de alcance la
    // justificación, la compensación y los propios botones de enviar.
    <form
      className="mx-auto flex max-w-7xl flex-col gap-3 lg:h-full lg:overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault()
        // Se confirma el jefe antes de grabar: el aviso sale por correo y
        // corregirlo despues implica cancelar y rehacer la solicitud.
        setConfirmando(true)
      }}
    >
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3">
        <h1 className="text-lg font-semibold tracking-tight">Solicitud de permiso</h1>
        <p className="text-xs text-muted-foreground">
          Formato {tramite?.codigo_formato} · versión {tramite?.version_formato} · solicitado el{' '}
          {formatearFechaLarga(aISO(new Date()))}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_19rem] lg:overflow-hidden">
        <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pr-1">
          {/* ------------------------------------------------ Información general */}
          <section className="bloque-datos bloque-azul p-3">
            <h2 className="bloque-titulo mb-2">Información general</h2>
            {/* Cuatro columnas en una sola fila: el selector de jefe directo no
                debe costar una fila entera, o el formato dejaría de caber. */}
            <div className="grid items-end gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label htmlFor="documento">N.° de identificación</Label>
                <Input
                  id="documento"
                  inputMode="numeric"
                  value={documento}
                  onChange={(e) => set('documento', e.target.value)}
                  placeholder="Cédula"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="empresa">Empresa</Label>
                <Select value={empresaId} onValueChange={(v) => set('empresaId', v)}>
                  <SelectTrigger id="empresa">
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas?.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="area">Servicio actual</Label>
                <Select
                  value={areaId}
                  onValueChange={(v) => {
                    set('areaId', v)
                    // Al cambiar de servicio se vuelve a proponer su jefe directo.
                    set('coordinadorId', '')
                  }}
                >
                  <SelectTrigger id="area">
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas?.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cargo">Cargo</Label>
                <Select value={cargoId} onValueChange={(v) => set('cargoId', v)}>
                  <SelectTrigger id="cargo">
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargos?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="coordinador">Jefe directo que autoriza</Label>
                <Select value={coordinadorId} onValueChange={(v) => set('coordinadorId', v)}>
                  <SelectTrigger id="coordinador">
                    <SelectValue placeholder="Selecciona a quién le llega…" />
                  </SelectTrigger>
                  <SelectContent>
                    {coordinadoresDelArea.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Del servicio seleccionado</SelectLabel>
                        {coordinadoresDelArea.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {etiquetaCoordinador(c)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {otrosCoordinadores.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Otros coordinadores</SelectLabel>
                        {otrosCoordinadores.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {etiquetaCoordinador(c)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------- Dos columnas */}
          <div className="grid gap-3 md:grid-cols-2">
            <section className="bloque-datos bloque-violeta p-3">
              <h2 className="bloque-titulo mb-2">Motivo del permiso</h2>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Select
                    value={form.categoriaId}
                    onValueChange={(v) => {
                      set('categoriaId', v)
                      set('tipoId', '')
                    }}
                  >
                    <SelectTrigger id="categoria">
                      <SelectValue placeholder="Selecciona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tipo">Motivo</Label>
                  <Select
                    value={form.tipoId}
                    onValueChange={(v) => {
                      set('tipoId', v)
                      const t = tipos?.find((x) => String(x.id) === v)
                      if (!t) return

                      set('remunerado', t.remunerado_por_defecto)

                      // Cada motivo trae su propia ventana de fechas. Si la que
                      // había queda fuera, se recoloca en vez de dejar un dato
                      // que el propio formulario ya no admite.
                      const rango = rangoFechasPermitido(
                        {
                          diasMaxRetroactivo: t.dias_max_retroactivo,
                          diasMaxFuturo: t.dias_max_futuro,
                        },
                        HOY
                      )
                      if (form.fechaInicio < rango.min || (rango.max && form.fechaInicio > rango.max)) {
                        set('fechaInicio', HOY)
                        set('fechaFin', HOY)
                      }
                    }}
                    disabled={!form.categoriaId}
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue placeholder={form.categoriaId ? 'Selecciona…' : 'Elige primero la categoría'} />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposDeCategoria.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* La norma que respalda el motivo, a la vista: es lo que evita
                    la conversación de «¿y esto por qué me lo piden?». */}
                {tipo?.fundamento_legal && (
                  <p className="rounded-md border border-border bg-card/70 p-2 text-[11px] leading-snug text-muted-foreground">
                    {tipo.fundamento_legal}
                  </p>
                )}

                <ListaDocumentos documentos={docsPrevios} momento="previo" />

                <CampoArchivo
                  archivo={soporte}
                  onCambio={setSoporte}
                  maxMB={Number(config?.max_mb_adjunto ?? 10)}
                  obligatorio={Boolean(soporteExigido?.previo?.obligatorio)}
                />

                {docsPosteriores.length > 0 && (
                  <ListaDocumentos documentos={docsPosteriores} momento="posterior" />
                )}
              </div>
            </section>

            <section className="bloque-datos bloque-teal p-3">
              <h2 className="bloque-titulo mb-2">Tiempos del permiso</h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="desde">Desde</Label>
                  <CampoFecha
                    id="desde"
                    min={rangoFechas.min}
                    max={rangoFechas.max ?? undefined}
                    valor={form.fechaInicio}
                    soloHabiles={!admiteNoHabiles}
                    onCambio={(f) => {
                      set('fechaInicio', f)
                      if (f > form.fechaFin) set('fechaFin', f)
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hasta">Hasta</Label>
                  <CampoFecha
                    id="hasta"
                    min={form.fechaInicio}
                    valor={form.fechaFin}
                    soloHabiles={!admiteNoHabiles}
                    onCambio={(f) => set('fechaFin', f)}
                  />
                </div>
                {/* Preguntar por la hora de salida en una licencia de 18 semanas
                    no significa nada: lo decide el motivo. */}
                {permiteHoras && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="salida">Hora de salida</Label>
                      <Input
                        id="salida"
                        type="time"
                        value={form.horaSalida}
                        onChange={(e) => set('horaSalida', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="regreso">Hora de regreso</Label>
                      <Input
                        id="regreso"
                        type="time"
                        value={form.horaRegreso}
                        onChange={(e) => set('horaRegreso', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{rangoFechas.ayuda}</p>

              {cruces && cruces.cruces.length > 0 && (
                <AvisoCruce cruces={cruces.cruces} className="mt-2.5" />
              )}

              <LineaTiempoPeriodo
                className="mt-3"
                inicio={form.fechaInicio}
                fin={form.fechaFin}
                porCalendario={admiteNoHabiles}
              />

              <div className="mt-2.5 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.remunerado}
                    onCheckedChange={(v) => set('remunerado', v === true)}
                  />
                  Permiso remunerado
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.requiereCompensacion}
                    onCheckedChange={(v) => set('requiereCompensacion', v === true)}
                  />
                  Compensaré el tiempo
                </label>
              </div>
            </section>
          </div>

          {/* -------------------------------------------------- Textos del formato */}
          <div className="grid gap-3 md:grid-cols-2">
            <section className="bloque-datos bloque-ambar p-3">
              <Label htmlFor="justificacion" className="bloque-titulo">
                Justificación del permiso o calamidad
              </Label>
              <Textarea
                id="justificacion"
                className="mt-2 min-h-16"
                value={form.justificacion}
                onChange={(e) => set('justificacion', e.target.value)}
                placeholder="Describe brevemente el motivo…"
              />
            </section>

            <section className="bloque-datos bloque-verde p-3">
              <Label htmlFor="compensacion" className="bloque-titulo">
                Compensación del tiempo
              </Label>
              <Textarea
                id="compensacion"
                className="mt-2 min-h-16"
                value={form.planCompensacion}
                onChange={(e) => set('planCompensacion', e.target.value)}
                placeholder="Cómo y cuándo propones reponer el tiempo…"
                disabled={!form.requiereCompensacion}
              />
            </section>
          </div>
        </div>

        {/* ------------------------------------------------------- Resumen en vivo */}
        <PanelResumen
          filas={[
            { etiqueta: 'Solicitante', valor: perfil?.nombre ?? '—' },
            { etiqueta: 'Documento', valor: documento || '—' },
            { etiqueta: 'Empresa', valor: nombreEmpresa ?? '—' },
            { etiqueta: 'Área', valor: nombreArea ?? '—' },
            { etiqueta: 'Motivo', valor: tipo?.nombre ?? '—' },
            {
              etiqueta: 'Duración',
              valor: `${duracion.horas} h · ${duracion.dias} días`,
              destacado: true,
            },
            { etiqueta: 'Remunerado', valor: form.remunerado ? 'Sí' : 'No' },
            {
              etiqueta: 'Aprueba',
              valor:
                tipo?.ruta_aprobacion === 'gerente_th_directo'
                  ? 'Gerencia de TH'
                  : `${coordinador?.nombre ?? 'Sin jefe directo'} → TH`,
            },
          ]}
          avisos={avisos}
          pie={tramite?.nota_pie}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex shrink-0 items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" cargando={enviando} onClick={() => void guardar(false)}>
          <Save /> Guardar borrador
        </Button>
        <Button type="submit" cargando={enviando}>
          <Send /> Enviar solicitud
        </Button>
      </div>

      <DialogoConfirmarJefe
        abierto={confirmando}
        jefe={coordinador}
        enviando={enviando}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          setConfirmando(false)
          void guardar(true)
        }}
      />

      <DialogoSolicitudEnviada datos={enviada} />
    </form>
  )
}
