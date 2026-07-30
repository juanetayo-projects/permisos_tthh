import { supabase, URL_APP } from '@/infrastructure/supabase/client'
import { dominioPermitido, ErrorDominioNoPermitido } from '@/domain/correo'

// Se reexportan para no romper a quien ya las importaba desde aquí.
export { dominioDe, dominioPermitido, ErrorDominioNoPermitido } from '@/domain/correo'

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
