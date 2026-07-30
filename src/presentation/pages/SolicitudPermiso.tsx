import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Save, Send } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  useAreas,
  useCargos,
  useCategorias,
  useConfig,
  useCoordinadores,
  useEmpresas,
  useTipos,
  useTramite,
} from '@/application/catalogos/useCatalogos'
import { crearSolicitud, subirSoporte } from '@/application/solicitudes/api'
import { calcularDuracion, evaluarAntelacion, evaluarSoporte } from '@/domain/reglas'
import { aISO } from '@/domain/festivos'
import { formatearFechaLarga } from '@/lib/utils'
import { PanelResumen, type Aviso } from '@/presentation/components/PanelResumen'
import { CampoArchivo } from '@/presentation/components/CampoArchivo'
import { Button } from '@/presentation/components/ui/button'
import { Checkbox } from '@/presentation/components/ui/checkbox'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { Textarea } from '@/presentation/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

const HOY = new Date().toISOString().slice(0, 10)

export default function SolicitudPermiso() {
  const navigate = useNavigate()
  const { perfil, session } = useAuth()
  const { data: tramite } = useTramite('permiso')
  const { data: empresas } = useEmpresas()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: coordinadores } = useCoordinadores()
  const { data: categorias } = useCategorias()
  const { data: tipos } = useTipos()
  const { data: config } = useConfig()

  const [form, setForm] = useState({
    empresaId: '',
    areaId: '',
    cargoId: '',
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

  // El perfil llena los campos que no debería tener que digitar el colaborador.
  const empresaId = form.empresaId || (perfil?.empresa_id ? String(perfil.empresa_id) : '')
  const areaId = form.areaId || (perfil?.area_id ? String(perfil.area_id) : '')
  const cargoId = form.cargoId || (perfil?.cargo_id ? String(perfil.cargo_id) : '')

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  const tiposDeCategoria = useMemo(
    () => tipos?.filter((t) => String(t.categoria_id) === form.categoriaId) ?? [],
    [tipos, form.categoriaId]
  )
  const tipo = tipos?.find((t) => String(t.id) === form.tipoId)

  // El jefe directo sale del perfil o, si no está fijado, del área.
  const coordinador = useMemo(() => {
    if (perfil?.coordinador_id) return coordinadores?.find((c) => c.id === perfil.coordinador_id)
    return coordinadores?.find((c) => String(c.area_id) === areaId)
  }, [coordinadores, perfil, areaId])

  const duracion = useMemo(
    () =>
      calcularDuracion({
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        horaSalida: form.horaSalida,
        horaRegreso: form.horaRegreso,
      }),
    [form.fechaInicio, form.fechaFin, form.horaSalida, form.horaRegreso]
  )

  const antelacion = useMemo(
    () =>
      tramite
        ? evaluarAntelacion({
            fechaInicio: form.fechaInicio,
            horaSalida: form.horaSalida,
            antelacionMinima: tramite.antelacion_minima,
            unidad: tramite.unidad_antelacion,
            exento: tipo?.exento_antelacion,
          })
        : null,
    [tramite, form.fechaInicio, form.horaSalida, tipo]
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
          })
        : null,
    [tipo, duracion.dias, form.fechaFin, config]
  )

  const avisos = useMemo(() => {
    const lista: Aviso[] = []
    if (antelacion?.mensaje) {
      lista.push({ tono: antelacion.exenta ? 'info' : 'advertencia', texto: antelacion.mensaje })
    }
    if (soporteExigido?.mensaje) {
      lista.push({ tono: soporteExigido.obligatorio ? 'advertencia' : 'info', texto: soporteExigido.mensaje })
    }
    if (tipo?.ruta_aprobacion === 'gerente_th_directo') {
      lista.push({
        tono: 'info',
        texto: 'Este trámite va directo a la Gerencia de Talento Humano, sin pasar por tu jefe directo.',
      })
    }
    if (!coordinador && tipo?.ruta_aprobacion !== 'gerente_th_directo') {
      lista.push({
        tono: 'advertencia',
        texto: 'Tu área no tiene jefe directo asignado. La solicitud llegará a Talento Humano para que lo resuelva.',
      })
    }
    return lista
  }, [antelacion, soporteExigido, tipo, coordinador])

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
    if (enviar && soporteExigido?.momento === 'previo' && !soporte) {
      setError('Este motivo exige adjuntar el soporte al momento de solicitar.')
      return
    }

    setEnviando(true)
    try {
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
          hora_salida: form.horaSalida || null,
          hora_regreso: form.horaRegreso || null,
          horas_permiso: duracion.horas,
          dias_permiso: duracion.dias,
          remunerado: form.remunerado,
          requiere_compensacion: form.requiereCompensacion,
          plan_compensacion: form.planCompensacion.trim() || null,
          justificacion: form.justificacion.trim() || null,
          requiere_soporte_posterior: soporteExigido?.momento === 'posterior' && soporteExigido.obligatorio,
          fecha_limite_soporte: soporteExigido?.fechaLimite ?? null,
        },
      })

      if (soporte) {
        await subirSoporte({
          solicitudId: id,
          archivo: soporte,
          momento: 'previo',
          usuarioId: session.user.id,
          maxMB: Number(config?.max_mb_adjunto ?? 10),
        })
      }

      navigate('/mis-solicitudes', {
        state: { mensaje: consecutivo ? `Solicitud ${consecutivo} enviada.` : 'Borrador guardado.' },
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
    <form
      className="mx-auto flex max-w-7xl flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void guardar(true)
      }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h1 className="text-lg font-semibold tracking-tight">Nueva solicitud de permiso</h1>
        <p className="text-xs text-muted-foreground">
          Formato {tramite?.codigo_formato} · versión {tramite?.version_formato} · solicitado el{' '}
          {formatearFechaLarga(aISO(new Date()))}
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1fr_19rem]">
        <div className="space-y-3">
          {/* ------------------------------------------------ Información general */}
          <section className="bloque-datos bloque-azul p-3">
            <h2 className="bloque-titulo mb-2">Información general</h2>
            <div className="grid gap-2.5 sm:grid-cols-3">
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
                <Label htmlFor="area">Proceso o área</Label>
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
            </div>
          </section>

          {/* -------------------------------------------------------- Dos columnas */}
          <div className="grid gap-3 md:grid-cols-2">
            <section className="bloque-datos bloque-teal p-3">
              <h2 className="bloque-titulo mb-2">Tiempos del permiso</h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="desde">Desde</Label>
                  <Input
                    id="desde"
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => {
                      set('fechaInicio', e.target.value)
                      if (e.target.value > form.fechaFin) set('fechaFin', e.target.value)
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hasta">Hasta</Label>
                  <Input
                    id="hasta"
                    type="date"
                    min={form.fechaInicio}
                    value={form.fechaFin}
                    onChange={(e) => set('fechaFin', e.target.value)}
                  />
                </div>
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
              </div>

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
                      if (t) set('remunerado', t.remunerado_por_defecto)
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

                <CampoArchivo
                  archivo={soporte}
                  onCambio={setSoporte}
                  maxMB={Number(config?.max_mb_adjunto ?? 10)}
                  obligatorio={soporteExigido?.momento === 'previo'}
                />
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
            { etiqueta: 'Documento', valor: perfil?.documento ?? '—' },
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
          className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" cargando={enviando} onClick={() => void guardar(false)}>
          <Save /> Guardar borrador
        </Button>
        <Button type="submit" cargando={enviando}>
          <Send /> Enviar solicitud
        </Button>
      </div>
    </form>
  )
}
