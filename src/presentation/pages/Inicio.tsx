import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ClipboardList, FileText, Info, PiggyBank } from 'lucide-react'
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
    a: '/solicitar/cesantias',
    titulo: 'Retiro de cesantías',
    descripcion: 'Retiro parcial para vivienda o educación. No descuenta tiempo.',
    icono: PiggyBank,
    codigo: 'cesantias' as const,
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
    // El inicio cabe entero en pantalla: es la portada del trámite y obligar a
    // bajar para ver el flujo o las advertencias hacía que nadie las leyera.
    // Por eso la columna ocupa el alto disponible y son los bloques los que se
    // ajustan, no la ventana la que crece.
    <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:h-full lg:gap-2.5 lg:overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">
          {saludo()}
          {primerNombre && `, ${primerNombre}`}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Gestiona tus permisos y vacaciones sin papel.
        </p>
      </header>

      <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACCESOS.map(({ a, titulo, descripcion, icono: Icono, codigo }) => {
          const tramite = codigo ? tramites?.find((t) => t.codigo === codigo) : undefined
          return (
            <Link key={a} to={a} className="group">
              <Card
                relieve
                className="tarjeta-acceso h-full p-4 transition-transform group-hover:-translate-y-0.5"
              >
                {/* Icono y título en la misma línea: apilarlos gastaba una
                    franja de alto que el inicio no tiene para dar. */}
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--info-suave)] text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]">
                    <Icono className="size-5" />
                  </span>
                  <h2 className="min-w-0 flex-1 font-semibold leading-tight">{titulo}</h2>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">{descripcion}</p>
                {tramite && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Formato {tramite.codigo_formato} · versión {tramite.version_formato}
                  </p>
                )}
              </Card>
            </Link>
          )
        })}
      </div>

      <FlujoProceso rol={perfil?.rol} />

      {/* Las notas al pie llegan del catálogo, así que este es el único bloque
          de alto imprevisible: se le deja encoger y, si algún día crecen mucho,
          es la lista la que se desplaza —no la pantalla entera—. */}
      <Card className="panel-destacado shrink bg-[var(--info-suave)] p-4 lg:min-h-0">
        <div className="flex h-full min-h-0 gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-[var(--cac-azul)] dark:text-[var(--cac-azul-300)]" />
          <div className="flex min-h-0 flex-col gap-1.5 text-sm">
            <p className="font-medium text-foreground">Antes de solicitar, ten en cuenta</p>
            {/* Rejilla y no `columns-2`: el multicolumna desborda de lado, así
                que al encoger la tarjeta las últimas notas se iban fuera de la
                pantalla sin dejar rastro. Con rejilla el sobrante baja y la
                lista sí se puede desplazar. */}
            <ul className="grid min-h-0 list-disc gap-x-6 gap-y-1 overflow-y-auto pl-5 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
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
