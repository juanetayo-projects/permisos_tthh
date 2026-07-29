import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Save, Send } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  useAreas,
  useCargos,
  useCoordinadores,
  useEmpresas,
  useTramite,
} from '@/application/catalogos/useCatalogos'
import { crearSolicitud } from '@/application/solicitudes/api'
import { calcularVacaciones, evaluarAntelacion, validarSaldos } from '@/domain/reglas'
import { aISO } from '@/domain/festivos'
import { formatearFechaLarga } from '@/lib/utils'
import { PanelResumen, type Aviso } from '@/presentation/components/PanelResumen'
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

export default function SolicitudVacaciones() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { data: tramite } = useTramite('vacaciones')
  const { data: empresas } = useEmpresas()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: coordinadores } = useCoordinadores()

  const [form, setForm] = useState({
    empresaId: '',
    areaId: '',
    cargoId: '',
    diasCorresponden: '',
    diasADisfrutar: '',
    diasPendientes: '',
    fechaInicio: HOY,
    fechaFin: HOY,
    reintegroManual: '',
    observaciones: '',
    declaracion: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const empresaId = form.empresaId || (perfil?.empresa_id ? String(perfil.empresa_id) : '')
  const areaId = form.areaId || (perfil?.area_id ? String(perfil.area_id) : '')
  const cargoId = form.cargoId || (perfil?.cargo_id ? String(perfil.cargo_id) : '')

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  const coordinador = useMemo(() => {
    if (perfil?.coordinador_id) return coordinadores?.find((c) => c.id === perfil.coordinador_id)
    return coordinadores?.find((c) => String(c.area_id) === areaId)
  }, [coordinadores, perfil, areaId])

  const aDisfrutar = form.diasADisfrutar === '' ? null : Number(form.diasADisfrutar)

  const calculo = useMemo(
    () =>
      calcularVacaciones({
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        diasADisfrutar: aDisfrutar,
      }),
    [form.fechaInicio, form.fechaFin, aDisfrutar]
  )

  const saldos = useMemo(
    () =>
      validarSaldos({
        diasCorresponden: form.diasCorresponden === '' ? null : Number(form.diasCorresponden),
        diasADisfrutar: aDisfrutar,
        diasPendientes: form.diasPendientes === '' ? null : Number(form.diasPendientes),
      }),
    [form.diasCorresponden, form.diasPendientes, aDisfrutar]
  )

  const antelacion = useMemo(
    () =>
      tramite
        ? evaluarAntelacion({
            fechaInicio: form.fechaInicio,
            antelacionMinima: tramite.antelacion_minima,
            unidad: tramite.unidad_antelacion,
          })
        : null,
    [tramite, form.fechaInicio]
  )

  const reintegro = form.reintegroManual || calculo.fechaReintegro

  const avisos = useMemo(() => {
    const lista: Aviso[] = []
    if (antelacion?.mensaje) lista.push({ tono: 'advertencia', texto: antelacion.mensaje })
    if (calculo.advertencia) lista.push({ tono: 'advertencia', texto: calculo.advertencia })
    if (saldos.advertencia) lista.push({ tono: 'advertencia', texto: saldos.advertencia })
    if (!form.reintegroManual && calculo.fechaReintegro) {
      lista.push({
        tono: 'info',
        texto: `Te presentas a laborar el ${formatearFechaLarga(calculo.fechaReintegro)}, saltando fines de semana y festivos.`,
      })
    }
    lista.push({
      tono: 'info',
      texto: 'Talento Humano validará los saldos contra nómina antes de aprobar.',
    })
    return lista
  }, [antelacion, calculo, saldos, form.reintegroManual])

  async function guardar(enviar: boolean) {
    setError(null)
    if (!perfil || !tramite) return

    if (enviar && !form.declaracion) {
      setError('Debes aceptar la declaración de conformidad para enviar la solicitud.')
      return
    }
    if (enviar && aDisfrutar === null) {
      setError('Indica cuántos días vas a disfrutar.')
      return
    }

    setEnviando(true)
    try {
      const { consecutivo } = await crearSolicitud({
        base: {
          tramite_id: tramite.id,
          solicitante_id: perfil.user_id,
          empresa_id: empresaId ? Number(empresaId) : null,
          area_id: areaId ? Number(areaId) : null,
          cargo_id: cargoId ? Number(cargoId) : null,
          coordinador_id: coordinador?.id ?? null,
          fecha_inicio: form.fechaInicio,
          fecha_fin: form.fechaFin,
          observaciones: form.observaciones.trim() || null,
          extemporanea: antelacion?.extemporanea ?? false,
        },
        enviar,
        rutaAprobacion: 'coordinador_th',
        detalleVacaciones: {
          dias_corresponden: form.diasCorresponden === '' ? null : Number(form.diasCorresponden),
          dias_a_disfrutar: aDisfrutar,
          dias_pendientes: form.diasPendientes === '' ? null : Number(form.diasPendientes),
          fecha_reintegro: reintegro,
          dias_habiles_calculados: calculo.diasHabiles,
          declaracion_aceptada: form.declaracion,
          fecha_constancia: aISO(new Date()),
        },
      })

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
      className="mx-auto flex max-w-7xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void guardar(true)
      }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Solicitud de vacaciones</h1>
          <p className="text-sm text-muted-foreground">
            Formato {tramite?.codigo_formato} · versión {tramite?.version_formato}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Solicitado el {formatearFechaLarga(aISO(new Date()))}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Información general
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label htmlFor="area">Servicio o área</Label>
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
              <div className="space-y-1.5">
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

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Periodo a disfrutar
            </h2>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label htmlFor="disfrutar">Días a disfrutar</Label>
                <Input
                  id="disfrutar"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.diasADisfrutar}
                  onChange={(e) => set('diasADisfrutar', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pendientes">Días pendientes</Label>
                <Input
                  id="pendientes"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.diasPendientes}
                  onChange={(e) => set('diasPendientes', e.target.value)}
                />
              </div>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Estos saldos los verifica Talento Humano contra nómina.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="inicio">Fecha de inicio</Label>
                <Input
                  id="inicio"
                  type="date"
                  value={form.fechaInicio}
                  onChange={(e) => {
                    set('fechaInicio', e.target.value)
                    if (e.target.value > form.fechaFin) set('fechaFin', e.target.value)
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin">Fecha de fin</Label>
                <Input
                  id="fin"
                  type="date"
                  min={form.fechaInicio}
                  value={form.fechaFin}
                  onChange={(e) => set('fechaFin', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reintegro">Se presenta a laborar</Label>
                <Input
                  id="reintegro"
                  type="date"
                  value={reintegro}
                  onChange={(e) => set('reintegroManual', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Calculado; puedes ajustarlo.</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <Label htmlFor="observaciones" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Observaciones
            </Label>
            <Textarea
              id="observaciones"
              className="mt-2 min-h-20"
              value={form.observaciones}
              onChange={(e) => set('observaciones', e.target.value)}
              placeholder="Por ejemplo: días pendientes del periodo anterior…"
            />
          </section>

          <section className="rounded-lg border border-[var(--cac-azul-200)] bg-[var(--info-suave)] p-4 dark:border-[var(--cac-azul-800)]">
            <label className="flex items-start gap-3 text-sm">
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

        <PanelResumen
          filas={[
            { etiqueta: 'Solicitante', valor: perfil?.nombre ?? '—' },
            { etiqueta: 'Documento', valor: perfil?.documento ?? '—' },
            { etiqueta: 'Empresa', valor: nombreEmpresa ?? '—' },
            { etiqueta: 'Servicio', valor: nombreArea ?? '—' },
            {
              etiqueta: 'Periodo',
              valor: `${formatearFechaLarga(form.fechaInicio)} → ${formatearFechaLarga(form.fechaFin)}`,
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
