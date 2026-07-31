import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/infrastructure/supabase/client'

/**
 * Apertura de los enlaces que llegan por correo (recuperación, confirmación).
 *
 * Hay dos formas de enlace y la app tiene que entender las dos:
 *
 * - `?token_hash=…&type=recovery` — la plantilla apunta directo a la app y
 *   aquí se canjea con `verifyOtp`. **Es la buena**: no depende de nada
 *   guardado en el navegador, así que funciona aunque la persona abra el
 *   correo en el móvil y la app estuviera en el computador.
 * - `?code=…` — el enlace pasó antes por `/auth/v1/verify` y volvió con un
 *   código PKCE. Solo se puede canjear en el **mismo navegador** que pidió el
 *   cambio, porque el `code_verifier` vive en su `localStorage`. Si no está,
 *   `auth-js` ni siquiera intenta el canje y la pantalla se quedaba en
 *   «enlace no válido» sin explicar por qué.
 */
export type ResultadoEnlace =
  /** La URL no traía enlace; puede haber sesión de antes. */
  | 'sin-enlace'
  /** Sesión establecida: se puede cambiar la contraseña. */
  | 'listo'
  /** Código PKCE sin verificador: se abrió en otro navegador. */
  | 'otro-navegador'
  /** Caducado, ya usado o manipulado. */
  | 'invalido'

/** Los únicos tipos que esta app envía por correo. */
const TIPOS: EmailOtpType[] = ['recovery', 'signup', 'invite', 'email_change', 'magiclink', 'email']

/**
 * Los parámetros pueden venir en dos sitios: Supabase cuelga `?code=` **antes**
 * del `#`, mientras que un enlace directo a una ruta del HashRouter los lleva
 * detrás (`#/establecer-clave?token_hash=…`). Se miran los dos.
 */
function parametrosDelEnlace(): URLSearchParams {
  const params = new URLSearchParams(window.location.search)

  const hash = window.location.hash
  const inicio = hash.indexOf('?')
  if (inicio >= 0) {
    for (const [clave, valor] of new URLSearchParams(hash.slice(inicio + 1))) {
      params.set(clave, valor)
    }
  }

  return params
}

/**
 * Deja la URL limpia conservando la ruta.
 *
 * Si el token se queda escrito, basta con recargar para reintentar uno que ya
 * se consumió, y la pantalla acusaría un enlace inválido que en realidad sí
 * funcionó. Tampoco conviene que quede en el historial del navegador.
 */
function limpiarUrl(): void {
  const hash = window.location.hash
  const inicio = hash.indexOf('?')
  const ruta = inicio >= 0 ? hash.slice(0, inicio) : hash

  window.history.replaceState({}, '', `${window.location.pathname}${ruta}`)
}

function faltaElVerificador(error: { name?: string; message?: string }): boolean {
  return (
    error.name === 'AuthPKCECodeVerifierMissingError' ||
    (error.message ?? '').toLowerCase().includes('code verifier')
  )
}

export async function completarEnlaceDeCorreo(): Promise<ResultadoEnlace> {
  const params = parametrosDelEnlace()

  if (params.get('error') || params.get('error_code')) {
    limpiarUrl()
    return 'invalido'
  }

  const tokenHash = params.get('token_hash')
  const tipo = params.get('type') as EmailOtpType | null

  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
    limpiarUrl()
    return error ? 'invalido' : 'listo'
  }

  const codigo = params.get('code')
  if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo)
    limpiarUrl()
    if (!error) return 'listo'
    return faltaElVerificador(error) ? 'otro-navegador' : 'invalido'
  }

  // Sin parámetros: o ya los consumió `detectSessionInUrl` al arrancar el
  // cliente, o se llegó a la pantalla por navegación normal.
  return 'sin-enlace'
}
