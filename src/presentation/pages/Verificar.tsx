import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, BadgeCheck, Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import { formatearFecha } from '@/lib/utils'
import { ETIQUETA_ESTADO, type Estado } from '@/domain/estados'
import { AuthLayout } from '@/presentation/layouts/AuthLayout'
import { Card } from '@/presentation/components/ui/card'

interface Resultado {
  valido: boolean
  error?: string
  consecutivo?: string
  estado?: Estado
  tramite?: string
  formato?: string
  solicitante?: string
  area?: string
  fecha_inicio?: string
  fecha_fin?: string
  autorizado_por_jefe?: boolean
  autorizado_por_th?: boolean
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 text-right">{valor}</dd>
    </div>
  )
}

/**
 * Página pública a la que apunta el QR del sello de trazabilidad impreso en
 * cada PDF (decisión D7). Cualquiera con el documento en la mano puede
 * confirmar que es auténtico, sin necesidad de tener cuenta.
 *
 * Se consulta con `fetch` directo y no con `supabase.functions.invoke` porque
 * la función recibe los datos por querystring —así el QR es un simple enlace—
 * y esa API no admite parámetros de URL.
 */
export default function Verificar() {
  const [params] = useSearchParams()
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [cargando, setCargando] = useState(true)

  const consecutivo = params.get('c') ?? ''
  const codigo = params.get('v') ?? ''

  useEffect(() => {
    if (!consecutivo || !codigo) {
      setResultado({ valido: false, error: 'El enlace no trae los datos de verificación.' })
      setCargando(false)
      return
    }

    let cancelado = false
    setCargando(true)

    const url =
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/permisos-verificar` +
      `?c=${encodeURIComponent(consecutivo)}&v=${encodeURIComponent(codigo)}`

    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } })
      .then((r) => r.json())
      .then((data: Resultado) => {
        if (!cancelado) setResultado(data)
      })
      .catch(() => {
        if (!cancelado) {
          setResultado({ valido: false, error: 'No fue posible consultar el documento. Revisa tu conexión.' })
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [consecutivo, codigo])

  const valido = resultado?.valido === true

  return (
    <AuthLayout>
      <div className="space-y-4 text-center">
        <div
          className={`mx-auto flex size-14 items-center justify-center rounded-full ${
            cargando
              ? 'bg-[var(--info-suave)]'
              : valido
                ? 'bg-[var(--exito-suave)]'
                : 'bg-[var(--error-suave)]'
          }`}
        >
          {cargando ? (
            <Loader2 className="size-7 animate-spin text-[var(--info)]" />
          ) : valido ? (
            <ShieldCheck className="size-7 text-[var(--exito)]" />
          ) : (
            <ShieldX className="size-7 text-[var(--error)]" />
          )}
        </div>

        <h1 className="text-xl font-semibold">
          {cargando ? 'Verificando documento…' : valido ? 'Documento auténtico' : 'No se pudo verificar'}
        </h1>

        {!cargando && !valido && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-left text-sm text-[var(--error)]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {resultado?.error ?? 'El documento no corresponde a ninguna solicitud registrada.'}
          </p>
        )}

        {valido && resultado && (
          <>
            <Card className="p-5 text-left">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--exito)]">
                <BadgeCheck className="size-4 shrink-0" />
                Emitido por el sistema de Talento Humano
              </p>

              <dl className="space-y-2 text-sm">
                <Fila
                  etiqueta="Consecutivo"
                  valor={<span className="font-semibold tabular">{resultado.consecutivo}</span>}
                />
                <Fila etiqueta="Trámite" valor={resultado.tramite} />
                <Fila etiqueta="Formato" valor={resultado.formato} />
                <Fila etiqueta="Solicitante" valor={resultado.solicitante} />
                <Fila etiqueta="Área o servicio" valor={resultado.area} />
                <Fila
                  etiqueta="Periodo"
                  valor={
                    <>
                      {formatearFecha(resultado.fecha_inicio)}
                      {resultado.fecha_fin !== resultado.fecha_inicio &&
                        ` → ${formatearFecha(resultado.fecha_fin)}`}
                    </>
                  }
                />
                <Fila
                  etiqueta="Estado"
                  valor={
                    <span className="font-semibold">
                      {ETIQUETA_ESTADO[resultado.estado as Estado] ?? resultado.estado}
                    </span>
                  }
                />
                <Fila
                  etiqueta="Autorizó el jefe directo"
                  valor={resultado.autorizado_por_jefe ? 'Sí' : 'No'}
                />
                <Fila
                  etiqueta="Visto bueno de Talento Humano"
                  valor={resultado.autorizado_por_th ? 'Sí' : 'No'}
                />
              </dl>
            </Card>

            <p className="text-xs text-muted-foreground">
              Esta consulta no revela la justificación ni los soportes de la solicitud.
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
