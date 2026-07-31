import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, MailCheck, UserPlus } from 'lucide-react'
import { AuthLayout } from '@/presentation/layouts/AuthLayout'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'
import { MedidorClave } from '@/presentation/components/MedidorClave'
import { useCatalogosRegistro } from '@/application/catalogos/useCatalogosRegistro'
import { LONGITUD_MINIMA_CLAVE } from '@/domain/clave'
import {
  ErrorCorreoYaRegistrado,
  ErrorDominioNoPermitido,
  registrar,
} from '@/application/auth/registro'

const TIPOS_DOCUMENTO = [
  { valor: 'CC', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'CE', etiqueta: 'Cédula de extranjería' },
  { valor: 'PA', etiqueta: 'Pasaporte' },
  { valor: 'PEP', etiqueta: 'Permiso especial de permanencia' },
]

/**
 * Qué hacer cuando el correo ya tiene cuenta.
 *
 * No basta con «ya existe»: la cuenta puede venir de Cambio de Turnos, que
 * comparte el mismo proyecto de Supabase, así que la persona quizá no recuerde
 * haberse registrado nunca aquí. La salida es iniciar sesión con esa misma
 * contraseña o recuperarla.
 */
function AvisoCorreoExistente() {
  return (
    <span>
      Ese correo ya tiene una cuenta. Si te registraste en <strong>Cambio de Turnos</strong>, el
      acceso es el mismo:{' '}
      <Link to="/login" className="font-medium underline underline-offset-2">
        inicia sesión
      </Link>{' '}
      con esa contraseña o{' '}
      <Link to="/recuperar" className="font-medium underline underline-offset-2">
        recupérala
      </Link>
      . Talento Humano completará después los datos que faltan de tu perfil.
    </span>
  )
}

