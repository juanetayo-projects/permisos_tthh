import { describe, expect, it } from 'vitest'
import { fortalezaClave } from '@/domain/clave'

describe('fortaleza de la contraseña', () => {
  it('marca como no válida la que no llega a ocho caracteres', () => {
    const r = fortalezaClave('Ab1*')
    expect(r.cumpleMinimo).toBe(false)
    expect(r.nivel).toBeLessThanOrEqual(1)
    expect(r.sugerencia).toMatch(/8 caracteres/)
  })

  it('no dice nada cuando el campo está vacío', () => {
    const r = fortalezaClave('')
    expect(r.nivel).toBe(0)
    expect(r.sugerencia).toBeNull()
  })

  it('sube de nivel al combinar longitud y clases de carácter', () => {
    const corta = fortalezaClave('permanote')          // 9, solo minúsculas
    const media = fortalezaClave('Permanote7')         // 10, tres clases
    const larga = fortalezaClave('Permanote7Vidrio')   // 16, tres clases
    const completa = fortalezaClave('Permanote7Vidrio*')

    expect(corta.nivel).toBeLessThan(media.nivel)
    expect(media.nivel).toBeLessThan(larga.nivel)
    expect(completa.nivel).toBe(4)
    expect(completa.sugerencia).toBeNull()
  })

  it('degrada las secuencias y las repeticiones por larga que sea la clave', () => {
    // Justo el caso que el medidor tiene que señalar: parece fuerte y no lo es.
    expect(fortalezaClave('Abcdefgh1234*').nivel).toBeLessThanOrEqual(1)
    expect(fortalezaClave('Clinicaaaa1111*').nivel).toBeLessThanOrEqual(1)
    expect(fortalezaClave('Qwertyuiop1*').nivel).toBeLessThanOrEqual(1)
  })

  it('degrada las palabras obvias del entorno de la clínica', () => {
    expect(fortalezaClave('SantaBarbara2026*').nivel).toBeLessThanOrEqual(1)
    expect(fortalezaClave('Password2026*').nivel).toBeLessThanOrEqual(1)
  })

  it('degrada la clave que repite datos del propio formulario', () => {
    const contexto = ['Juan Carlos Etayo', 'etayojuanc@gmail.com', '1098765432']

    // El apellido está en el nombre y en el correo: adivinable con el directorio.
    expect(fortalezaClave('Etayo2026Segura*', contexto).nivel).toBeLessThanOrEqual(1)
    // La misma forma sin el dato propio sí califica alto.
    expect(fortalezaClave('Vidrio2026Segura*', contexto).nivel).toBeGreaterThanOrEqual(3)
  })

  it('ignora los trozos de menos de cuatro letras del contexto', () => {
    // «Ana» es demasiado corto para descartar toda una clave larga.
    expect(fortalezaClave('Ana*Trueno19Faro', ['Ana Ruiz']).nivel).toBeGreaterThanOrEqual(3)
  })
})
