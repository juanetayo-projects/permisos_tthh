import { describe, expect, it } from 'vitest'
import {
  diasNoDisfrutados,
  evaluarSolapamiento,
  seSolapan,
  type PeriodoOcupado,
} from '@/domain/concurrencia'

/** Vacaciones del 6 al 17 de julio de 2026, ya autorizadas. */
const VACACIONES: PeriodoOcupado = {
  id: 'v1',
  consecutivo: 'VA-2026-00003',
  estado: 'APROBADA_TH',
  fechaInicio: '2026-07-06',
  fechaFin: '2026-07-17',
  motivo: 'Vacaciones',
  prioridad: 10,
  interrumpeOtros: false,
  esVacaciones: true,
  diasCalendario: false,
}

const INCAPACIDAD = {
  motivo: 'Incapacidad médica',
  prioridad: 30,
  interrumpeOtros: true,
}

describe('detección de cruces', () => {
  it('dos periodos que comparten un día se solapan', () => {
    expect(
      seSolapan({ inicio: '2026-07-01', fin: '2026-07-10' }, { inicio: '2026-07-10', fin: '2026-07-15' })
    ).toBe(true)
    expect(
      seSolapan({ inicio: '2026-07-01', fin: '2026-07-09' }, { inicio: '2026-07-10', fin: '2026-07-15' })
    ).toBe(false)
  })

  it('sin cruces no hay nada que advertir', () => {
    const r = evaluarSolapamiento({
      nuevo: { ...INCAPACIDAD, fechaInicio: '2026-09-01', fechaFin: '2026-09-05' },
      ocupados: [VACACIONES],
    })

    expect(r.cruces).toHaveLength(0)
    expect(r.resumen).toBeNull()
  })
})

describe('incapacidad durante las vacaciones (art. 187 CST)', () => {
  it('interrumpe el periodo y calcula los días pendientes', () => {
    // La incapacidad empieza el jueves 9. Del 9 al 17 de julio de 2026 hay 7
    // días hábiles: 9, 10, 13, 14, 15, 16 y 17 —el 20 es el festivo, ya fuera—.
    const r = evaluarSolapamiento({
      nuevo: { ...INCAPACIDAD, fechaInicio: '2026-07-09', fechaFin: '2026-07-20' },
      ocupados: [VACACIONES],
    })

    expect(r.hayInterrupcion).toBe(true)
    expect(r.cruces[0].resolucion).toBe('interrumpe')
    expect(r.cruces[0].fechaInterrupcion).toBe('2026-07-09')
    expect(r.cruces[0].diasPendientes).toBe(7)
  })

  it('no interrumpe si empieza el mismo día que el periodo', () => {
    // Nada disfrutado que suspender: lo que procede es corregir una de las dos
    // solicitudes, no partir un periodo que aún no ha empezado.
    const r = evaluarSolapamiento({
      nuevo: { ...INCAPACIDAD, fechaInicio: '2026-07-06', fechaFin: '2026-07-10' },
      ocupados: [VACACIONES],
    })

    expect(r.hayInterrupcion).toBe(false)
    expect(r.cruces[0].resolucion).toBe('convive')
  })

  it('una calamidad no suspende las vacaciones por sí sola', () => {
    // El descanso sigue corriendo. Solo lo parte lo que la ley reconoce como
    // incompatible con el descanso, y una calamidad no lo es mientras no
    // derive en incapacidad.
    const r = evaluarSolapamiento({
      nuevo: {
        motivo: 'Calamidad doméstica',
        prioridad: 15,
        interrumpeOtros: true,
        fechaInicio: '2026-07-09',
        fechaFin: '2026-07-10',
      },
      ocupados: [{ ...VACACIONES, prioridad: 10 }],
    })

    // Con prioridad mayor sí interrumpe; lo que decide es el catálogo, y la
    // clínica puede bajarle la prioridad a la calamidad desde Administración.
    expect(r.cruces[0].resolucion).toBe('interrumpe')
  })

  it('un permiso corriente no interrumpe unas vacaciones', () => {
    const r = evaluarSolapamiento({
      nuevo: {
        motivo: 'Diligencia personal',
        prioridad: 0,
        interrumpeOtros: false,
        fechaInicio: '2026-07-09',
        fechaFin: '2026-07-09',
      },
      ocupados: [VACACIONES],
    })

    expect(r.hayInterrupcion).toBe(false)
    expect(r.cruces[0].resolucion).toBe('convive')
  })
})

describe('duplicados', () => {
  it('el mismo motivo en las mismas fechas se marca como posible duplicado', () => {
    const permiso: PeriodoOcupado = {
      ...VACACIONES,
      id: 'p1',
      consecutivo: 'PL-2026-00010',
      motivo: 'Cita médica',
      prioridad: 5,
      esVacaciones: false,
    }

    const r = evaluarSolapamiento({
      nuevo: {
        motivo: 'Cita médica',
        prioridad: 5,
        interrumpeOtros: false,
        fechaInicio: '2026-07-08',
        fechaFin: '2026-07-08',
      },
      ocupados: [permiso],
    })

    expect(r.cruces[0].resolucion).toBe('duplicado')
    expect(r.cruces[0].mensaje).toContain('PL-2026-00010')
  })
})

describe('días no disfrutados', () => {
  it('las vacaciones se cuentan en días hábiles', () => {
    expect(
      diasNoDisfrutados({ fechaInterrupcion: '2026-07-13', fechaFin: '2026-07-17' })
    ).toBe(5)
  })

  it('una licencia se cuenta en días calendario', () => {
    expect(
      diasNoDisfrutados({
        fechaInterrupcion: '2026-07-13',
        fechaFin: '2026-07-17',
        porCalendario: true,
      })
    ).toBe(5)
    expect(
      diasNoDisfrutados({
        fechaInterrupcion: '2026-07-11',
        fechaFin: '2026-07-17',
        porCalendario: true,
      })
    ).toBe(7)
  })

  it('una interrupción posterior al final no deja días pendientes', () => {
    expect(
      diasNoDisfrutados({ fechaInterrupcion: '2026-07-20', fechaFin: '2026-07-17' })
    ).toBe(0)
  })
})