export default function Registro() {
  const { data: catalogos } = useCatalogosRegistro()

  const empresas = catalogos?.empresas
  const areas = catalogos?.areas
  const cargos = catalogos?.cargos
  // Lista vacía = cualquier dominio: muchos colaboradores usan correo personal.
  const dominios = catalogos?.dominios_permitidos ?? []

  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    clave: '',
    confirmacion: '',
    tipoDocumento: 'CC',
    documento: '',
    telefono: '',
    empresaId: '',
    areaId: '',
    cargoId: '',
  })
  // Es `ReactNode` y no `string` porque el aviso de correo ya registrado lleva
  // enlaces a iniciar sesión y a recuperar la contraseña.
  const [error, setError] = useState<React.ReactNode>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

  function set<K extends keyof typeof form>(campo: K, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.clave.length < LONGITUD_MINIMA_CLAVE) {
      setError(`La contraseña debe tener al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`)
      return
    }
    if (form.clave !== form.confirmacion) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    if (!form.empresaId || !form.areaId || !form.cargoId) {
      setError('Selecciona empresa, área y cargo.')
      return
    }

    setEnviando(true)
    try {
      await registrar(
        {
          nombre: form.nombre,
          correo: form.correo,
          clave: form.clave,
          tipoDocumento: form.tipoDocumento,
          documento: form.documento,
          telefono: form.telefono,
          empresaId: Number(form.empresaId),
          areaId: Number(form.areaId),
          cargoId: Number(form.cargoId),
        },
        dominios
      )
      setListo(true)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message.toLowerCase() : ''

      if (err instanceof ErrorDominioNoPermitido) {
        setError(err.message)
      } else if (
        err instanceof ErrorCorreoYaRegistrado ||
        mensaje.includes('already registered')
      ) {
        setError(<AvisoCorreoExistente />)
      } else if (mensaje.includes('pwned') || mensaje.includes('weak password')) {
        setError(
          'Esa contraseña aparece en filtraciones públicas y no se puede usar. Elige otra: la barra de color te indica cuándo es lo bastante fuerte.'
        )
      } else if (mensaje.includes('rate limit')) {
        setError('Se hicieron demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.')
      } else {
        setError('No fue posible completar el registro. Intenta de nuevo en unos minutos.')
      }
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    return (
      <AuthLayout>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--exito-suave)]">
            <MailCheck className="size-7 text-[var(--exito)]" />
          </div>
          <h1 className="text-xl font-semibold">Revisa tu correo</h1>
          <p className="text-sm text-muted-foreground">
            Enviamos un enlace de confirmación a <strong>{form.correo}</strong>. Ábrelo para
            activar tu cuenta.
          </p>
          <p className="rounded-md bg-[var(--info-suave)] p-3 text-left text-sm text-[var(--info)] dark:text-[var(--cac-azul-300)]">
            Después de confirmar, Talento Humano validará tu identidad, tu área y tu jefe directo.
            Podrás crear solicitudes en cuanto quede aprobado.
          </p>
          <Button variant="outline" asChild className="w-full">
            <Link to="/login">
              <ArrowLeft /> Volver al inicio de sesión
            </Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout ancho="lg">
      <h1 className="text-xl font-semibold">Crear cuenta</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {dominios.length > 0 ? (
          <>
            Solo para colaboradores con correo {dominios.map((d) => `@${d}`).join(' o ')}.
          </>
        ) : (
          <>
            Puedes usar tu correo institucional o uno personal. Talento Humano validará tus datos
            antes de habilitarte.
          </>
        )}
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nombre">Nombre y apellido</Label>
          <Input
            id="nombre"
            required
            autoComplete="name"
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tipoDoc">Tipo de documento</Label>
          <Select value={form.tipoDocumento} onValueChange={(v) => set('tipoDocumento', v)}>
            <SelectTrigger id="tipoDoc">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DOCUMENTO.map((t) => (
                <SelectItem key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="documento">N.° de identificación</Label>
          <Input
            id="documento"
            required
            inputMode="numeric"
            value={form.documento}
            onChange={(e) => set('documento', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="empresa">Empresa</Label>
          <Select value={form.empresaId} onValueChange={(v) => set('empresaId', v)}>
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

        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono (opcional)</Label>
          <Input
            id="telefono"
            inputMode="tel"
            autoComplete="tel"
            value={form.telefono}
            onChange={(e) => set('telefono', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="area">Proceso o área</Label>
          <Select value={form.areaId} onValueChange={(v) => set('areaId', v)}>
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

        <div className="space-y-2">
          <Label htmlFor="cargo">Cargo</Label>
          <Select value={form.cargoId} onValueChange={(v) => set('cargoId', v)}>
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

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="correo">Correo electrónico</Label>
          <Input
            id="correo"
            type="email"
            required
            autoComplete="email"
            placeholder={dominios.length > 0 ? `nombre.apellido@${dominios[0]}` : 'tucorreo@ejemplo.com'}
            value={form.correo}
            onChange={(e) => set('correo', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            A este correo llegarán la confirmación y todas las notificaciones de tus solicitudes.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="clave">Contraseña</Label>
          <Input
            id="clave"
            type="password"
            required
            minLength={LONGITUD_MINIMA_CLAVE}
            autoComplete="new-password"
            value={form.clave}
            onChange={(e) => set('clave', e.target.value)}
          />
          <MedidorClave
            clave={form.clave}
            contexto={[form.nombre, form.correo, form.documento]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmacion">Confirmar contraseña</Label>
          <Input
            id="confirmacion"
            type="password"
            required
            autoComplete="new-password"
            value={form.confirmacion}
            onChange={(e) => set('confirmacion', e.target.value)}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)] sm:col-span-2"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row-reverse">
          <Button type="submit" size="lg" cargando={enviando} className="sm:flex-1">
            {!enviando && <UserPlus />}
            {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
          <Button variant="ghost" asChild className="sm:flex-1">
            <Link to="/login">
              <ArrowLeft /> Ya tengo cuenta
            </Link>
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
