import { describe, expect, it } from 'vitest'
import {
  evaluarCupo,
  evaluarDuracion,
  evaluarSoporte,
  fechaLimiteSoporte,
  periodoDe,
  rangoFechasPermitido,
} from '@/domain/reglas'

describe('ventana de fechas por motivo', () => {
  it('una incapacidad se puede registrar hacia atrás', () => {
    // El caso que no se podía capturar: incapacidad expedida el viernes y
    // reportada el lunes.
    const r = rangoFechasPermitido({ diasMaxRetroactivo: 30, diasMaxFuturo: 30 }, '2026-08-01')

    expect(r.min).toBe('2026-07-02')
    expect(r.max).toBe('2026-08-31')
    expect(r.ayuda).toContain('30 días hacia atrás')
  })

  it('una diligencia personal no admite fechas pasadas', () => {
    const r = rangoFechasPermitido({ diasMaxRetroactivo: 0, diasMaxFuturo: 90 }, '2026-08-01')

    expect(r.min).toBe('2026-08-01')
    expect(r.ayuda).toContain('No admite fechas anteriores a hoy')
  })

  it('sin tope hacia adelante el máximo queda abierto', () => {
    const r = rangoFechasPermitido({ diasMaxRetroactivo: 0, diasMaxFuturo: null }, '2026-08-01')
    expect(r.max).toBeNull()
  })

  it('sin motivo elegido se mantiene el comportamiento conservador', () => {
    const r = rangoFechasPermitido(null, '2026-08-01')
    expect(r.min).toBe('2026-08-01')
    expect(r.max).toBeNull()
  })
})

describe('duración máxima', () => {
  it('avisa cuando el luto pasa de cinco días', () => {
    const r = evaluarDuracion({ duracionMaximaDias: 5 }, 8)
    expect(r.excede).toBe(true)
    expect(r.mensaje).toContain('hasta 5 días')
  })

  it('no avisa dentro del tope', () => {
    expect(evaluarDuracion({ duracionMaximaDias: 5 }, 5).excede).toBe(false)
  })

  it('un motivo sin tope nunca excede', () => {
    expect(evaluarDuracion({ duracionMaximaDias: null }, 400).excede).toBe(false)
  })
})

describe('cupo por periodo', () => {
  it('el día de la familia es uno por semestre', () => {
    const r = evaluarCupo({
      reglas: { maxPorPeriodo: 1, periodoControl: 'semestre' },
      fechaInicio: '2026-08-20',
      previas: ['2026-09-10'],
    })

    expect(r.excedido).toBe(true)
    expect(r.mensaje).toContain('este semestre')
  })

  it('el consumo del primer semestre no gasta el del segundo', () => {
    const r = evaluarCupo({
      reglas: { maxPorPeriodo: 1, periodoControl: 'semestre' },
      fechaInicio: '2026-08-20',
      previas: ['2026-03-10'],
    })

    expect(r.excedido).toBe(false)
    expect(r.usados).toBe(0)
  })

  it('sin control de periodo no hay cupo que agotar', () => {
    const r = evaluarCupo({
      reglas: { maxPorPeriodo: null, periodoControl: 'ninguno' },
      fechaInicio: '2026-08-20',
      previas: ['2026-08-01', '2026-08-05'],
    })

    expect(r.excedido).toBe(false)
    expect(r.mensaje).toBeNull()
  })

  it('etiqueta el periodo según el control', () => {
    expect(periodoDe('2026-03-15', 'semestre')).toBe('2026-S1')
    expect(periodoDe('2026-07-15', 'semestre')).toBe('2026-S2')
    expect(periodoDe('2026-07-15', 'mes')).toBe('2026-07')
    expect(periodoDe('2026-07-15', 'anio')).toBe('2026')
  })
})

describe('plazo del soporte posterior', () => {
  it('el plazo del motivo manda sobre el global', () => {
    // Incapacidad: 3 días hábiles desde el viernes 31 de julio de 2026 →
    // lunes 3, martes 4 y miércoles 5 de agosto.
    expect(
      fechaLimiteSoporte({ fechaFin: '2026-07-31', plazoDelMotivo: 3, plazoDiasHabiles: 5 })
    ).toBe('2026-08-05')
  })

  it('los plazos largos se cuentan en días calendario', () => {
    // Certificado electoral: un mes desde la votación (Ley 403 de 1997). En
    // hábiles, treinta días serían casi mes y medio.
    expect(
      fechaLimiteSoporte({ fechaFin: '2026-07-31', plazoDelMotivo: 30, plazoEnHabiles: false })
    ).toBe('2026-08-30')
  })

  it('sin plazo propio se usa el parámetro global', () => {
    // 5 días hábiles desde el viernes 31 de julio de 2026: 3, 4, 5 y 6 de
    // agosto, y el quinto salta al lunes 10 porque el viernes 7 es la Batalla
    // de Boyacá, festivo fijo que no se traslada.
    expect(fechaLimiteSoporte({ fechaFin: '2026-07-31', plazoDiasHabiles: 5 })).toBe('2026-08-10')
  })

  it('evaluarSoporte propaga el plazo del motivo', () => {
    const r = evaluarSoporte({
      requiereSoportePrevio: false,
      requiereSoportePosterior: true,
      umbralDias: null,
      diasPermiso: 1,
      fechaFin: '2026-07-31',
      plazoDiasHabiles: 5,
      plazoDelMotivo: 30,
      plazoEnHabiles: false,
    })

    expect(r.posterior?.fechaLimite).toBe('2026-08-30')
  })
})
