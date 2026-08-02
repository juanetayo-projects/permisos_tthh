import { useMemo, useState } from 'react'
import { PiggyBank, Save, Send } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  documentosDelTipo,
  useAreas,
  useCargos,
  useConfig,
  useEmpresas,
  useMatrizDocumentos,
  useTipos,
  useTramite,
} from '@/application/catalogos/useCatalogos'
import { crearSolicitud, guardarDocumentoPropio, subirSoporte } from '@/application/solicitudes/api'
import { documentosDelMomento } from '@/domain/soportes'
import { problemaAlGuardar, validarCesantias, type Problema } from '@/domain/validacion'
import { aISO } from '@/domain/festivos'
import { formatearFechaLarga, formatearMoneda } from '@/lib/utils'
import { PanelResumen, type Aviso } from '@/presentation/components/PanelResumen'
import { CampoArchivo } from '@/presentation/components/CampoArchivo'
import { CampoMoneda } from '@/presentation/components/CampoMoneda'
import { DialogoProblemas } from '@/presentation/components/DialogoProblemas'
import { ListaDocumentos } from '@/presentation/components/ListaDocumentos'
import {
  DialogoSolicitudEnviada,
  type SolicitudEnviada,
} from '@/presentation/components/DialogoSolicitudEnviada'
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

/** Destinos que admite el retiro parcial (art. 102 CST · Ley 1071 de 2006). */
const DESTINOS = [
  { valor: 'vivienda_compra', etiqueta: 'Compra de vivienda' },
  { valor: 'vivienda_construccion', etiqueta: 'Construcción de vivienda' },
  { valor: 'vivienda_mejora', etiqueta: 'Mejora o remodelación de vivienda' },
  { valor: 'vivienda_liberacion', etiqueta: 'Liberación de gravamen hipotecario' },
  { valor: 'vivienda_impuestos', etiqueta: 'Pago de impuestos de la vivienda' },
  { valor: 'educacion_trabajador', etiqueta: 'Educación del trabajador' },
  { valor: 'educacion_familiar', etiqueta: 'Educación del cónyuge o de los hijos' },
] as const

/**
 * Solicitud de retiro parcial de cesantías.
 *
 * Tiene pantalla propia, como las vacaciones, porque **no es un permiso**. Se
 * tramitaba en el formulario de permisos y eso obligaba al colaborador a
 * responder cosas que aquí no significan nada: fecha de inicio, fecha de fin,
 * hora de salida y hora de regreso. Encima el formulario advertía que «faltan
 * 21 horas para el inicio y el formato exige 48», cuando un retiro de cesantías
 * no tiene inicio ni antelación que cumplir.
 *
 * Lo que sí importa es el destino y sus soportes: el art. 102 CST y la Ley 1071
 * de 2006 solo admiten vivienda y educación, y la Gerencia de Talento Humano
 * tiene que verificarlo antes de tramitarlo ante la administradora.
 *
 * Va directo a la Gerencia de TH —no pasa por el jefe directo—, así que esta
 * pantalla tampoco pide jefe autorizador.
 */
