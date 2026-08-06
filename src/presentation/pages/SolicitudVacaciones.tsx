import { useMemo, useState } from 'react'
import { Save, Send } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  useAreas,
  useCargos,
  useConfig,
  useCoordinadores,
  etiquetaCoordinador,
  useDocumentos,
  useEmpresas,
  useTramite,
} from '@/application/catalogos/useCatalogos'
import { crearSolicitud, guardarDocumentoPropio, subirSoporte } from '@/application/solicitudes/api'
import {
  calcularVacaciones,
  diasPendientesDeDisfrutar,
  evaluarAntelacionVacaciones,
  validarSaldos,
  VACACIONES_ANTELACION_DIAS,
  VACACIONES_DIAS_MINIMOS,
  VACACIONES_DIAS_MINIMOS_CON_COMPENSADOS,
} from '@/domain/reglas'
import { problemaAlGuardar, validarVacaciones, type Problema } from '@/domain/validacion'
import { aISO, fechaFinPorDiasHabiles } from '@/domain/festivos'
import { formatearFecha, formatearFechaLarga } from '@/lib/utils'
import { PanelResumen, type Aviso } from '@/presentation/components/PanelResumen'
import { CampoArchivo } from '@/presentation/components/CampoArchivo'
import { CampoFecha } from '@/presentation/components/CampoFecha'
import { LineaTiempoPeriodo } from '@/presentation/components/LineaTiempoPeriodo'
import { DialogoConfirmarJefe } from '@/presentation/components/DialogoConfirmarJefe'
import { DialogoProblemas } from '@/presentation/components/DialogoProblemas'
import {
  DialogoSolicitudEnviada,
  type SolicitudEnviada,
} from '@/presentation/components/DialogoSolicitudEnviada'
import { Button } from '@/presentation/components/ui/button'
import { Checkbox } from '@/presentation/components/ui/checkbox'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { Obligatorio } from '@/presentation/components/ui/obligatorio'
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

