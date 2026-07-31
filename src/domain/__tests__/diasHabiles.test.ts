import { describe, expect, it } from 'vitest'
import {
  diaDeLaSemana,
  diaDelMes,
  esDiaHabil,
  esFestivo,
  esFinDeSemana,
  siguienteDiaHabil,
} from '@/domain/festivos'

describe('lectura de una fecha sin que el huso la corra', () => {
  it('devuelve el día del mes que dice la cadena', () => {
    // El error que se vio en pantalla: la línea de tiempo etiquetaba el 4 de
    // agosto como «lunes 3». `desdeISO` construye la fecha en UTC y `getDate()`
    // la lee en hora local, que en Colombia va cinco horas por detrás.
    expect(diaDelMes('2026-08-04')).toBe(4)
    expect(diaDelMes('2026-01-01')).toBe(1)
    expect(diaDelMes('2026-12-31')).toBe(31)
  })

  it('devuelve el día de la semana correcto', () => {
    // 2026-08-04 es martes.
    expect(diaDeLaSemana('2026-08-04')).toBe(2)
    // 2026-08-01 sábado, 2026-08-02 domingo.
    expect(diaDeLaSemana('2026-08-01')).toBe(6)
    expect(diaDeLaSemana('2026-08-02')).toBe(0)
  })

  it('coincide con lo que dicen esFinDeSemana y esFestivo', () => {
    // Si la lectura del día se corriera, la tira de la línea de tiempo
    // pintaría de color el día equivocado.
    expect(esFinDeSemana('2026-08-01')).toBe(diaDeLaSemana('2026-08-01') === 6)
    expect(esFestivo('2026-08-07')).toBe(true)
    expect(diaDelMes('2026-08-07')).toBe(7)
  })
})

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
