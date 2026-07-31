import { useState } from 'react'
import { AlertCircle, UserPlus } from 'lucide-react'
import { useAuth } from '@/application/auth/AuthProvider'
import {
  useCrearUsuario,
  type DatosNuevoUsuario,
  type ResultadoAlta,
} from '@/application/admin/usePerfiles'
import { useAreas, useCargos, useCoordinadores, useEmpresas } from '@/application/catalogos/useCatalogos'
import { ETIQUETA_ROL, ROLES, type Rol } from '@/domain/estados'
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
]

const SIN_ASIGNAR = '__sin__'

const VACIO = {
  nombre: '',
  correo: '',
  tipoDocumento: 'CC',
  documento: '',
  telefono: '',
  empresaId: SIN_ASIGNAR,
  areaId: SIN_ASIGNAR,
  cargoId: SIN_ASIGNAR,
  coordinadorId: SIN_ASIGNAR,
  rol: 'colaborador' as Rol,
}

const numero = (v: string) => (v === SIN_ASIGNAR ? null : Number(v))

/**
 * Alta de un colaborador sin pasar por el autorregistro.
 *
 * El autorregistro obliga a que la persona se dé de alta y luego alguien
 * valide sus datos, y ese segundo paso es el cuello de botella: hasta que
 * Talento Humano lo hace, la persona no puede solicitar nada. Creando la
 * cuenta desde aquí, quien valida y quien da de alta son la misma persona, así
 * que nace lista para usarse.
 *
 * No se pide contraseña: la define la propia persona con el enlace que recibe.
 */
export function DialogoNuevoUsuario({
  abierto,
  onCerrar,
}: {
  abierto: boolean
  onCerrar: () => void
}) {
  const { perfil: yo } = useAuth()
  const crear = useCrearUsuario()

  const { data: empresas } = useEmpresas()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: coordinadores } = useCoordinadores()

  const [form, setForm] = useState(VACIO)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<ResultadoAlta | null>(null)

  // Solo el administrador reparte roles; a Talento Humano se le oculta el
  // campo, aunque quien lo impide de verdad es la propia Edge Function.
  const puedeElegirRol = yo?.rol === 'administrador'

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function cerrar() {
    setForm(VACIO)
    setError(null)
    setListo(null)
    onCerrar()
  }

  async function guardar() {
    setError(null)

    if (!form.nombre.trim() || !form.correo.includes('@')) {
      setError('Escribe el nombre y un correo válido.')
      return
    }

    const datos: DatosNuevoUsuario = {
      nombre: form.nombre.trim(),
      correo: form.correo.trim().toLowerCase(),
      tipo_documento: form.tipoDocumento,
      documento: form.documento.trim() || null,
      telefono: form.telefono.trim() || null,
      empresa_id: numero(form.empresaId),
      area_id: numero(form.areaId),
      cargo_id: numero(form.cargoId),
      coordinador_id: numero(form.coordinadorId),
      rol: puedeElegirRol ? form.rol : 'colaborador',
    }

    try {
      setListo(await crear.mutateAsync(datos))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible crear el usuario.')
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && !crear.isPending && cerrar()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {listo ? (
          <>
            <DialogHeader>
              <DialogTitle>Cuenta creada</DialogTitle>
              <DialogDescription>
                <strong>{form.nombre}</strong> ya puede entrar y registrar solicitudes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              <p className="rounded-md bg-[var(--exito-suave)] p-3 text-[var(--exito)]">
                {listo.correo_enviado
                  ? `Le enviamos a ${form.correo} un enlace para que defina su contraseña.`
                  : 'La cuenta quedó lista, pero el correo de bienvenida no salió. Dile que use «¿Olvidaste tu contraseña?» con este correo.'}
              </p>

              {listo.ya_existia && (
                <p className="rounded-md bg-[var(--tinte-ambar)] p-3 text-[var(--acento-ambar)]">
                  Ese correo ya tenía cuenta en Cambio de Turnos. Se reutilizó, así que entrará con
                  la contraseña que ya usa allí.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setListo(null)}>
                Crear otro
              </Button>
              <Button onClick={cerrar}>Cerrar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5" /> Nuevo usuario
              </DialogTitle>
              <DialogDescription>
                La cuenta queda activa de inmediato. No hace falta que la persona se registre ni
                esperar una validación posterior.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="n-nombre">Nombre y apellido *</Label>
                <Input
                  id="n-nombre"
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="n-correo">Correo electrónico *</Label>
                <Input
                  id="n-correo"
                  type="email"
                  value={form.correo}
                  onChange={(e) => set('correo', e.target.value)}
                  placeholder="nombre.apellido@cacsantabarbara.co"
                />
                <p className="text-xs text-muted-foreground">
                  A esta dirección llega el enlace para definir la contraseña. Puede ser personal.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="n-tipodoc">Tipo de documento</Label>
                <Select value={form.tipoDocumento} onValueChange={(v) => set('tipoDocumento', v)}>
                  <SelectTrigger id="n-tipodoc">
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
                <Label htmlFor="n-doc">N.° de identificación</Label>
                <Input
                  id="n-doc"
                  inputMode="numeric"
                  value={form.documento}
                  onChange={(e) => set('documento', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="n-empresa">Empresa</Label>
                <Select value={form.empresaId} onValueChange={(v) => set('empresaId', v)}>
                  <SelectTrigger id="n-empresa">
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
                <Label htmlFor="n-telefono">Teléfono</Label>
                <Input
                  id="n-telefono"
                  inputMode="tel"
                  value={form.telefono}
                  onChange={(e) => set('telefono', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="n-area">Proceso o área</Label>
                <Select value={form.areaId} onValueChange={(v) => set('areaId', v)}>
                  <SelectTrigger id="n-area">
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
                <Label htmlFor="n-cargo">Cargo</Label>
                <Select value={form.cargoId} onValueChange={(v) => set('cargoId', v)}>
                  <SelectTrigger id="n-cargo">
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

              <div className={puedeElegirRol ? 'space-y-1.5' : 'space-y-1.5 sm:col-span-2'}>
                <Label htmlFor="n-jefe">Jefe directo</Label>
                <Select value={form.coordinadorId} onValueChange={(v) => set('coordinadorId', v)}>
                  <SelectTrigger id="n-jefe">
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
                <p className="text-xs text-muted-foreground">
                  Puede quedar sin asignar: se elige al crear cada solicitud.
                </p>
              </div>

              {puedeElegirRol && (
                <div className="space-y-1.5">
                  <Label htmlFor="n-rol">Rol</Label>
                  <Select value={form.rol} onValueChange={(v) => set('rol', v as Rol)}>
                    <SelectTrigger id="n-rol">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ETIQUETA_ROL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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

            <DialogFooter>
              <Button variant="ghost" onClick={cerrar} disabled={crear.isPending}>
                Cancelar
              </Button>
              <Button cargando={crear.isPending} onClick={() => void guardar()}>
                {!crear.isPending && <UserPlus />} Crear usuario
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
