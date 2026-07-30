import { describe, expect, it } from 'vitest'
// Se importa del dominio y no de `registro.ts`: ese módulo carga el cliente de
// Supabase, que exige credenciales y hace fallar la prueba en CI.
import { dominioDe, dominioPermitido } from '@/domain/correo'

describe('dominio del correo', () => {
  it('extrae el dominio sin importar mayúsculas ni espacios', () => {
    expect(dominioDe('  Juan.Etayo@CacSantaBarbara.co ')).toBe('cacsantabarbara.co')
  })

  it('acepta cualquier dominio cuando la lista está vacía', () => {
    // Muchos colaboradores de la clínica no tienen correo institucional.
    expect(dominioPermitido('persona@gmail.com', [])).toBe(true)
    expect(dominioPermitido('persona@hotmail.com', [])).toBe(true)
    expect(dominioPermitido('persona@cacsantabarbara.co', [])).toBe(true)
  })

  it('restringe cuando la clínica configura una lista', () => {
    const permitidos = ['cacsantabarbara.co', 'geriater.co']
    expect(dominioPermitido('persona@cacsantabarbara.co', permitidos)).toBe(true)
    expect(dominioPermitido('persona@GERIATER.CO', permitidos)).toBe(true)
    expect(dominioPermitido('persona@gmail.com', permitidos)).toBe(false)
  })

  it('rechaza un correo sin dominio cuando hay lista', () => {
    expect(dominioPermitido('sinarroba', ['cacsantabarbara.co'])).toBe(false)
  })
})