export default function SolicitudVacaciones() {
  const { perfil } = useAuth()
  const { data: tramite } = useTramite('vacaciones')
  const { data: empresas } = useEmpresas()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: coordinadores } = useCoordinadores()
  const { data: config } = useConfig()
  const { data: documentos } = useDocumentos()

  const periodoCompleto = Number(config?.dias_vacaciones_periodo_completo ?? 15)

  // Se busca por código y no por nombre: Talento Humano puede renombrar el
  // documento desde Administración sin que esta pantalla deje de encontrarlo.
  const docCartaCompensados = useMemo(
    () => documentos?.find((d) => d.codigo === 'carta_dias_compensados'),
    [documentos]
  )

  const [form, setForm] = useState({
    empresaId: '',
    areaId: '',
    cargoId: '',
    /** Vacío = se propone el del área. El colaborador puede cambiarlo. */
    coordinadorId: '',
    /** Vacío = se toma el del perfil; si el perfil no lo tiene, se pide aquí. */
    documento: '',
    diasCorresponden: '',
    diasADisfrutar: '',
    /** Parte del periodo que se paga en dinero en vez de disfrutarse. */
    compensaDias: false,
    diasCompensados: '',
    fechaInicio: HOY,
    /** Vacío = la app calcula la fecha final desde los días a disfrutar. */
    fechaFinManual: '',
    reintegroManual: '',
    observaciones: '',
    declaracion: false,
  })
  /** La carta firmada que justifica los días compensados. */
  const [cartaCompensados, setCartaCompensados] = useState<File[]>([])
  /** Lo que impide enviar. Se muestra en modal, con la causa y su motivo. */
  const [problemas, setProblemas] = useState<Problema[]>([])
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState<SolicitudEnviada | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const empresaId = form.empresaId || (perfil?.empresa_id ? String(perfil.empresa_id) : '')
  const areaId = form.areaId || (perfil?.area_id ? String(perfil.area_id) : '')
  const cargoId = form.cargoId || (perfil?.cargo_id ? String(perfil.cargo_id) : '')
  const documento = form.documento || perfil?.documento || ''

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  /**
   * Jefe directo que autorizará. Igual que en permisos, se elige de forma
   * explícita: si el colaborador cambió de servicio, el dato del perfil está
   * desactualizado y la solicitud caería en la bandeja equivocada.
   */
  const coordinadorPropuesto = useMemo(() => {
    const delArea = coordinadores?.find((c) => String(c.area_id) === areaId)
    if (delArea) return delArea
    return coordinadores?.find((c) => c.id === perfil?.coordinador_id)
  }, [coordinadores, perfil, areaId])

  const coordinadorId = form.coordinadorId || (coordinadorPropuesto ? String(coordinadorPropuesto.id) : '')
  const coordinador = coordinadores?.find((c) => String(c.id) === coordinadorId)

  const coordinadoresDelArea = useMemo(
    () => coordinadores?.filter((c) => String(c.area_id) === areaId) ?? [],
    [coordinadores, areaId]
  )
  const otrosCoordinadores = useMemo(
    () => coordinadores?.filter((c) => String(c.area_id) !== areaId) ?? [],
    [coordinadores, areaId]
  )

  const aDisfrutar = form.diasADisfrutar === '' ? null : Number(form.diasADisfrutar)
  const corresponden = form.diasCorresponden === '' ? null : Number(form.diasCorresponden)

  /**
   * Los compensados solo cuentan con la casilla marcada.
   *
   * Sin esta comprobación, desmarcarla dejaba el número escrito y la solicitud
   * salía con días compensados que el colaborador ya había descartado.
   */
  const compensados = form.compensaDias
    ? form.diasCompensados === ''
      ? null
      : Number(form.diasCompensados)
    : 0

  /**
   * Los días pendientes ya no se escriben: se calculan.
   *
   * Era el campo que más se equivocaba, porque pedía hacer una resta a mano y
   * el resultado tenía que cuadrar con los otros dos o la solicitud salía
   * incoherente.
   */
  const diasPendientes = useMemo(
    () =>
      diasPendientesDeDisfrutar({
        diasCorresponden: corresponden,
        diasADisfrutar: aDisfrutar,
        diasCompensados: compensados,
      }),
    [corresponden, aDisfrutar, compensados]
  )

  /**
   * La fecha final la calcula la app a partir de los días hábiles a disfrutar,
   * saltando fines de semana y festivos colombianos. El colaborador puede
   * sobrescribirla si su caso no encaja con el cálculo.
   */
  const fechaFinCalculada = useMemo(
    () =>
      aDisfrutar && aDisfrutar > 0
        ? fechaFinPorDiasHabiles(form.fechaInicio, Math.round(aDisfrutar))
        : null,
    [form.fechaInicio, aDisfrutar]
  )

  const fechaFin = form.fechaFinManual || fechaFinCalculada || form.fechaInicio
  const fechaFinEsManual = Boolean(form.fechaFinManual)

  const calculo = useMemo(
    () =>
      calcularVacaciones({
        fechaInicio: form.fechaInicio,
        fechaFin,
        diasADisfrutar: aDisfrutar,
      }),
    [form.fechaInicio, fechaFin, aDisfrutar]
  )

  const saldos = useMemo(
    () =>
      validarSaldos({
        diasCorresponden: corresponden,
        // Los compensados se cuentan del lado de lo consumido: si no, la
        // comprobación de coherencia dispararía siempre que se compense algo.
        diasADisfrutar: aDisfrutar == null ? null : aDisfrutar + (compensados ?? 0),
        diasPendientes,
      }),
    [corresponden, aDisfrutar, compensados, diasPendientes]
  )

  /**
   * Antelación de vacaciones: 20 días **corridos** y bloquea el envío.
   *
   * No usa `evaluarAntelacion`, que es la de permisos: aquella lee la
   * configuración del trámite, se mide en horas o días hábiles y solo advierte.
   */
  const antelacion = useMemo(
    () => evaluarAntelacionVacaciones({ fechaInicio: form.fechaInicio, hoy: HOY }),
    [form.fechaInicio]
  )

  const reintegro = form.reintegroManual || calculo.fechaReintegro

  const avisos = useMemo(() => {
    const lista: Aviso[] = []

    // El aviso sale mientras se llena, no solo al intentar enviar: enterarse de
    // los 20 días al final obliga a rehacer las fechas.
    if (!antelacion.cumple) {
      lista.push({
        tono: 'advertencia',
        texto:
          antelacion.diasDeAntelacion < 0
            ? 'La fecha de inicio ya pasó.'
            : `Faltan ${antelacion.diasDeAntelacion} días para el inicio y se exigen ${VACACIONES_ANTELACION_DIAS} corridos. La primera fecha posible radicando hoy es el ${formatearFechaLarga(antelacion.primeraValida)}.`,
      })
    }
    if (calculo.advertencia) lista.push({ tono: 'advertencia', texto: calculo.advertencia })
    if (saldos.advertencia) lista.push({ tono: 'advertencia', texto: saldos.advertencia })

    if (!fechaFinEsManual && fechaFinCalculada) {
      lista.push({
        tono: 'exito',
        texto: `Con ${aDisfrutar} días hábiles desde el inicio, el periodo termina el ${formatearFechaLarga(fechaFinCalculada)} y te presentas a laborar el ${formatearFechaLarga(calculo.fechaReintegro)}.`,
      })
    }
    if (fechaFinEsManual && fechaFinCalculada && form.fechaFinManual !== fechaFinCalculada) {
      lista.push({
        tono: 'advertencia',
        texto: `Ajustaste la fecha final a mano. Por días hábiles correspondería el ${formatearFechaLarga(fechaFinCalculada)}.`,
      })
    }

    if (!coordinador) {
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

    lista.push({
      tono: 'info',
      texto: 'Talento Humano validará los saldos contra nómina antes de aprobar.',
    })
    return lista
  }, [antelacion, calculo, saldos, fechaFinEsManual, fechaFinCalculada, form.fechaFinManual, aDisfrutar, coordinador, perfil, areaId])

  /**
   * Revisa la solicitud y muestra lo que falte.
   *
   * Corre antes de pedir la confirmación del jefe: encadenar dos modales haría
   * que el colaborador confirmara un envío que la validación va a detener.
   */
  function hayProblemas(): boolean {
    const encontrados = validarVacaciones({
      documento,
      empresaId,
      areaId,
      cargoId,
      diasADisfrutar: aDisfrutar,
      declaracionAceptada: form.declaracion,
      tieneCoordinador: Boolean(coordinador),
      antelacion,
      diasCompensados: compensados,
      tieneCartaCompensados: cartaCompensados.length > 0,
    })

    setProblemas(encontrados)
    return encontrados.length > 0
  }

  async function guardar(enviar: boolean) {
    setProblemas([])
    if (!perfil || !tramite) return

    // El borrador se guarda como esté: es un apunte a medias por definición.
    if (enviar && hayProblemas()) return

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
          fecha_fin: fechaFin,
          observaciones: form.observaciones.trim() || null,
          // Enviar sin los 20 días está bloqueado, así que en la práctica solo
          // llega marcada desde un borrador guardado antes de corregir la fecha.
          extemporanea: !antelacion.cumple,
        },
        enviar,
        rutaAprobacion: 'coordinador_th',
        detalleVacaciones: {
          dias_corresponden: corresponden,
          dias_a_disfrutar: aDisfrutar,
          dias_pendientes: diasPendientes,
          dias_compensados: compensados ?? 0,
          fecha_reintegro: reintegro,
          dias_habiles_calculados: calculo.diasHabiles,
          declaracion_aceptada: form.declaracion,
          fecha_constancia: aISO(new Date()),
        },
      })

      // Después de crear la solicitud, porque la ruta del archivo se arma con
      // su identificador y la policy de Storage resuelve el permiso por ahí.
      for (const archivo of cartaCompensados) {
        await subirSoporte({
          solicitudId: id,
          archivo,
          momento: 'previo',
          usuarioId: perfil.user_id,
          maxMB: Number(config?.max_mb_adjunto ?? 10),
          documentoId: docCartaCompensados?.id ?? null,
        })
      }

      setEnviada({
        id,
        consecutivo,
        siguiente: enviar
          ? `Queda en la bandeja de ${coordinador?.nombre ?? 'tu jefe directo'} para su autorización.`
          : 'Puedes retomarla cuando quieras desde Mis solicitudes.',
        filas: [
          {
            etiqueta: 'Periodo',
            valor: `${formatearFecha(form.fechaInicio)} → ${formatearFecha(fechaFin)}`,
          },
          { etiqueta: 'Días a disfrutar', valor: aDisfrutar },
          { etiqueta: 'Se presenta a laborar', valor: formatearFecha(reintegro) },
          { etiqueta: 'Jefe directo', valor: coordinador?.nombre ?? 'Sin asignar' },
        ],
      })
    } catch (err) {
      setProblemas([problemaAlGuardar(err)])
    } finally {
      setEnviando(false)
    }
  }

  const nombreArea = areas?.find((a) => String(a.id) === areaId)?.nombre
  const nombreEmpresa = empresas?.find((e) => String(e.id) === empresaId)?.nombre

  return (
    // Altura fija y scroll por dentro, igual que en permisos: la ventana no
    // scrollea en escritorio y sin esto los botones de enviar quedaban fuera.
    <form
      className="mx-auto flex max-w-7xl flex-col gap-3 lg:h-full lg:overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault()
        // Primero lo que falta; después la confirmación del jefe.
        if (hayProblemas()) return
        // Se confirma el jefe antes de grabar: el aviso sale por correo y
        // corregirlo despues implica cancelar y rehacer la solicitud.
        setConfirmando(true)
      }}
    >
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3">
        <h1 className="text-lg font-semibold tracking-tight">Solicitud de vacaciones</h1>
        <p className="text-xs text-muted-foreground">
          Formato {tramite?.codigo_formato} · versión {tramite?.version_formato} · solicitado el{' '}
          {formatearFechaLarga(aISO(new Date()))}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_19rem] lg:overflow-hidden">
        <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pr-1">
          <section className="bloque-datos bloque-azul p-3">
            <h2 className="bloque-titulo mb-2">Información general</h2>
            {/* Cuatro columnas en una sola fila: el selector de jefe directo no
                debe costar una fila entera, o el formato dejaría de caber. */}
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
                <Label htmlFor="empresa">Empresa<Obligatorio /></Label>
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
                <Label htmlFor="area">Servicio actual<Obligatorio /></Label>
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
                <Label htmlFor="cargo">Cargo<Obligatorio /></Label>
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
                <Label htmlFor="coordinador">Jefe directo que autoriza<Obligatorio /></Label>
                <Select value={coordinadorId} onValueChange={(v) => set('coordinadorId', v)}>
                  <SelectTrigger id="coordinador">
                    <SelectValue placeholder="Selecciona a quién le llega…" />
                  </SelectTrigger>
                  <SelectContent>
                    {coordinadoresDelArea.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Del servicio seleccionado</SelectLabel>
                        {coordinadoresDelArea.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{etiquetaCoordinador(c)}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {otrosCoordinadores.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Otros coordinadores</SelectLabel>
                        {otrosCoordinadores.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{etiquetaCoordinador(c)}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="bloque-datos bloque-teal p-3">
            <h2 className="bloque-titulo mb-2">Periodo a disfrutar</h2>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="corresponden">Días que corresponden</Label>
                <Input
                  id="corresponden"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.diasCorresponden}
                  onChange={(e) => set('diasCorresponden', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="disfrutar">Días a disfrutar<Obligatorio /></Label>
                <Input
                  id="disfrutar"
                  type="number"
                  min={0}
                  step={1}
                  value={form.diasADisfrutar}
                  onChange={(e) => {
                    set('diasADisfrutar', e.target.value)
                    set('fechaFinManual', '') // Vuelve al cálculo automático.
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    set('diasADisfrutar', String(periodoCompleto))
                    set('fechaFinManual', '')
                  }}
                  className="text-xs font-medium text-[var(--cac-azul-contraste)] underline-offset-2 hover:underline dark:text-[var(--cac-azul-300)]"
                >
                  Tomar el periodo completo ({periodoCompleto} días hábiles)
                </button>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pendientes">Días pendientes</Label>
                <Input
                  id="pendientes"
                  readOnly
                  tabIndex={-1}
                  className="bg-muted/60"
                  value={diasPendientes ?? '—'}
                />
                <p className="text-xs text-muted-foreground">
                  {corresponden == null
                    ? 'Indica los días que corresponden y lo calculo.'
                    : `${corresponden} − ${aDisfrutar ?? 0}${compensados ? ` − ${compensados}` : ''} = ${diasPendientes}`}
                </p>
              </div>
            </div>

            {/* -------------------------------------------- Días compensados */}
            <div className="mt-2.5 rounded-md border border-border p-2.5">
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={form.compensaDias}
                  onCheckedChange={(v) => {
                    set('compensaDias', v === true)
                    if (v !== true) {
                      set('diasCompensados', '')
                      setCartaCompensados([])
                    }
                  }}
                />
                <span>
                  Quiero compensar parte del periodo en dinero
                  <span className="block text-xs text-muted-foreground">
                    El descanso efectivo no puede bajar de{' '}
                    {VACACIONES_DIAS_MINIMOS_CON_COMPENSADOS} días y hay que adjuntar la carta
                    firmada.
                  </span>
                </span>
              </label>

              {form.compensaDias && (
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="compensados">Días a compensar<Obligatorio /></Label>
                    <Input
                      id="compensados"
                      type="number"
                      min={1}
                      step={1}
                      value={form.diasCompensados}
                      onChange={(e) => set('diasCompensados', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="carta">Carta firmada<Obligatorio /></Label>
                    <CampoArchivo
                      id="carta"
                      archivos={cartaCompensados}
                      onCambio={setCartaCompensados}
                      obligatorio
                      max={2}
                      maxMB={Number(config?.max_mb_adjunto ?? 10)}
                    />
                  </div>
                </div>
              )}
            </div>

            <p className="mt-1.5 text-xs text-muted-foreground">
              Estos saldos los verifica Talento Humano contra nómina. El periodo no puede bajar de{' '}
              {VACACIONES_DIAS_MINIMOS} días hábiles.
            </p>

            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="inicio">Fecha de inicio</Label>
                {/* El selector arranca ya en la primera fecha válida: es más
                    barato no dejar elegir mal que explicar después por qué no
                    se puede enviar. */}
                <CampoFecha
                  id="inicio"
                  min={antelacion.primeraValida}
                  valor={form.fechaInicio}
                  onCambio={(f) => {
                    set('fechaInicio', f)
                    set('fechaFinManual', '')
                    set('reintegroManual', '')
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Se radica con {VACACIONES_ANTELACION_DIAS} días corridos de antelación.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fin">Fecha de fin</Label>
                <Input
                  id="fin"
                  type="date"
                  min={form.fechaInicio}
                  value={fechaFin}
                  onChange={(e) => set('fechaFinManual', e.target.value)}
                />
                {fechaFinEsManual ? (
                  <button
                    type="button"
                    onClick={() => set('fechaFinManual', '')}
                    className="text-xs font-medium text-[var(--cac-azul-contraste)] underline-offset-2 hover:underline dark:text-[var(--cac-azul-300)]"
                  >
                    Volver al cálculo automático
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {fechaFinCalculada
                      ? 'Calculada por días hábiles; puedes ajustarla.'
                      : 'Indica los días a disfrutar y la calculo.'}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="reintegro">Se presenta a laborar</Label>
                <CampoFecha
                  id="reintegro"
                  valor={reintegro}
                  onCambio={(f) => set('reintegroManual', f)}
                />
                <p className="text-xs text-muted-foreground">Calculada; puedes ajustarla.</p>
              </div>
            </div>

            <LineaTiempoPeriodo
              className="mt-2.5"
              compacto
              inicio={form.fechaInicio}
              fin={fechaFin}
              reintegro={reintegro}
            />
          </section>

          {/* En paralelo y no apilados: es lo que permite que el formato quepa
              sin scroll en un portátil de 768 px de alto. */}
          <div className="grid gap-3 md:grid-cols-2">
            <section className="bloque-datos bloque-ambar p-3">
              <Label htmlFor="observaciones" className="bloque-titulo">
                Observaciones
              </Label>
              <Textarea
                id="observaciones"
                className="mt-2 min-h-16"
                value={form.observaciones}
                onChange={(e) => set('observaciones', e.target.value)}
                placeholder="Por ejemplo: días pendientes del periodo anterior…"
              />
            </section>

            <section className="bloque-datos bloque-violeta p-3">
              <p className="bloque-titulo mb-2">Declaración de conformidad</p>
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={form.declaracion}
                  onCheckedChange={(v) => set('declaracion', v === true)}
                />
                <span>
                  Expreso mi conformidad de solicitar y gozar mis vacaciones de acuerdo con lo
                  estipulado en el Código Sustantivo del Trabajo.
                </span>
              </label>
            </section>
          </div>
        </div>

        <PanelResumen
          filas={[
            { etiqueta: 'Solicitante', valor: perfil?.nombre ?? '—' },
            { etiqueta: 'Documento', valor: documento || '—' },
            { etiqueta: 'Empresa', valor: nombreEmpresa ?? '—' },
            { etiqueta: 'Servicio', valor: nombreArea ?? '—' },
            {
              etiqueta: 'Periodo',
              valor: `${formatearFechaLarga(form.fechaInicio)} → ${formatearFechaLarga(fechaFin)}`,
            },
            { etiqueta: 'Días hábiles', valor: calculo.diasHabiles, destacado: true },
            { etiqueta: 'Días calendario', valor: calculo.diasCalendario },
            { etiqueta: 'Reintegro', valor: formatearFechaLarga(reintegro), destacado: true },
            {
              etiqueta: 'Aprueba',
              valor: `${coordinador?.nombre ?? 'Sin jefe directo'} → Dirección de TH`,
            },
          ]}
          avisos={avisos}
          pie={tramite?.nota_pie}
        />
      </div>

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

      <DialogoProblemas problemas={problemas} onCerrar={() => setProblemas([])} />

      <DialogoSolicitudEnviada datos={enviada} />
    </form>
  )
}
