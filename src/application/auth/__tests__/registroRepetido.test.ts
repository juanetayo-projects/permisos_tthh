import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * El cliente real exige variables de entorno que no existen en CI, así que se
 * sustituye. Lo que se prueba aquí es la lectura de la respuesta de Supabase,
 * no la red.
 */
const signUp = vi.fn()

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: { auth: { signUp: (...args: unknown[]) => signUp(...args) } },
  URL_APP: 'https://ejemplo.test/',
}))

const { registrar, ErrorCorreoYaRegistrado } = await import('@/application/auth/registro')

const DATOS = {
  nombre: 'Pepito Pérez',
  correo: 'Etayojuanc@Gmail.com ',
  clave: 'Trueno19FaroAzul*',
  tipoDocumento: 'CC',
  documento: '1098765432',
  empresaId: 1,
  areaId: 2,
  cargoId: 3,
}

describe('alta de un colaborador', () => {
  beforeEach(() => signUp.mockReset())

  it('normaliza el correo antes de enviarlo', async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [{ id: 'x' }] } }, error: null })

    await registrar(DATOS)

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'etayojuanc@gmail.com' })
    )
  })

  it('avisa cuando el correo ya tiene cuenta', async () => {
    // Supabase no devuelve error en el alta repetida: manda el usuario con la
    // lista de identidades vacía y no envía ningún correo. Sin esta rama, la
    // pantalla decía «revisa tu correo» por un mensaje que nunca llegaría.
    signUp.mockResolvedValue({
      data: { user: { id: '1afc3ae8', identities: [] }, session: null },
      error: null,
    })

    await expect(registrar(DATOS)).rejects.toBeInstanceOf(ErrorCorreoYaRegistrado)
  })

  it('deja pasar el alta nueva, que sí trae identidad', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'nuevo', identities: [{ id: 'abc', provider: 'email' }] } },
      error: null,
    })

    await expect(registrar(DATOS)).resolves.toBeUndefined()
  })

  it('propaga el error de Supabase tal cual', async () => {
    signUp.mockResolvedValue({ data: { user: null }, error: new Error('rate limit exceeded') })

    await expect(registrar(DATOS)).rejects.toThrow(/rate limit/)
  })
})
