import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, KeyRound } from 'lucide-react'
import { AuthLayout } from '@/presentation/layouts/AuthLayout'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { establecerClave } from '@/application/auth/registro'
import { useAuth } from '@/application/auth/AuthProvider'

/**
 * Pantalla de destino del enlace de recuperación y del que recibe el
 * administrador inicial. Supabase deja la sesión abierta al abrir el enlace,
 * así que aquí basta con actualizar la contraseña.
 */
export default function EstablecerClave() {
  const navigate = useNavigate()
  const { session, cargandoSesion } = useAuth()
  const [clave, setClave] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (clave.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
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
      setError(
        err instanceof Error && err.message.toLowerCase().includes('should be different')
          ? 'La nueva contraseña debe ser distinta de la anterior.'
          : 'No fue posible actualizar la contraseña. Solicita un enlace nuevo.'
      )
    } finally {
      setEnviando(false)
    }
  }

  if (!cargandoSesion && !session) {
    return (
      <AuthLayout>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--error-suave)]">
            <AlertCircle className="size-7 text-[var(--error)]" />
          </div>
          <h1 className="text-xl font-semibold">Enlace no válido</h1>
          <p className="text-sm text-muted-foreground">
            El enlace caducó o ya se usó. Solicita uno nuevo desde la pantalla de recuperación.
          </p>
          <Button variant="outline" className="w-full" onClick={() => navigate('/recuperar')}>
            Solicitar un enlace nuevo
          </Button>
        </div>
      </AuthLayout>
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
            minLength={8}
            autoComplete="new-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
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
