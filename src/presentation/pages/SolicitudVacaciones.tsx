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
  primeraFechaDeInicioValida,
  validarSaldos,
  VACACIONES_ANTELACION_DIAS,
  VACACIONES_DIAS_MINIMOS,
  VACACIONES_DIAS_MINIMOS_CON_COMPENSADOS,
} from '@/domain/reglas'
import {
  problemaAlGuardar,
  validarVacaciones,
  VACACIONES_COMPENSAR_DIAS_A_DISFRUTAR,
  VACACIONES_DIAS_CORRESPONDEN_MAXIMO,
  type Problema,
} from '@/domain/validacion'
import { aISO, fechaFinPorDiasHabiles } from '@/domain/festivos'
import { cn, formatearFecha, formatearFechaLarga } from '@/lib/utils'
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

const HOY = new Date().toISOString().slice(0, 10)
/**
 * Valor inicial del formulario: hoy + 20 días corridos.
 *
 * Tiene que coincidir con la regla que bloquea el envío
 * (`VACACIONES_ANTELACION_DIAS`, 20 días **corridos**, `evaluarAntelacionVacaciones`
 * más abajo). Proponer un valor calculado en días hábiles adelantaba la fecha
 * más de lo necesario y no correspondía con el mínimo real.
 */
const FECHA_INICIO_DEFECTO = primeraFechaDeInicioValida(HOY)

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
    /** Vacío = se toma el del perfil; si el perfil no lo tiene, se pide aquí. */
    documento: '',
    diasCorresponden: '',
    diasADisfrutar: '',
    /** Parte del periodo que se paga en dinero en vez de disfrutarse. */
    compensaDias: false,
    diasCompensados: '',
    fechaInicio: FECHA_INICIO_DEFECTO,
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

  // Empresa, servicio y cargo ya no se piden: nacen del perfil, igual que en
  // la solicitud de permiso.
  const empresaId = perfil?.empresa_id ? String(perfil.empresa_id) : ''
  const areaId = perfil?.area_id ? String(perfil.area_id) : ''
  const cargoId = perfil?.cargo_id ? String(perfil.cargo_id) : ''
  const documento = form.documento || perfil?.documento || ''
  const perfilIncompleto = !empresaId || !areaId || !cargoId

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  /**
   * Jefe directo que autoriza. Se toma del jefe del servicio del perfil, no
   * de `perfil.coordinador_id` directamente, para no depender de que cada
   * perfil se actualice cuando cambia el jefe de un área.
   */
  const coordinador = useMemo(() => {
    const delArea = coordinadores?.find((c) => String(c.area_id) === areaId)
    if (delArea) return delArea
    return coordinadores?.find((c) => c.id === perfil?.coordinador_id)
  }, [coordinadores, perfil, areaId])

  /** Un cargo asistencial se reintegra al día calendario siguiente. */
  const cargoEsAsistencial = cargos?.find((c) => String(c.id) === cargoId)?.tipo === 'asistencial'

  const aDisfrutar = form.diasADisfrutar === '' ? null : Number(form.diasADisfrutar)
  const corresponden = form.diasCorresponden === '' ? null : Number(form.diasCorresponden)

  /** Compensar en dinero solo se admite sobre exactamente 8 días a disfrutar. */
  const puedeCompensar = aDisfrutar === VACACIONES_COMPENSAR_DIAS_A_DISFRUTAR

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
        cargoEsAsistencial,
      }),
    [form.fechaInicio, fechaFin, aDisfrutar, cargoEsAsistencial]
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

    // Se avisa apenas se digita, no solo al enviar: igual que con la
    // antelación, enterarse del tope al final obliga a corregir dos veces.
    if (corresponden != null && corresponden > VACACIONES_DIAS_CORRESPONDEN_MAXIMO) {
      lista.push({
        tono: 'advertencia',
        texto: `El máximo por solicitud son ${VACACIONES_DIAS_CORRESPONDEN_MAXIMO} días que corresponden; registraste ${corresponden}. No vas a poder enviarla así.`,
      })
    }

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
        texto: perfilIncompleto
          ? 'Tu perfil todavía no tiene servicio o cargo asignado: contacta a Talento Humano antes de solicitar.'
          : 'Tu servicio no tiene jefe directo asignado en el catálogo. Contacta a Talento Humano.',
      })
    }

    lista.push({
      tono: 'info',
      texto: 'Talento Humano validará los saldos contra nómina antes de aprobar.',
    })
    return lista
  }, [
    corresponden,
    antelacion,
    calculo,
    saldos,
    fechaFinEsManual,
    fechaFinCalculada,
    form.fechaFinManual,
    aDisfrutar,
    coordinador,
    perfilIncompleto,
  ])

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
      diasCorresponden: corresponden,
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
      className="mx-auto flex max-w-7xl flex-col gap-3 md:h-full md:overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault()
        // Primero lo que falta; después la confirmación del jefe.
        if (hayProblemas()) return
        // Se confirma el jefe antes de grabar: el aviso sale por correo y
        // corregirlo despues implica cancelar y rehacer la solicitud.
        setConfirmando(true)
      }}
    >
      <header className="franja-institucional flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 rounded-xl px-3 py-2">
        <h1 className="text-lg font-semibold tracking-tight text-white">Solicitud de vacaciones</h1>
        <p className="text-xs text-white/70">
          Formato {tramite?.codigo_formato} · versión {tramite?.version_formato} · solicitado el{' '}
          {formatearFechaLarga(aISO(new Date()))}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[1fr_19rem] md:overflow-hidden">
        <div className="min-h-0 space-y-3 md:overflow-y-auto md:pr-1">
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

              {/* Empresa, servicio, cargo y jefe directo ya no se eligen aquí:
                  vienen del perfil, igual que en la solicitud de permiso. */}
              <div className="space-y-1">
                <Label>Empresa</Label>
                <p className="flex h-9 items-center rounded-md border border-input bg-muted/60 px-3 text-sm">
                  {empresas?.find((e) => String(e.id) === empresaId)?.nombre ?? 'Sin asignar'}
                </p>
              </div>
              <div className="space-y-1">
                <Label>Servicio actual</Label>
                <p className="flex h-9 items-center rounded-md border border-input bg-muted/60 px-3 text-sm">
                  {areas?.find((a) => String(a.id) === areaId)?.nombre ?? 'Sin asignar'}
                </p>
              </div>
              <div className="space-y-1">
                <Label>Cargo</Label>
                <p className="flex h-9 items-center rounded-md border border-input bg-muted/60 px-3 text-sm">
                  {cargos?.find((c) => String(c.id) === cargoId)?.nombre ?? 'Sin asignar'}
                </p>
              </div>

              <div className="space-y-1">
                <Label>Jefe directo que autoriza</Label>
                <p className="flex h-9 items-center rounded-md border border-input bg-muted/60 px-3 text-sm">
                  {coordinador ? etiquetaCoordinador(coordinador) : 'Sin asignar'}
                </p>
              </div>
            </div>

            {perfilIncompleto && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Tu perfil no tiene empresa, servicio o cargo asignado. Contacta a Talento Humano
                antes de enviar la solicitud.
              </p>
            )}
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
              <label
                className={cn(
                  'flex items-start gap-2.5 text-sm',
                  !puedeCompensar && !form.compensaDias && 'opacity-60'
                )}
              >
                <Checkbox
                  className="mt-0.5"
                  checked={form.compensaDias}
                  disabled={!puedeCompensar && !form.compensaDias}
                  onCheckedChange={(v) => {
                    set('compensaDias', v === true)
                    if (v === true) {
                      // Compensar solo se admite sobre 8 días a disfrutar
                      // (VACACIONES_COMPENSAR_DIAS_A_DISFRUTAR): activar el
                      // chulito fija el campo en ese valor.
                      set('diasADisfrutar', String(VACACIONES_COMPENSAR_DIAS_A_DISFRUTAR))
                      set('fechaFinManual', '')
                    } else {
                      set('diasCompensados', '')
                      setCartaCompensados([])
                    }
                  }}
                />
                <span>
                  Quiero compensar parte del periodo en dinero
                  <span className="block text-xs text-muted-foreground">
                    {puedeCompensar || form.compensaDias
                      ? `El descanso efectivo no puede bajar de ${VACACIONES_DIAS_MINIMOS_CON_COMPENSADOS} días y hay que adjuntar la carta firmada.`
                      : `Solo se puede compensar cuando los días a disfrutar son exactamente ${VACACIONES_COMPENSAR_DIAS_A_DISFRUTAR}.`}
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
