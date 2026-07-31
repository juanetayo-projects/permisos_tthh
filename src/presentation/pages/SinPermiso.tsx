import { useNavigate } from 'react-router-dom'
import { Home, LockKeyhole, LogOut } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { ETIQUETA_ROL } from '@/domain/estados'
import { Button } from '@/presentation/components/ui/button'
import { Card } from '@/presentation/components/ui/card'

/**
 * Sección a la que la sesión abierta no tiene acceso.
 *
 * Casi siempre pasa por el mismo camino: el jefe recibe «Ir a mi bandeja» en
 * el correo y abre el enlace en un equipo donde quedó la sesión de otra
 * persona —normalmente la del propio solicitante, que acaba de usar la app—.
 * Antes se reutilizaba aquí la pantalla de «módulo en construcción», que
 * además de no ser cierto no ofrecía ninguna salida. Lo que hace falta es
 * decir con qué cuenta se está entrando y permitir cambiarla.
 */
export default function SinPermiso({ seccion }: { seccion?: string }) {
  const navigate = useNavigate()
  const { perfil, session, salir } = useAuth()

  async function cambiarDeCuenta() {
    await salir()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-8 text-center sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--info-suave)]">
          <LockKeyhole className="size-7 text-[var(--info)] dark:text-[var(--cac-azul-300)]" />
        </div>

        <h1 className="mt-4 text-lg font-semibold">
          {seccion ? `No puedes ver «${seccion}»` : 'No tienes permiso para ver esta sección'}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Estás dentro como <strong>{perfil?.nombre ?? session?.user.email}</strong>
          {perfil && <> ({ETIQUETA_ROL[perfil.rol].toLowerCase()})</>}, y esta sección es de otro
          rol.
        </p>

        <p className="mx-auto mt-4 max-w-md rounded-md bg-[var(--tinte-azul)] p-3 text-left text-sm text-muted-foreground">
          Si llegaste desde un enlace de un correo dirigido a otra persona, en este equipo quedó
          abierta la sesión de alguien más. Cierra la sesión y entra con la cuenta a la que llegó
          el correo.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => void cambiarDeCuenta()}>
            <LogOut /> Entrar con otra cuenta
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home /> Ir a mi inicio
          </Button>
        </div>
      </Card>
    </div>
  )
}
