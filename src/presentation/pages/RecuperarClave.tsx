import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, MailCheck, Send } from 'lucide-react'
import { AuthLayout } from '@/presentation/layouts/AuthLayout'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { enviarRecuperacion } from '@/application/auth/registro'

export default function RecuperarClave() {
  const [correo, setCorreo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await enviarRecuperacion(correo)
      setListo(true)
    } catch {
      // No se revela si el correo existe o no: sería un vector de enumeración.
      setListo(true)
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
            Si <strong>{correo}</strong> corresponde a una cuenta registrada, allí encontrarás el
            enlace para restablecer la contraseña. El enlace caduca en una hora.
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
    <AuthLayout>
      <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Te enviaremos un enlace para crear una nueva.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="correo">Correo electrónico</Label>
          <Input
            id="correo"
            type="email"
            required
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" cargando={enviando}>
          {!enviando && <Send />}
          {enviando ? 'Enviando…' : 'Enviar enlace'}
        </Button>

        <Button variant="ghost" asChild className="w-full">
          <Link to="/login">
            <ArrowLeft /> Volver
          </Link>
        </Button>
      </form>
    </AuthLayout>
  )
}
