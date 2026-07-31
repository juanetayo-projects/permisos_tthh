import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyOtp = vi.fn()
const exchangeCodeForSession = vi.fn()

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    auth: {
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a),
    },
  },
  URL_APP: 'https://ejemplo.test/permisos_tthh/',
}))

const { completarEnlaceDeCorreo } = await import('@/application/auth/enlaceCorreo')

/** Coloca la URL del navegador como llegaría desde el correo. */
function enUrl(ruta: string) {
  window.history.replaceState({}, '', ruta)
}

describe('apertura del enlace de correo', () => {
  beforeEach(() => {
    verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null })
    exchangeCodeForSession.mockReset().mockResolvedValue({ data: {}, error: null })
    enUrl('/permisos_tthh/')
  })

  it('canjea el token_hash que viaja detrás de la ruta del HashRouter', async () => {
    enUrl('/permisos_tthh/#/establecer-clave?token_hash=abc123&type=recovery')

    await expect(completarEnlaceDeCorreo()).resolves.toBe('listo')
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'recovery' })
  })

  it('deja la ruta limpia para que recargar no reintente un token ya usado', async () => {
    enUrl('/permisos_tthh/#/establecer-clave?token_hash=abc123&type=recovery')

    await completarEnlaceDeCorreo()

    expect(window.location.hash).toBe('#/establecer-clave')
    expect(window.location.search).toBe('')
  })

  it('canjea el código PKCE, que Supabase cuelga antes del #', async () => {
    enUrl('/permisos_tthh/?code=3df9d7fe#/establecer-clave')

    await expect(completarEnlaceDeCorreo()).resolves.toBe('listo')
    expect(exchangeCodeForSession).toHaveBeenCalledWith('3df9d7fe')
  })

  it('distingue el código abierto en otro navegador de un enlace caducado', async () => {
    // Sin `code_verifier` en este navegador el canje es imposible; no es que el
    // enlace haya caducado, y el aviso al usuario tiene que ser distinto.
    enUrl('/permisos_tthh/?code=3df9d7fe#/establecer-clave')
    exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { name: 'AuthPKCECodeVerifierMissingError', message: 'code verifier should be non-empty' },
    })

    await expect(completarEnlaceDeCorreo()).resolves.toBe('otro-navegador')
  })

  it('da por inválido el token rechazado por Supabase', async () => {
    enUrl('/permisos_tthh/#/establecer-clave?token_hash=viejo&type=recovery')
    verifyOtp.mockResolvedValue({ data: {}, error: { message: 'Token has expired' } })

    await expect(completarEnlaceDeCorreo()).resolves.toBe('invalido')
  })

  it('da por inválido el enlace que ya trae un error de Supabase', async () => {
    enUrl('/permisos_tthh/#/establecer-clave?error=access_denied&error_code=otp_expired')

    await expect(completarEnlaceDeCorreo()).resolves.toBe('invalido')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('no toca nada si se entró a la pantalla por navegación normal', async () => {
    enUrl('/permisos_tthh/#/establecer-clave')

    await expect(completarEnlaceDeCorreo()).resolves.toBe('sin-enlace')
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('ignora un type que esta app no envía', async () => {
    enUrl('/permisos_tthh/#/establecer-clave?token_hash=abc&type=inventado')

    await expect(completarEnlaceDeCorreo()).resolves.toBe('sin-enlace')
    expect(verifyOtp).not.toHaveBeenCalled()
  })
})
