/**
 * Reglas sobre direcciones de correo.
 *
 * Viven en el dominio y no junto al registro porque son lógica pura: no
 * dependen de Supabase ni de React, así que se prueban sin credenciales ni
 * red. Tenerlas dentro de `application/auth/registro.ts` obligaba a cargar el
 * cliente de Supabase solo para comprobar un dominio, y eso hacía fallar las
 * pruebas en CI, donde no hay variables de entorno.
 */

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
