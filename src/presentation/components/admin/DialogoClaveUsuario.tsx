import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Mail } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { useGestionarCuenta, type PerfilAdmin } from '@/application/admin/usePerfiles'
import { fortalezaClave, LONGITUD_MINIMA_CLAVE } from '@/domain/clave'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { MedidorClave } from '@/presentation/components/MedidorClave'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'

/**
 * Contraseña de otra persona.
 *
 * Se ofrecen las dos vías porque resuelven casos distintos, y el orden en que
 * aparecen no es casual:
 *
 * 1. **Enviar el enlace** es lo normal y lo que va primero. La persona define
 *    su propia contraseña y nadie más llega a conocerla, así que las acciones
 *    que haga con esa cuenta —autorizar permisos, entre otras— siguen siendo
 *    solo suyas.
 * 2. **Fijarla a mano** es el último recurso: alguien perdió el acceso al
 *    correo con el que se registró y no puede recibir ningún enlace. Queda
 *    reservada al administrador y advertida en pantalla, porque a partir de
 *    ahí dos personas conocen la clave.
 *
 * Quién puede cada una lo decide la Edge Function, no esta pantalla: esconder
 * un botón no es una medida de seguridad.
 */
export function DialogoClaveUsuario({
  perfil,
  onCerrar,
}: {
  perfil: PerfilAdmin | null
  onCerrar: () => void
}) {
  const { perfil: yo } = useAuth()
  const cuenta = useGestionarCuenta()

  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  const puedeFijarla = yo?.rol === 'administrador'

  useEffect(() => {
    setClave('')
    setRepetida('')
    setError(null)
    setHecho(null)
  }, [perfil])

  const fuerza = fortalezaClave(clave, [perfil?.nombre ?? '', perfil?.correo ?? '', perfil?.documento ?? ''])

  async function ejecutar(accion: 'definir_clave' | 'enviar_enlace') {
    if (!perfil) return
    setError(null)
    setHecho(null)

    if (accion === 'definir_clave') {
      if (!fuerza.cumpleMinimo) {
        setError(`La contraseña necesita al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`)
        return
      }
      if (clave !== repetida) {
        setError('Las dos contraseñas no coinciden.')
        return
      }
    }

    try {
      await cuenta.mutateAsync({ accion, userId: perfil.user_id, clave })
      setClave('')
      setRepetida('')
      setHecho(
        accion === 'enviar_enlace'
          ? `Le enviamos a ${perfil.correo} un enlace para que defina su contraseña.`
          : 'Contraseña cambiada. Entrégasela por un medio seguro y pídele que la cambie al entrar.'
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible completar la operación.')
    }
  }

  return (
    <Dialog open={Boolean(perfil)} onOpenChange={(v) => !v && !cuenta.isPending && onCerrar()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 [&>button]:text-white/80 [&>button]:hover:bg-white/20 [&>button]:hover:text-white">
        <DialogHeader className="franja-institucional gap-1 p-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-white">
            <KeyRound className="size-5" /> Contraseña
          </DialogTitle>
          <DialogDescription className="text-white/80">
            {perfil?.nombre} · {perfil?.correo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          {/* ------------------------------------------------------ El enlace */}
          <div className="bloque-datos p-3">
            <p className="flex items-center gap-2 font-medium">
              <Mail className="size-4 shrink-0" /> Enviarle el enlace
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Define su contraseña desde su correo. Nadie más llega a conocerla. El enlace caduca
              en una hora.
            </p>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                cargando={cuenta.isPending}
                onClick={() => void ejecutar('enviar_enlace')}
              >
                <Mail /> Enviar enlace
              </Button>
            </div>
          </div>

          {/* ------------------------------------------------- Fijarla a mano */}
          {puedeFijarla && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="font-medium">Fijarla tú</p>
              <p className="text-sm text-muted-foreground">
                Solo cuando la persona no puede recibir el correo. A partir de ahí la contraseña la
                conocéis dos, así que pídele que la cambie en cuanto entre.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="c-clave">Contraseña nueva</Label>
                <Input
                  id="c-clave"
                  type="password"
                  autoComplete="new-password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                />
                <MedidorClave
                  clave={clave}
                  contexto={[perfil?.nombre ?? '', perfil?.correo ?? '', perfil?.documento ?? '']}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-repetida">Repítela</Label>
                <Input
                  id="c-repetida"
                  type="password"
                  autoComplete="new-password"
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!clave || !repetida}
                  cargando={cuenta.isPending}
                  onClick={() => void ejecutar('definir_clave')}
                >
                  <KeyRound /> Cambiar la contraseña
                </Button>
              </div>
            </div>
          )}

          {hecho && (
            <p className="flex items-start gap-2 rounded-md bg-[var(--exito-suave)] p-3 text-sm text-[var(--exito)]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              {hecho}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-muted/40 p-4">
          <Button variant="ghost" onClick={onCerrar} disabled={cuenta.isPending}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
