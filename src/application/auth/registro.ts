import { supabase, URL_APP } from '@/infrastructure/supabase/client'

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

export class ErrorDominioNoPermitido extends Error {
  constructor(dominios: string[]) {
    super(
      dominios.length === 1
        ? `Solo pueden registrarse los correos @${dominios[0]}.`
        : `Solo pueden registrarse los correos de estos dominios: ${dominios.map((d) => `@${d}`).join(', ')}.`
    )
    this.name = 'ErrorDominioNoPermitido'
  }
}

export function dominioDe(correo: string): string {
  return correo.trim().toLowerCase().split('@')[1] ?? ''
}

/**
 * Comprueba el dominio del correo contra la lista configurada.
 *
 * Muchos colaboradores de la clínica no tienen cuenta institucional y usan
 * correo personal, así que **la lista vacía acepta cualquier dominio**. Quien
 * decide si la persona entra es Talento Humano al validar el perfil, no el
 * dominio del correo.
 */
export function dominioPermitido(correo: string, dominios: string[]): boolean {
  if (dominios.length === 0) return true
  return dominios.map((d) => d.toLowerCase()).includes(dominioDe(correo))
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

  const { error } = await supabase.auth.signUp({
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
