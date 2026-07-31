import { describe, expect, it } from 'vitest'
import {
  calcularDuracion,
  calcularVacaciones,
  evaluarAntelacion,
  evaluarSoporte,
  validarSaldos,
} from '../reglas'

describe('duración del permiso', () => {
  it('cuenta en horas cuando el permiso es de un solo día', () => {
    const d = calcularDuracion({
      fechaInicio: '2026-03-31',
      fechaFin: '2026-03-31',
      horaSalida: '08:00',
      horaRegreso: '12:00',
    })
    expect(d.horas).toBe(4)
    expect(d.dias).toBe(0.5)
  })

  it('reproduce el ejemplo diligenciado del formato TH-F-002', () => {
    // Salida 8:00 a. m., regreso 10:00 a. m.
    const d = calcularDuracion({
      fechaInicio: '2026-03-31',
      fechaFin: '2026-03-31',
      horaSalida: '08:00',
      horaRegreso: '10:00',
    })
    expect(d.horas).toBe(2)
    expect(d.dias).toBe(0.25)
  })

  it('cuenta en días cuando abarca varias jornadas', () => {
    const d = calcularDuracion({ fechaInicio: '2026-03-30', fechaFin: '2026-04-01' })
    expect(d.dias).toBe(3)
    expect(d.horas).toBe(24)
  })

  it('no devuelve horas negativas si el regreso es anterior a la salida', () => {
    const d = calcularDuracion({
      fechaInicio: '2026-03-31',
      fechaFin: '2026-03-31',
      horaSalida: '14:00',
      horaRegreso: '09:00',
    })
    expect(d.horas).toBe(0)
  })
})

describe('regla de antelación', () => {
  const ahora = new Date('2026-03-30T10:00:00Z')

  it('marca como extemporánea la solicitud del ejemplo real del cliente', () => {
    // Solicitud del 30/03 para un permiso el 31/03: 24 h, menos de las 48 exigidas.
    const r = evaluarAntelacion({
      fechaInicio: '2026-03-31',
      horaSalida: '08:00',
      ahora,
      antelacionMinima: 48,
      unidad: 'horas',
    })
    expect(r.extemporanea).toBe(true)
    expect(r.mensaje).toContain('extemporánea')
  })

  it('acepta sin marca la solicitud presentada con la antelación debida', () => {
    const r = evaluarAntelacion({
      fechaInicio: '2026-04-06',
      horaSalida: '08:00',
      ahora,
      antelacionMinima: 48,
      unidad: 'horas',
    })
    expect(r.extemporanea).toBe(false)
    expect(r.mensaje).toBeNull()
  })

  it('exime a calamidad y luto, que no pueden planearse', () => {
    const r = evaluarAntelacion({
      fechaInicio: '2026-03-30',
      ahora,
      antelacionMinima: 48,
      unidad: 'horas',
      exento: true,
    })
    expect(r.extemporanea).toBe(false)
    expect(r.exenta).toBe(true)
  })

  it('aplica la regla de 20 días para vacaciones', () => {
    const r = evaluarAntelacion({
      fechaInicio: '2026-04-05',
      ahora,
      antelacionMinima: 20,
      unidad: 'dias',
    })
    expect(r.extemporanea).toBe(true)

    const ok = evaluarAntelacion({
      fechaInicio: '2026-05-30',
      ahora,
      antelacionMinima: 20,
      unidad: 'dias',
    })
    expect(ok.extemporanea).toBe(false)
  })
})

describe('exigencia de soporte', () => {
  it('obliga a soporte posterior en cita médica de más de 2 días', () => {
    const r = evaluarSoporte({
      requiereSoportePrevio: false,
      requiereSoportePosterior: true,
      umbralDias: 2,
      diasPermiso: 3,
      fechaFin: '2026-03-31',
    })
    expect(r.previo).toBeNull()
    expect(r.posterior?.obligatorio).toBe(true)
    expect(r.posterior?.fechaLimite).not.toBeNull()
  })

  it('no lo obliga cuando el ausentismo no supera el umbral', () => {
    const r = evaluarSoporte({
      requiereSoportePrevio: false,
      requiereSoportePosterior: true,
      umbralDias: 2,
      diasPermiso: 1,
      fechaFin: '2026-03-31',
    })
    expect(r.posterior?.obligatorio).toBe(false)
    expect(r.posterior?.fechaLimite).toBeNull()
  })

  it('lo obliga siempre cuando el motivo no tiene umbral', () => {
    const r = evaluarSoporte({
      requiereSoportePrevio: false,
      requiereSoportePosterior: true,
      umbralDias: null,
      diasPermiso: 0.5,
      fechaFin: '2026-03-31',
    })
    expect(r.posterior?.obligatorio).toBe(true)
  })

  it('exige soporte previo cuando el tipo lo requiere', () => {
    const r = evaluarSoporte({
      requiereSoportePrevio: true,
      requiereSoportePosterior: false,
      diasPermiso: 1,
      fechaFin: '2026-03-31',
    })
    expect(r.previo?.obligatorio).toBe(true)
    expect(r.posterior).toBeNull()
  })

  it('exige los dos soportes cuando el motivo pide ambos', () => {
    // La combinación que antes era imposible: la función salía en el previo y
    // el posterior se perdía, por mucho que se configurara en Administración.
    const r = evaluarSoporte({
      requiereSoportePrevio: true,
      requiereSoportePosterior: true,
      umbralDias: null,
      diasPermiso: 0.5,
      fechaFin: '2026-03-31',
    })
    expect(r.previo?.obligatorio).toBe(true)
    expect(r.posterior?.obligatorio).toBe(true)
    expect(r.posterior?.fechaLimite).not.toBeNull()
  })

  it('no exige nada cuando el motivo no pide soporte', () => {
    const r = evaluarSoporte({
      requiereSoportePrevio: false,
      requiereSoportePosterior: false,
      diasPermiso: 1,
      fechaFin: '2026-03-31',
    })
    expect(r.previo).toBeNull()
    expect(r.posterior).toBeNull()
  })
})

describe('vacaciones', () => {
  it('reproduce el periodo del formato TH-F-005 diligenciado', () => {
    const r = calcularVacaciones({
      fechaInicio: '2026-01-02',
      fechaFin: '2026-01-09',
      diasADisfrutar: 6,
    })
    expect(r.diasHabiles).toBe(6)
    expect(r.fechaReintegro).toBe('2026-01-13')
    expect(r.coincide).toBe(true)
    expect(r.advertencia).toBeNull()
  })

  it('advierte, sin bloquear, cuando el saldo digitado no cuadra', () => {
    const r = calcularVacaciones({
      fechaInicio: '2026-01-02',
      fechaFin: '2026-01-09',
      diasADisfrutar: 8,
    })
    expect(r.coincide).toBe(false)
    expect(r.diferenciaConDigitado).toBe(2)
    expect(r.advertencia).toContain('Talento Humano')
  })

  it('valida la coherencia de los tres saldos del formato', () => {
    expect(validarSaldos({ diasCorresponden: 15, diasADisfrutar: 6, diasPendientes: 9 }).coherente)
      .toBe(true)

    const malo = validarSaldos({ diasCorresponden: 15, diasADisfrutar: 6, diasPendientes: 5 })
    expect(malo.coherente).toBe(false)
    expect(malo.advertencia).toContain('11')
  })

  it('no se queja si aún faltan saldos por digitar', () => {
    expect(validarSaldos({ diasCorresponden: null, diasADisfrutar: 6, diasPendientes: 9 }).coherente)
      .toBe(true)
  })
})
