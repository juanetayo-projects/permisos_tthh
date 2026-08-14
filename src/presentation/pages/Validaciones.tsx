import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, UserCheck, UserX } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import { usePerfiles, useValidarPerfil, type PerfilAdmin } from '@/application/admin/usePerfiles'
import { useAreas, useCargos, useCoordinadores, useEmpresas } from '@/application/catalogos/useCatalogos'
import { formatearFecha } from '@/lib/utils'
import { Button } from '@/presentation/components/ui/button'
import { Card } from '@/presentation/components/ui/card'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import { Skeleton } from '@/presentation/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

/**
 * Validación de colaboradores recién registrados (decisión D5).
 *
 * Es el control que sustituye al filtro por dominio de correo: como cualquiera
 * puede registrarse, aquí Talento Humano confirma identidad, área y jefe
 * directo antes de habilitar a la persona. Hasta entonces su cuenta no puede
 * crear solicitudes ni ver datos de nadie.
 */
export default function Validaciones() {
  const { session } = useAuth()
  const { data: pendientes, isLoading } = usePerfiles(true)
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: empresas } = useEmpresas()
  const { data: coordinadores } = useCoordinadores()
  const validar = useValidarPerfil()

  const [error, setError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
      <header className="franja-institucional rounded-xl px-4 py-3.5">
        <h1 className="text-xl font-semibold tracking-tight text-white">Validar colaboradores</h1>
        <p className="mt-1 text-sm text-white/70">
          Confirma los datos de quienes se registraron. Hasta que los valides, no pueden crear
          solicitudes.
        </p>
      </header>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {(pendientes ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="mx-auto size-8 text-[var(--exito)]" />
          <p className="mt-3 font-medium">No hay validaciones pendientes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando alguien cree una cuenta, aparecerá aquí para que confirmes sus datos.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {(pendientes ?? []).map((p) => (
            <FichaValidacion
              key={p.user_id}
              perfil={p}
              areas={areas}
              cargos={cargos}
              empresas={empresas}
              coordinadores={coordinadores}
              guardando={validar.isPending}
              onResolver={async (datos, estado) => {
                setError(null)
                try {
                  await validar.mutateAsync({
                    userId: p.user_id,
                    ...datos,
                    estado,
                    validadoPor: session!.user.id,
                  })
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'No fue posible guardar la validación.')
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface DatosValidacion {
  areaId: number | null
  cargoId: number | null
  empresaId: number | null
  coordinadorId: number | null
  documento: string | null
}

function FichaValidacion({
  perfil,
  areas,
  cargos,
  empresas,
  coordinadores,
  guardando,
  onResolver,
}: {
  perfil: PerfilAdmin
  areas?: { id: number; nombre: string }[]
  cargos?: { id: number; nombre: string }[]
  empresas?: { id: number; nombre: string }[]
  coordinadores?: { id: number; area_id: number | null; nombre: string | null; correo: string }[]
  guardando: boolean
  onResolver: (datos: DatosValidacion, estado: 'activo' | 'inactivo') => Promise<void>
}) {
  const [areaId, setAreaId] = useState(perfil.area_id ? String(perfil.area_id) : '')
  const [cargoId, setCargoId] = useState(perfil.cargo_id ? String(perfil.cargo_id) : '')
  const [empresaId, setEmpresaId] = useState(perfil.empresa_id ? String(perfil.empresa_id) : '')
  const [coordinadorId, setCoordinadorId] = useState(
    perfil.coordinador_id ? String(perfil.coordinador_id) : ''
  )
  const [documento, setDocumento] = useState(perfil.documento ?? '')

  // Al cambiar de área se propone su jefe directo, que es el caso habitual.
  useEffect(() => {
    if (!areaId) return
    const propuesto = coordinadores?.find((c) => String(c.area_id) === areaId)
    if (propuesto) setCoordinadorId(String(propuesto.id))
  }, [areaId, coordinadores])

  const datos: DatosValidacion = {
    areaId: areaId ? Number(areaId) : null,
    cargoId: cargoId ? Number(cargoId) : null,
    empresaId: empresaId ? Number(empresaId) : null,
    coordinadorId: coordinadorId ? Number(coordinadorId) : null,
    documento: documento.trim() || null,
  }

  const completo = Boolean(areaId && empresaId && documento.trim())

  return (
    <Card className="bloque-datos bloque-azul p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold">{perfil.nombre}</h2>
          <p className="text-sm text-muted-foreground">{perfil.correo}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Se registró el {formatearFecha(perfil.created_at.slice(0, 10))}
        </p>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`doc-${perfil.user_id}`}>N.° de identificación</Label>
          <Input
            id={`doc-${perfil.user_id}`}
            value={documento}
            inputMode="numeric"
            onChange={(e) => setDocumento(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`emp-${perfil.user_id}`}>Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger id={`emp-${perfil.user_id}`}>
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {empresas?.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`area-${perfil.user_id}`}>Área o servicio</Label>
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger id={`area-${perfil.user_id}`}>
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {areas?.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`cargo-${perfil.user_id}`}>Cargo</Label>
          <Select value={cargoId} onValueChange={setCargoId}>
            <SelectTrigger id={`cargo-${perfil.user_id}`}>
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {cargos?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 sm:col-span-2 lg:col-span-2">
          <Label htmlFor={`coord-${perfil.user_id}`}>Jefe directo</Label>
          <Select value={coordinadorId} onValueChange={setCoordinadorId}>
            <SelectTrigger id={`coord-${perfil.user_id}`}>
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {coordinadores?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre ?? c.correo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Es quien recibirá sus solicitudes. Se propone el del área, pero puedes cambiarlo.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          cargando={guardando}
          onClick={() => void onResolver(datos, 'inactivo')}
        >
          <UserX /> Rechazar acceso
        </Button>
        <Button
          variant="exito"
          size="sm"
          disabled={!completo}
          cargando={guardando}
          onClick={() => void onResolver(datos, 'activo')}
          title={completo ? undefined : 'Completa documento, empresa y área'}
        >
          <UserCheck /> Validar y habilitar
        </Button>
      </div>
    </Card>
  )
}
