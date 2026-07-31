import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, KeyRound, Loader2, MailWarning } from 'lucide-react'
import { AuthLayout } from '@/presentation/layouts/AuthLayout'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { MedidorClave } from '@/presentation/components/MedidorClave'
import { LONGITUD_MINIMA_CLAVE } from '@/domain/clave'
import { establecerClave } from '@/application/auth/registro'
import { completarEnlaceDeCorreo, type ResultadoEnlace } from '@/application/auth/enlaceCorreo'
import { useAuth } from '@/application/auth/AuthProvider'

/**
 * Pantalla de destino del enlace de recuperación y del que recibe el
 * administrador inicial.
 *
 * El enlace se canjea **aquí**, y hasta que ese canje termina no se decide
 * nada: antes se daba por inválido cualquier enlace que no hubiera dejado ya
 * una sesión abierta, y eso tapaba la causa real —un código PKCE abierto en
 * otro navegador— con un mensaje genérico.
 */
export default function EstablecerClave() {
  const navigate = useNavigate()
  const { session, cargandoSesion } = useAuth()

  const [enlace, setEnlace] = useState<ResultadoEnlace | null>(null)
  const [clave, setClave] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vigente = true
    void completarEnlaceDeCorreo().then((r) => {
      if (vigente) setEnlace(r)
    })
    return () => {
      vigente = false
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (clave.length < LONGITUD_MINIMA_CLAVE) {
      setError(`La contraseña debe tener al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`)
      return
    }
    if (clave !== confirmacion) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setEnviando(true)
    try {
      await establecerClave(clave)
      navigate('/', { replace: true })
    } catch (err) {
      const mensaje = err instanceof Error ? err.message.toLowerCase() : ''

      if (mensaje.includes('should be different')) {
        setError('La nueva contraseña debe ser distinta de la anterior.')
      } else if (mensaje.includes('pwned') || mensaje.includes('weak password')) {
        setError(
          'Esa contraseña aparece en filtraciones públicas y no se puede usar. Elige otra: la barra de color te indica cuándo es lo bastante fuerte.'
        )
      } else {
        setError('No fue posible actualizar la contraseña. Solicita un enlace nuevo.')
      }
    } finally {
      setEnviando(false)
    }
  }

  // El canje es correcto pero `session` llega por el evento de Supabase, un
  // instante después: sin esperarlo se vería «enlace no válido» parpadeando
  // justo cuando todo ha ido bien.
  if (enlace === null || cargandoSesion || (enlace === 'listo' && !session)) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">Validando el enlace…</p>
        </div>
      </AuthLayout>
    )
  }

  // El enlace se abrió donde no está el verificador del flujo PKCE. Merece un
  // mensaje propio: no caducó, y reintentar en el mismo sitio no lo arregla.
  if (!session && enlace === 'otro-navegador') {
    return (
      <AvisoEnlace
        icono={<MailWarning className="size-7 text-[var(--acento-ambar)]" />}
        tinte="var(--tinte-ambar)"
        titulo="Abre el enlace en el mismo navegador"
        onSolicitar={() => navigate('/recuperar')}
      >
        Por seguridad, este enlace solo funciona en el navegador desde el que pediste el cambio. Si
        lo abriste en el celular y lo solicitaste en el computador —o al revés—, pide uno nuevo
        desde el equipo en el que vayas a entrar.
      </AvisoEnlace>
    )
  }

  if (!session) {
    return (
      <AvisoEnlace
        icono={<AlertCircle className="size-7 text-[var(--error)]" />}
        tinte="var(--error-suave)"
        titulo="Este enlace ya no sirve"
        onSolicitar={() => navigate('/recuperar')}
      >
        {/* La causa real casi nunca es que haya caducado: es que se abrió un
            correo viejo. Cada enlace nuevo anula el anterior, y quien acaba de
            recibir la bienvenida más una recuperación tiene ya dos en la
            bandeja. Decir «caducó» mandaba a pedir otro y repetir el error. */}
        <strong>Revisa que sea el correo más reciente.</strong> Cada vez que se pide un enlace, el
        anterior deja de funcionar, así que si tienes varios en la bandeja solo sirve el último. Si
        ya es el último, pide uno nuevo y ábrelo sin volver a solicitarlo.
      </AvisoEnlace>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold">Establecer contraseña</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Elige una contraseña nueva para tu cuenta.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="clave">Nueva contraseña</Label>
          <Input
            id="clave"
            type="password"
            required
            minLength={LONGITUD_MINIMA_CLAVE}
            autoComplete="new-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <MedidorClave clave={clave} contexto={[session.user.email ?? '']} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmacion">Confirmar contraseña</Label>
          <Input
            id="confirmacion"
            type="password"
            required
            autoComplete="new-password"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" cargando={enviando}>
          {!enviando && <KeyRound />}
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </AuthLayout>
  )
}

function AvisoEnlace({
  icono,
  tinte,
  titulo,
  children,
  onSolicitar,
}: {
  icono: React.ReactNode
  tinte: string
  titulo: string
  children: React.ReactNode
  onSolicitar: () => void
}) {
  return (
    <AuthLayout>
      <div className="space-y-4 text-center">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-full"
          style={{ backgroundColor: tinte }}
        >
          {icono}
        </div>
        <h1 className="text-xl font-semibold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{children}</p>
        <Button variant="outline" className="w-full" onClick={onSolicitar}>
          Solicitar un enlace nuevo
        </Button>
      </div>
    </AuthLayout>
  )
}
