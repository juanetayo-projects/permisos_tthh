import { supabase, URL_APP } from '@/infrastructure/supabase/client'
import { dominioPermitido, ErrorDominioNoPermitido } from '@/domain/correo'

// Se reexportan para no romper a quien ya las importaba desde aquí.
export { dominioDe, dominioPermitido, ErrorDominioNoPermitido } from '@/domain/correo'

/**
 * El correo ya tiene cuenta en el proyecto de Supabase.
 *
 * Supabase responde 200 al registrar un correo existente y **no envía ningún
 * correo**, para no revelar qué direcciones están dadas de alta. Sin este
 * error, la pantalla decía «revisa tu correo» por un mensaje que nunca iba a
 * llegar. Pasa más de lo que parece porque el proyecto es el mismo de Cambio
 * de Turnos: quien ya tenga cuenta allí, la tiene aquí.
 */
export class ErrorCorreoYaRegistrado extends Error {
  constructor() {
    super('Ese correo ya tiene una cuenta.')
    this.name = 'ErrorCorreoYaRegistrado'
  }
}

export interface DatosRegistro {
  nombre: string
  correo: string
  clave: string
  tipoDocumento: string
  documento: string
  telefono?: string
  empresaId: number
  areaId: number
  cargoId: number
}

/**
 * Alta de un colaborador.
 *
 * Los datos del perfil viajan en `user_metadata` porque el usuario todavía no
 * está autenticado y las policies de `permisos_perfiles` exigen `auth.uid()`.
 * La fila del perfil se crea en el primer inicio de sesión, ya confirmado
 * (ver `asegurarPerfil`), y nace en `pendiente_validacion` para que Talento
 * Humano confirme el área y el coordinador antes de habilitar solicitudes.
 */
export async function registrar(datos: DatosRegistro, dominios: string[] = []): Promise<void> {
  const correo = datos.correo.trim().toLowerCase()

  if (!dominioPermitido(correo, dominios)) {
    throw new ErrorDominioNoPermitido(dominios)
  }

  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: datos.clave,
    options: {
      emailRedirectTo: `${URL_APP}#/bienvenida`,
      data: {
        nombre: datos.nombre.trim(),
        tipo_documento: datos.tipoDocumento,
        documento: datos.documento.trim(),
        telefono: datos.telefono?.trim() || null,
        empresa_id: datos.empresaId,
        area_id: datos.areaId,
        cargo_id: datos.cargoId,
        app: 'permisos_tthh',
      },
    },
  })

  if (error) throw error

  // Alta repetida: Supabase devuelve el usuario con la lista de identidades
  // vacía en vez de un error, y no manda correo. Es la única señal disponible.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    throw new ErrorCorreoYaRegistrado()
  }
}

export async function enviarRecuperacion(correo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(correo.trim().toLowerCase(), {
    redirectTo: `${URL_APP}#/establecer-clave`,
  })
  if (error) throw error
}

export async function establecerClave(clave: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: clave })
  if (error) throw error
}