export default function SolicitudCesantias() {
  const { perfil, session } = useAuth()
  const { data: tramite } = useTramite('cesantias')
  const { data: empresas } = useEmpresas()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: tipos } = useTipos()
  const { data: matriz } = useMatrizDocumentos()
  const { data: config } = useConfig()

  const [form, setForm] = useState({
    empresaId: '',
    areaId: '',
    cargoId: '',
    documento: '',
    destino: '',
    monto: '',
    justificacion: '',
  })
  const [soporte, setSoporte] = useState<File | null>(null)
  /** Lo que impide enviar. Se muestra en modal, con la causa y su motivo. */
  const [problemas, setProblemas] = useState<Problema[]>([])
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState<SolicitudEnviada | null>(null)

  const empresaId = form.empresaId || (perfil?.empresa_id ? String(perfil.empresa_id) : '')
  const areaId = form.areaId || (perfil?.area_id ? String(perfil.area_id) : '')
  const cargoId = form.cargoId || (perfil?.cargo_id ? String(perfil.cargo_id) : '')
  const documento = form.documento || perfil?.documento || ''

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  /**
   * El motivo sigue viviendo en el catálogo, no en el código.
   *
   * Se busca por naturaleza y no por nombre para que Talento Humano pueda
   * renombrarlo desde Administración sin que esta pantalla deje de encontrarlo.
   */
  const tipo = useMemo(() => tipos?.find((t) => t.naturaleza === 'tramite'), [tipos])

  const docsDelTipo = useMemo(() => documentosDelTipo(matriz, tipo?.id), [matriz, tipo])
  const docsPrevios = useMemo(
    () => documentosDelMomento({ matriz: docsDelTipo, momento: 'previo', diasPermiso: 0 }),
    [docsDelTipo]
  )
  const documentoDelAdjunto = docsPrevios.find((d) => d.obligatorio) ?? docsPrevios[0] ?? null

  const avisos = useMemo(() => {
    const lista: Aviso[] = [
      {
        tono: 'info',
        texto:
          'Este trámite va directo a la Gerencia de Talento Humano y no cuenta como ausencia: no descuenta tiempo ni aparece en tu ausentismo.',
      },
    ]

    if (docsPrevios.some((d) => d.obligatorio)) {
      lista.push({
        tono: 'advertencia',
        texto:
          'Adjunta el soporte de la destinación. Sin él, la Gerencia no puede verificar que el retiro va a vivienda o educación.',
      })
    }
    if (!form.destino) {
      lista.push({ tono: 'advertencia', texto: 'Indica a qué vas a destinar el retiro.' })
    }
    return lista
  }, [docsPrevios, form.destino])

  async function guardar(enviar: boolean) {
    setProblemas([])
    if (!perfil || !session || !tramite) return

    // El borrador se guarda como esté: es un apunte a medias por definición.
    if (enviar) {
      const encontrados = validarCesantias({
        documento,
        empresaId,
        areaId,
        cargoId,
        destino: form.destino,
        tieneSoporte: Boolean(soporte),
      })

      if (encontrados.length > 0) {
        setProblemas(encontrados)
        return
      }
    }

    setEnviando(true)
    try {
      if (documento.trim() && documento.trim() !== perfil.documento) {
        await guardarDocumentoPropio(perfil.user_id, documento)
      }

      const destino = DESTINOS.find((d) => d.valor === form.destino)?.etiqueta ?? form.destino

      const { id, consecutivo } = await crearSolicitud({
        base: {
          tramite_id: tramite.id,
          solicitante_id: perfil.user_id,
          empresa_id: empresaId ? Number(empresaId) : null,
          area_id: areaId ? Number(areaId) : null,
          cargo_id: cargoId ? Number(cargoId) : null,
          // Va directo a la Gerencia: no hay jefe directo que autorice.
          coordinador_id: null,
          // Un trámite no tiene periodo. Las fechas guardan el día de la
          // radicación, que es lo único que significan aquí.
          fecha_inicio: HOY,
          fecha_fin: HOY,
          extemporanea: false,
        },
        enviar,
        rutaAprobacion: 'gerente_th_directo',
        detallePermiso: {
          categoria_id: tipo?.categoria_id ?? null,
          tipo_id: tipo?.id ?? null,
          horas_permiso: 0,
          dias_permiso: 0,
          remunerado: true,
          requiere_compensacion: false,
          // La destinación y el monto son lo que revisa la Gerencia, así que
          // encabezan la justificación en vez de esconderse en un campo aparte.
          justificacion: [
            `Destinación: ${destino}.`,
            form.monto ? `Monto solicitado: ${formatearMoneda(Number(form.monto))}.` : null,
            form.justificacion.trim() || null,
          ]
            .filter(Boolean)
            .join(' '),
          requiere_soporte_posterior: false,
          fecha_limite_soporte: null,
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
        siguiente: enviar
          ? 'Queda en la bandeja de la Gerencia de Talento Humano para su verificación.'
          : 'Puedes retomarla cuando quieras desde Mis solicitudes.',
        filas: [
          { etiqueta: 'Destinación', valor: destino },
          { etiqueta: 'Monto', valor: form.monto ? formatearMoneda(Number(form.monto)) : 'Sin indicar' },
          { etiqueta: 'Soporte adjunto', valor: soporte ? soporte.name : 'Ninguno' },
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
  const nombreDestino = DESTINOS.find((d) => d.valor === form.destino)?.etiqueta

  return (
    // Altura fija y scroll por dentro: la ventana no se mueve y los botones de
    // enviar quedan siempre a la vista, aunque el formulario no quepa entero.
    <form
      className="mx-auto flex max-w-7xl flex-col gap-3 lg:h-full lg:overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault()
        void guardar(true)
      }}
    >
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <PiggyBank className="size-5 text-[var(--acento-ambar)]" />
          Solicitud de retiro parcial de cesantías
        </h1>
        <p className="text-xs text-muted-foreground">
          Formato {tramite?.codigo_formato} · versión {tramite?.version_formato} · solicitado el{' '}
          {formatearFechaLarga(aISO(new Date()))}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_19rem] lg:overflow-hidden">
        <div className="min-h-0 space-y-3 lg:overflow-y-auto lg:pr-1">
          <section className="bloque-datos bloque-azul p-3">
            <h2 className="bloque-titulo mb-2">Información general</h2>
            <div className="grid items-end gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
                <Select value={areaId} onValueChange={(v) => set('areaId', v)}>
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
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="bloque-datos bloque-ambar p-3">
              <h2 className="bloque-titulo mb-2">Destinación del retiro</h2>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <Label htmlFor="destino">¿A qué vas a destinarlo?<Obligatorio /></Label>
                  <Select value={form.destino} onValueChange={(v) => set('destino', v)}>
                    <SelectTrigger id="destino">
                      <SelectValue placeholder="Selecciona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {DESTINOS.map((d) => (
                        <SelectItem key={d.valor} value={d.valor}>
                          {d.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    El art. 102 CST y la Ley 1071 de 2006 solo admiten vivienda y educación.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="monto">Monto solicitado</Label>
                  <CampoMoneda
                    id="monto"
                    valor={form.monto}
                    onCambio={(v) => set('monto', v)}
                    placeholder="$ 0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Opcional. La administradora liquida el saldo real disponible.
                  </p>
                </div>
              </div>
            </section>

            <section className="bloque-datos bloque-violeta p-3">
              <h2 className="bloque-titulo mb-2">Soportes</h2>
              <div className="space-y-2.5">
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
                  obligatorio
                />
              </div>
            </section>
          </div>

          <section className="bloque-datos bloque-verde p-3">
            <Label htmlFor="justificacion" className="bloque-titulo">
              Detalle de la solicitud
            </Label>
            <Textarea
              id="justificacion"
              className="mt-2 min-h-16"
              value={form.justificacion}
              onChange={(e) => set('justificacion', e.target.value)}
              placeholder="Describe el destino concreto: dirección del inmueble, institución educativa, programa…"
            />
          </section>
        </div>

        <PanelResumen
          filas={[
            { etiqueta: 'Solicitante', valor: perfil?.nombre ?? '—' },
            { etiqueta: 'Documento', valor: documento || '—' },
            { etiqueta: 'Empresa', valor: nombreEmpresa ?? '—' },
            { etiqueta: 'Área', valor: nombreArea ?? '—' },
            { etiqueta: 'Destinación', valor: nombreDestino ?? '—', destacado: true },
            { etiqueta: 'Monto', valor: form.monto ? formatearMoneda(Number(form.monto)) : '—' },
            { etiqueta: 'Soporte', valor: soporte ? soporte.name : 'Sin adjuntar' },
            { etiqueta: 'Aprueba', valor: 'Gerencia de TH' },
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

      <DialogoProblemas problemas={problemas} onCerrar={() => setProblemas([])} />

      <DialogoSolicitudEnviada datos={enviada} />
    </form>
  )
}
