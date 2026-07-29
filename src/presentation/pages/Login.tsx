import { useState } from 'react'
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'

const LOGO_BLANCO = `${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`

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
      setError(
        err instanceof Error && err.message.includes('Invalid login')
          ? 'El correo o la contraseña no coinciden.'
          : 'No fue posible iniciar sesión. Intenta de nuevo en unos segundos.'
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="franja-institucional px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <img src={LOGO_BLANCO} alt="Clínica CAC Santa Bárbara" className="h-11 w-auto" />
          <div className="text-white">
            <p className="text-lg font-semibold leading-tight">Permisos y Vacaciones</p>
            <p className="text-xs text-white/80">Proceso de Talento Humano</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl items-center justify-center px-6 py-16">
        <div className="panel-relieve w-full max-w-md p-8">
          <h1 className="text-xl font-semibold text-foreground">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Usa tu correo institucional para continuar.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="correo">Correo institucional</Label>
              <Input
                id="correo"
                type="email"
                autoComplete="email"
                required
                placeholder="nombre.apellido@cacsantabarbara.co"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                aria-invalid={Boolean(error)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clave">Contraseña</Label>
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
        </div>
      </main>

      <footer className="pb-10 text-center text-xs text-muted-foreground">
        Clínica de Alta Complejidad Santa Bárbara · Formatos TH-F-002 y TH-F-005
      </footer>
    </div>
  )
}
