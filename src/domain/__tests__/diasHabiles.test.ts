import { describe, expect, it } from 'vitest'
import { esDiaHabil, esFestivo, esFinDeSemana, siguienteDiaHabil } from '@/domain/festivos'

describe('fechas de una solicitud', () => {
  it('reconoce el fin de semana', () => {
    // 2026-08-01 es sábado y 2026-08-02 domingo.
    expect(esFinDeSemana('2026-08-01')).toBe(true)
    expect(esFinDeSemana('2026-08-02')).toBe(true)
    expect(esFinDeSemana('2026-08-03')).toBe(false)
  })

  it('reconoce los festivos colombianos con Ley Emiliani', () => {
    // San Pedro y San Pablo se traslada al lunes siguiente.
    expect(esFestivo('2026-01-01')).toBe(true)
    expect(esFestivo('2026-08-07')).toBe(true) // Batalla de Boyacá, fecha fija
  })

  it('un sábado se corre al lunes', () => {
    expect(siguienteDiaHabil('2026-08-01')).toBe('2026-08-03')
  })

  it('un domingo también', () => {
    expect(siguienteDiaHabil('2026-08-02')).toBe('2026-08-03')
  })

  it('salta el festivo cuando cae pegado al fin de semana', () => {
    // Viernes 7 de agosto es festivo; desde el jueves 6 el siguiente hábil es
    // el lunes 10, porque el 8 y el 9 son sábado y domingo.
    expect(siguienteDiaHabil('2026-08-06')).toBe('2026-08-10')
  })

  it('avanza estrictamente: nunca devuelve el mismo día', () => {
    // Contrato de `siguienteDiaHabil`, y por eso el selector de fecha solo la
    // llama cuando la elegida NO es hábil: si la llamara siempre, correría un
    // día perfectamente válido al siguiente.
    expect(esDiaHabil('2026-08-03')).toBe(true)
    expect(siguienteDiaHabil('2026-08-03')).toBe('2026-08-04')
  })
})
