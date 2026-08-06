import { useEffect, useState } from 'react'
import { AlertCircle, Save } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  useActualizarPerfil,
  useGestionarCuenta,
  type PerfilAdmin,
} from '@/application/admin/usePerfiles'
import { useAreas, useCargos, useCoordinadores, useEmpresas } from '@/application/catalogos/useCatalogos'
import { Button } from '@/presentation/components/ui/button'
import { Input } from '@/presentation/components/ui/input'
import { Label } from '@/presentation/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select'

const TIPOS_DOCUMENTO = [
  { valor: 'CC', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'CE', etiqueta: 'Cédula de extranjería' },
  { valor: 'PA', etiqueta: 'Pasaporte' },
  { valor: 'PEP', etiqueta: 'Permiso especial de permanencia' },
  { valor: 'TI', etiqueta: 'Tarjeta de identidad' },
]

const SIN_ASIGNAR = '__sin__'

const texto = (v: string) => v.trim() || null
const numero = (v: string) => (v === SIN_ASIGNAR ? null : Number(v))
const opcion = (v: number | null | undefined) => (v == null ? SIN_ASIGNAR : String(v))

/**
 * Mantenimiento de una cuenta ya creada.
 *
 * Antes estos datos solo se podían escribir una vez, al validar el registro,
 * así que cualquier corrección posterior —un cambio de servicio, una cédula
 * mal tecleada— acababa en una consulta SQL a mano. Es la mitad que faltaba
 * del CRUD de usuarios.
 *
 * El correo se guarda por separado del resto: los demás campos son un UPDATE
 * normal sobre `permisos_perfiles`, pero el correo vive también en
 * `auth.users` —es con lo que se inicia sesión— y solo la Edge Function puede
 * tocarlo. Se manda primero, porque si falla no tiene sentido haber cambiado
 * lo demás.
 */
export function DialogoEditarUsuario({
  perfil,
  onCerrar,
}: {
  perfil: PerfilAdmin | null
  onCerrar: () => void
}) {
  const { perfil: yo } = useAuth()
  const actualizar = useActualizarPerfil()
  const cuenta = useGestionarCuenta()

  const { data: empresas } = useEmpresas()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: coordinadores } = useCoordinadores()

  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    telefono: '',
    tipoDocumento: 'CC',
    documento: '',
    fechaIngreso: '',
    empresaId: SIN_ASIGNAR,
    areaId: SIN_ASIGNAR,
    cargoId: SIN_ASIGNAR,
    coordinadorId: SIN_ASIGNAR,
  })
  const [error, setError] = useState<string | null>(null)

  // Cambiar el correo es reasignar el inicio de sesión, así que se restringe a
  // quien administra. El analista corrige el resto de la ficha.
  const puedeCambiarCorreo = yo?.rol === 'administrador'

  useEffect(() => {
    if (!perfil) return
    setError(null)
    setForm({
      nombre: perfil.nombre ?? '',
      correo: perfil.correo ?? '',
      telefono: perfil.telefono ?? '',
      tipoDocumento: perfil.tipo_documento ?? 'CC',
      documento: perfil.documento ?? '',
      fechaIngreso: perfil.fecha_ingreso ?? '',
      empresaId: opcion(perfil.empresa_id),
      areaId: opcion(perfil.area_id),
      cargoId: opcion(perfil.cargo_id),
      coordinadorId: opcion(perfil.coordinador_id),
    })
  }, [perfil])

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  const guardando = actualizar.isPending || cuenta.isPending

  async function guardar() {
    if (!perfil) return
    setError(null)

    if (!form.nombre.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }

    const correo = form.correo.trim().toLowerCase()
    if (!correo.includes('@')) {
      setError('Escribe un correo válido.')
      return
    }

    try {
      if (puedeCambiarCorreo && correo !== perfil.correo.toLowerCase()) {
        await cuenta.mutateAsync({ accion: 'cambiar_correo', userId: perfil.user_id, correo })
      }

      await actualizar.mutateAsync({
        userId: perfil.user_id,
        datos: {
          nombre: form.nombre.trim(),
          tipo_documento: form.tipoDocumento,
          documento: texto(form.documento),
          telefono: texto(form.telefono),
          fecha_ingreso: texto(form.fechaIngreso),
          empresa_id: numero(form.empresaId),
          area_id: numero(form.areaId),
          cargo_id: numero(form.cargoId),
          coordinador_id: numero(form.coordinadorId),
        },
      })

      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible guardar los cambios.')
    }
  }

  return (
    <Dialog open={Boolean(perfil)} onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 [&>button]:text-white/80 [&>button]:hover:bg-white/20 [&>button]:hover:text-white">
        <DialogHeader className="franja-institucional gap-1 p-5 pr-12">
          <DialogTitle className="text-white">Editar usuario</DialogTitle>
          <DialogDescription className="text-white/80">
            El rol y el estado se cambian desde la tabla. Aquí van los datos de la ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-4 gap-y-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="e-nombre">Nombre y apellido *</Label>
            <Input
              id="e-nombre"
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-telefono">Teléfono</Label>
            <Input
              id="e-telefono"
              inputMode="tel"
              value={form.telefono}
              onChange={(e) => set('telefono', e.target.value)}
            />
          </div>

          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="e-correo">Correo electrónico *</Label>
            <Input
              id="e-correo"
              type="email"
              value={form.correo}
              disabled={!puedeCambiarCorreo}
              onChange={(e) => set('correo', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {puedeCambiarCorreo
                ? 'Es también el usuario con el que inicia sesión. Si esta persona coordina un servicio, revisa que coincida con su correo en «Jefes directos».'
                : 'Solo el administrador puede cambiarlo: es el usuario con el que se inicia sesión.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-ingreso">Fecha de ingreso</Label>
            <Input
              id="e-ingreso"
              type="date"
              value={form.fechaIngreso}
              onChange={(e) => set('fechaIngreso', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-tipodoc">Tipo de documento</Label>
            <Select value={form.tipoDocumento} onValueChange={(v) => set('tipoDocumento', v)}>
              <SelectTrigger id="e-tipodoc">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-doc">N.° de identificación</Label>
            <Input
              id="e-doc"
              inputMode="numeric"
              value={form.documento}
              onChange={(e) => set('documento', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-empresa">Empresa</Label>
            <Select value={form.empresaId} onValueChange={(v) => set('empresaId', v)}>
              <SelectTrigger id="e-empresa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                {(empresas ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-area">Proceso o área</Label>
            <Select value={form.areaId} onValueChange={(v) => set('areaId', v)}>
              <SelectTrigger id="e-area">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                {(areas ?? []).map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-cargo">Cargo</Label>
            <Select value={form.cargoId} onValueChange={(v) => set('cargoId', v)}>
              <SelectTrigger id="e-cargo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                {(cargos ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-jefe">Jefe directo</Label>
            <Select value={form.coordinadorId} onValueChange={(v) => set('coordinadorId', v)}>
              <SelectTrigger id="e-jefe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                {(coordinadores ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre} · {c.cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-[var(--error-suave)] p-3 text-sm text-[var(--error)] sm:col-span-2 lg:col-span-3"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-muted/40 p-4">
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button cargando={guardando} onClick={() => void guardar()}>
            {!guardando && <Save />} Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
