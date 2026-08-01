import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ClipboardList, FileText, Info } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { useTramites } from '@/application/catalogos/useCatalogos'
import { Card } from '@/presentation/components/ui/card'
import { FlujoProceso } from '@/presentation/components/FlujoProceso'

function saludo(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const ACCESOS = [
  {
    a: '/solicitar/permiso',
    titulo: 'Solicitar un permiso',
    descripcion: 'Cita médica, calamidad, diligencia personal, día de la familia…',
    icono: FileText,
    codigo: 'permiso' as const,
  },
  {
    a: '/solicitar/vacaciones',
    titulo: 'Solicitar vacaciones',
    descripcion: 'Periodo a disfrutar, saldos y fecha de reintegro.',
    icono: CalendarDays,
    codigo: 'vacaciones' as const,
  },
  {
    a: '/mis-solicitudes',
    titulo: 'Mis solicitudes',
    descripcion: 'Seguimiento, soportes pendientes y descarga del formato.',
    icono: ClipboardList,
    codigo: null,
  },
]

export default function Inicio() {
  const { perfil } = useAuth()
  const { data: tramites } = useTramites()

  const primerNombre = perfil?.nombre.split(' ')[0] ?? ''

  return (
    <div className="mx-auto max-w-6xl space-y-6 lg:h-full lg:overflow-y-auto lg:pr-1">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {saludo()}
          {primerNombre && `, ${primerNombre}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona tus permisos y vacaciones sin papel.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACCESOS.map(({ a, titulo, descripcion, icono: Icono, codigo }) => {
          const tramite = codigo ? tramites?.find((t) => t.codigo === codigo) : undefined
          return (
            <Link key={a} to={a} className="group">
              <Card relieve className="h-full p-5 transition-transform group-hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--info-suave)] text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]">
                    <Icono className="size-5" />
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <h2 className="mt-4 font-semibold">{titulo}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
                {tramite && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Formato {tramite.codigo_formato} · versión {tramite.version_formato}
                  </p>
                )}
              </Card>
            </Link>
          )
        })}
      </div>

      <FlujoProceso rol={perfil?.rol} />

      <Card className="border-[var(--cac-azul-200)] bg-[var(--info-suave)] p-5 dark:border-[var(--cac-azul-800)]">
        <div className="flex gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">Antes de solicitar, ten en cuenta</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {tramites?.map((t) => (
                <li key={t.id}>{t.nota_pie}</li>
              ))}
              <li>
                Si el motivo es una cita médica y el ausentismo supera 2 días, al regresar deberás
                adjuntar la constancia de asistencia, la incapacidad o la historia clínica.
              </li>
              <li>
                Una calamidad o un luto no se pueden planear: esos motivos están exentos de la regla
                de antelación.
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
