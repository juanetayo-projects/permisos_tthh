import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { AuthLayout } from '@/presentation/layouts/AuthLayout'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'

export default function Login() {
  const { entrar } = useAuth()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await entrar(correo, clave)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message.toLowerCase() : ''
      setError(
        mensaje.includes('invalid login')
          ? 'El correo o la contraseña no coinciden.'
          : mensaje.includes('not confirmed')
            ? 'Tu correo aún no está confirmado. Abre el enlace que te enviamos al registrarte.'
            : 'No fue posible iniciar sesión. Intenta de nuevo en unos segundos.'
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold text-foreground">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ingresa con el correo que registraste.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="correo">Correo electrónico</Label>
          <Input
            id="correo"
            type="email"
            autoComplete="email"
            required
            placeholder="tucorreo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="clave">Contraseña</Label>
            <Link
              to="/recuperar"
              className="text-xs text-[var(--cac-azul-contraste)] underline-offset-4 hover:underline dark:text-[var(--cac-azul-300)]"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="clave"
              type={verClave ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              aria-invalid={Boolean(error)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
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

        <Button type="submit" className="w-full" size="lg" cargando={enviando}>
          {!enviando && <LogIn />}
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{' '}
        <Link
          to="/registro"
          className="font-medium text-[var(--cac-azul-contraste)] underline-offset-4 hover:underline dark:text-[var(--cac-azul-300)]"
        >
          Regístrate
        </Link>
      </div>
    </AuthLayout>
  )
}
