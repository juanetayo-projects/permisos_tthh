import { describe, expect, it } from 'vitest'
import { formatearMoneda, soloDigitos } from '@/lib/utils'

/**
 * `Intl` separa el símbolo de la cifra con un espacio duro, y cuál en concreto
 * depende de la versión de ICU del runtime. Se normaliza cualquier espacio a
 * uno normal antes de comparar: lo que se está probando es el separador de
 * miles, no el carácter de espacio que emita cada Node.
 */
function normalizar(s: string): string {
  return s.replace(/\s/g, ' ')
}

describe('pesos colombianos', () => {
  it('separa los miles con punto', () => {
    // El caso reportado: 3500000 en pantalla es una tira ilegible.
    expect(normalizar(formatearMoneda(3_500_000))).toBe('$ 3.500.000')
  })

  it('no arrastra decimales', () => {
    expect(normalizar(formatearMoneda(1200))).toBe('$ 1.200')
    expect(normalizar(formatearMoneda(0))).toBe('$ 0')
  })

  it('sin valor no inventa un cero', () => {
    expect(formatearMoneda(null)).toBe('—')
    expect(formatearMoneda(undefined)).toBe('—')
    expect(formatearMoneda(Number.NaN)).toBe('—')
  })
})

describe('lectura de lo digitado', () => {
  it('se queda solo con los dígitos', () => {
    expect(soloDigitos('3500000')).toBe('3500000')
    expect(soloDigitos('3.500.000')).toBe('3500000')
  })

  it('acepta un importe pegado ya formateado', () => {
    // Copiar y pegar «$ 3.500.000» de un correo es lo más común, y rechazarlo
    // por traer puntos obligaría a reescribirlo a mano.
    expect(soloDigitos('$ 3.500.000')).toBe('3500000')
  })

  it('descarta letras y signos sueltos', () => {
    expect(soloDigitos('abc')).toBe('')
    expect(soloDigitos('-1.500')).toBe('1500')
  })
})
