import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { AuthLayout } from '@/presentation/layouts/AuthLayout'
import { Button } from '@/presentation/components/ui/button'
import { useAuth } from '@/application/auth/AuthProvider'

/**
 * Estado de espera entre la confirmación del correo y la validación de Talento
 * Humano (decisión D5). Explica qué falta y quién debe actuar, en vez de dejar
 * al colaborador ante una pantalla vacía.
 */
export default function PerfilPendiente() {
  const { perfil, session, salir, recargarPerfil, cargandoPerfil } = useAuth()
  const sinPerfil = !perfil

  return (
    <AuthLayout>
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--advertencia-suave)]">
          <Clock className="size-7 text-[#8a6400] dark:text-[var(--advertencia)]" />
        </div>

        <h1 className="text-xl font-semibold">
          {sinPerfil ? 'Cuenta sin perfil asignado' : 'Tu cuenta está en validación'}
        </h1>

        <p className="text-sm text-muted-foreground">
          {sinPerfil ? (
            <>
              La cuenta <strong>{session?.user.email}</strong> existe, pero todavía no tiene un
              perfil en esta aplicación. Talento Humano debe crearlo para que puedas continuar.
            </>
          ) : (
            <>
              Hola, <strong>{perfil.nombre}</strong>. Talento Humano está confirmando tu área y tu
              jefe directo. En cuanto quede validado podrás registrar permisos y vacaciones.
            </>
          )}
        </p>

        <p className="rounded-md bg-[var(--info-suave)] p-3 text-left text-sm text-[var(--info)] dark:text-[var(--cac-azul-300)]">
          Este paso evita que las solicitudes lleguen al coordinador equivocado. Si llevas más de un
          día hábil esperando, escribe a Talento Humano.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="sm:flex-1"
            cargando={cargandoPerfil}
            onClick={() => void recargarPerfil()}
          >
            {!cargandoPerfil && <RefreshCw />} Comprobar de nuevo
          </Button>
          <Button variant="ghost" className="sm:flex-1" onClick={() => void salir()}>
            <LogOut /> Cerrar sesión
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
