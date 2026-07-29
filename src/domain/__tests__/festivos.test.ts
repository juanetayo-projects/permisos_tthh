import { describe, expect, it } from 'vitest'
import {
  contarDiasHabiles,
  esDiaHabil,
  esFestivo,
  festivosDe,
  siguienteDiaHabil,
  sumarDiasHabiles,
} from '../festivos'

describe('festivos de Colombia', () => {
  it('reconoce los festivos fijos, que no se trasladan', () => {
    expect(esFestivo('2026-01-01')).toBe(true) // Año Nuevo
    expect(esFestivo('2026-05-01')).toBe(true) // Día del Trabajo
    expect(esFestivo('2026-07-20')).toBe(true) // Independencia
    expect(esFestivo('2026-12-25')).toBe(true) // Navidad
  })

  it('traslada al lunes siguiente los festivos de Ley Emiliani', () => {
    // Reyes cae martes 6 de enero de 2026 y se traslada al lunes 12.
    expect(esFestivo('2026-01-06')).toBe(false)
    expect(esFestivo('2026-01-12')).toBe(true)
  })

  it('calcula la Semana Santa a partir del Computus', () => {
    // Pascua de 2026: domingo 5 de abril.
    expect(esFestivo('2026-04-02')).toBe(true) // Jueves Santo
    expect(esFestivo('2026-04-03')).toBe(true) // Viernes Santo
    expect(esFestivo('2026-04-05')).toBe(false) // El domingo de Pascua no es festivo de ley
  })

  it('produce 18 festivos en un año normal', () => {
    expect(festivosDe(2026).size).toBe(18)
  })

  it('produce 17 en 2025, cuando dos festivos caen el mismo día', () => {
    // San Pedro y San Pablo (domingo 29 de junio) se traslada al lunes 30,
    // que es justo el día en que cae el Sagrado Corazón. Colombia tuvo
    // efectivamente 17 festivos ese año.
    expect(festivosDe(2025).size).toBe(17)
    expect(esFestivo('2025-06-30')).toBe(true)
  })

  it('no considera hábiles los fines de semana ni los festivos', () => {
    expect(esDiaHabil('2026-01-10')).toBe(false) // sábado
    expect(esDiaHabil('2026-01-11')).toBe(false) // domingo
    expect(esDiaHabil('2026-01-12')).toBe(false) // festivo trasladado
    expect(esDiaHabil('2026-01-13')).toBe(true) // martes hábil
  })
})

describe('conteo de días hábiles', () => {
  /**
   * Este es el caso que trae el propio formato TH-F-005 diligenciado:
   * 6 días a disfrutar, del 2 al 9 de enero de 2026, presentándose a laborar
   * el 13. Es la evidencia de que Talento Humano cuenta días hábiles de lunes
   * a viernes y de que el reintegro salta el festivo de Reyes trasladado.
   */
  it('reproduce el ejemplo del formato TH-F-005', () => {
    expect(contarDiasHabiles('2026-01-02', '2026-01-09')).toBe(6)
    expect(siguienteDiaHabil('2026-01-09')).toBe('2026-01-13')
  })

  it('devuelve cero cuando el rango está invertido', () => {
    expect(contarDiasHabiles('2026-03-10', '2026-03-01')).toBe(0)
  })

  it('cuenta un solo día hábil cuando inicio y fin coinciden', () => {
    expect(contarDiasHabiles('2026-03-10', '2026-03-10')).toBe(1)
    expect(contarDiasHabiles('2026-03-14', '2026-03-14')).toBe(0) // sábado
  })

  it('suma días hábiles saltando fines de semana y festivos', () => {
    // Del viernes 9 de enero, 3 días hábiles: lunes 12 es festivo, así que
    // caen martes 13, miércoles 14 y jueves 15.
    expect(sumarDiasHabiles('2026-01-09', 3)).toBe('2026-01-15')
  })
})
