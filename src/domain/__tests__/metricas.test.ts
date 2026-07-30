import { describe, expect, it } from 'vitest'
import {
  calcularKpis,
  mapaCalorAreaMes,
  porCategoria,
  rankingAreas,
  tendenciaMensual,
  type SolicitudMetrica,
} from '../metricas'

function solicitud(p: Partial<SolicitudMetrica> = {}): SolicitudMetrica {
  return {
    estado: 'FINALIZADA',
    extemporanea: false,
    fecha_solicitud: '2026-03-01',
    fecha_inicio: '2026-03-10',
    fecha_fin: '2026-03-10',
    coord_fecha: null,
    th_fecha: null,
    created_at: '2026-03-01T08:00:00Z',
    area: { id: 1, nombre: 'Urgencias' },
    empresa: { id: 1, nombre: 'CAC Santa Bárbara' },
    tramite: { codigo: 'permiso' },
    detalle_permiso: {
      horas_permiso: 4,
      dias_permiso: 0.5,
      categoria: { id: 1, nombre: 'Salud' },
      tipo: { id: 1, nombre: 'Cita médica' },
    },
    detalle_vacaciones: null,
    ...p,
  }
}

describe('KPIs', () => {
  it('separa lo que está en trámite de lo ya resuelto', () => {
    const kpis = calcularKpis([
      solicitud({ estado: 'PENDIENTE_COORDINADOR' }),
      solicitud({ estado: 'PENDIENTE_TH' }),
      solicitud({ estado: 'FINALIZADA' }),
      solicitud({ estado: 'RECHAZADA_COORDINADOR' }),
    ])

    expect(kpis.total).toBe(4)
    expect(kpis.enTramite).toBe(2)
    expect(kpis.aprobadas).toBe(1)
    expect(kpis.rechazadas).toBe(1)
  })

  it('cuenta PENDIENTE_SOPORTE como aprobada, porque el permiso ya se disfrutó', () => {
    const kpis = calcularKpis([solicitud({ estado: 'PENDIENTE_SOPORTE' })])
    expect(kpis.aprobadas).toBe(1)
    expect(kpis.soportesPendientes).toBe(1)
  })

  it('solo suma horas de ausentismo de las solicitudes aprobadas', () => {
    const kpis = calcularKpis([
      solicitud({ estado: 'FINALIZADA' }),
      solicitud({ estado: 'RECHAZADA_TH' }),
    ])
    // La rechazada no genera ausentismo real.
    expect(kpis.horasAusentismo).toBe(4)
  })

  it('suma los días de vacaciones aparte de las horas de permiso', () => {
    const kpis = calcularKpis([
      solicitud({
        tramite: { codigo: 'vacaciones' },
        detalle_permiso: null,
        detalle_vacaciones: { dias_a_disfrutar: 15 },
      }),
    ])
    expect(kpis.diasVacaciones).toBe(15)
    expect(kpis.horasAusentismo).toBe(0)
  })

  it('calcula la tasa de aprobación solo sobre lo ya decidido', () => {
    const kpis = calcularKpis([
      solicitud({ estado: 'FINALIZADA' }),
      solicitud({ estado: 'FINALIZADA' }),
      solicitud({ estado: 'RECHAZADA_TH' }),
      // La pendiente no debe diluir la tasa.
      solicitud({ estado: 'PENDIENTE_COORDINADOR' }),
    ])
    expect(kpis.tasaAprobacion).toBe(67)
  })

  it('deja la tasa y el ciclo en nulo cuando no hay nada decidido', () => {
    const kpis = calcularKpis([solicitud({ estado: 'PENDIENTE_COORDINADOR' })])
    expect(kpis.tasaAprobacion).toBeNull()
    expect(kpis.cicloPromedio).toBeNull()
  })

  it('mide el ciclo en días hábiles entre el envío y la decisión', () => {
    const kpis = calcularKpis([
      // Viernes 2 de enero de 2026 a viernes 9: 6 días hábiles.
      solicitud({
        estado: 'FINALIZADA',
        created_at: '2026-01-02T08:00:00Z',
        th_fecha: '2026-01-09T10:00:00Z',
      }),
    ])
    expect(kpis.cicloPromedio).toBe(6)
  })

  it('no falla con una lista vacía', () => {
    const kpis = calcularKpis([])
    expect(kpis.total).toBe(0)
    expect(kpis.tasaAprobacion).toBeNull()
  })
})

describe('tendencia mensual', () => {
  it('devuelve los doce meses aunque falten datos', () => {
    const serie = tendenciaMensual([solicitud({ fecha_inicio: '2026-03-10' })], 2026)
    expect(serie).toHaveLength(12)
    expect(serie[2].permisos).toBe(1)
    expect(serie[0].total).toBe(0)
  })

  it('ignora las solicitudes de otro año', () => {
    const serie = tendenciaMensual([solicitud({ fecha_inicio: '2025-03-10' })], 2026)
    expect(serie.every((p) => p.total === 0)).toBe(true)
  })

  it('separa permisos de vacaciones', () => {
    const serie = tendenciaMensual(
      [
        solicitud({ fecha_inicio: '2026-05-04' }),
        solicitud({
          fecha_inicio: '2026-05-20',
          tramite: { codigo: 'vacaciones' },
          detalle_permiso: null,
          detalle_vacaciones: { dias_a_disfrutar: 15 },
        }),
      ],
      2026
    )
    expect(serie[4]).toMatchObject({ permisos: 1, vacaciones: 1, total: 2 })
  })
})

describe('distribución y ranking', () => {
  it('agrupa vacaciones como su propia categoría', () => {
    const dist = porCategoria([
      solicitud(),
      solicitud({
        tramite: { codigo: 'vacaciones' },
        detalle_permiso: null,
        detalle_vacaciones: { dias_a_disfrutar: 15 },
      }),
    ])
    expect(dist).toEqual([
      { nombre: 'Salud', valor: 1 },
      { nombre: 'Vacaciones', valor: 1 },
    ])
  })

  it('ordena las áreas de mayor a menor y cuenta las extemporáneas', () => {
    const ranking = rankingAreas([
      solicitud({ area: { id: 1, nombre: 'Urgencias' } }),
      solicitud({ area: { id: 1, nombre: 'Urgencias' }, extemporanea: true }),
      solicitud({ area: { id: 2, nombre: 'Farmacia' } }),
    ])

    expect(ranking[0]).toMatchObject({ area: 'Urgencias', solicitudes: 2, extemporaneas: 1 })
    expect(ranking[1]).toMatchObject({ area: 'Farmacia', solicitudes: 1 })
  })
})

describe('mapa de calor', () => {
  it('devuelve la matriz completa, con ceros explícitos', () => {
    const { areas, celdas, maximo } = mapaCalorAreaMes(
      [solicitud({ fecha_inicio: '2026-03-10' })],
      2026
    )

    expect(areas).toEqual(['Urgencias'])
    // Una fila por área y doce columnas: los ceros importan, no son huecos.
    expect(celdas).toHaveLength(12)
    expect(celdas.find((c) => c.mesIndice === 2)?.valor).toBe(1)
    expect(celdas.find((c) => c.mesIndice === 0)?.valor).toBe(0)
    expect(maximo).toBe(1)
  })

  it('nunca deja el máximo en cero, para no dividir por cero al pintar', () => {
    expect(mapaCalorAreaMes([], 2026).maximo).toBe(1)
  })
})
