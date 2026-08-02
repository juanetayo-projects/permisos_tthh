import { describe, expect, it } from 'vitest'
import {
  calcularIndicadores,
  porArea,
  porColaborador,
  porMes,
  porNaturaleza,
  type FilaAusentismo,
} from '@/domain/ausentismo'

function fila(p: Partial<FilaAusentismo> = {}): FilaAusentismo {
  return {
    solicitud_id: crypto.randomUUID(),
    consecutivo: 'PL-2026-00001',
    estado: 'FINALIZADA',
    extemporanea: false,
    solicitante_id: 'u1',
    colaborador: 'Ana Gómez',
    documento: '1000',
    area_id: 1,
    area: 'Urgencias',
    cargo_id: 1,
    cargo: 'Auxiliar de enfermería',
    empresa_id: 1,
    empresa: 'CAC Santa Bárbara',
    coordinador: 'Jefe de Urgencias',
    tramite: 'permiso',
    categoria_id: 3,
    categoria: 'Salud',
    tipo_id: 2,
    motivo: 'Incapacidad médica',
    naturaleza: 'incapacidad',
    remunerado: true,
    fecha_solicitud: '2026-03-02',
    fecha_inicio: '2026-03-02',
    fecha_fin: '2026-03-04',
    anio: 2026,
    mes: 3,
    dias: 3,
    horas: 24,
    ...p,
  }
}

const BASE = { colaboradores: 100, mesesDelPeriodo: 12, diasHabilesMes: 24, horasJornada: 8 }

describe('indicadores de ausentismo', () => {
  it('suma días y horas de las ausencias filtradas', () => {
    const i = calcularIndicadores([fila(), fila({ dias: 2, horas: 16 })], BASE)

    expect(i.eventos).toBe(2)
    expect(i.diasPerdidos).toBe(5)
    expect(i.horasPerdidas).toBe(40)
  })

  it('el denominador es la plantilla, no quien faltó', () => {
    // 100 personas × 12 meses × 24 días × 8 h = 230.400 horas programadas.
    const i = calcularIndicadores([fila()], BASE)

    expect(i.horasProgramadas).toBe(230_400)
    expect(i.colaboradoresConAusencia).toBe(1)
    expect(i.porcentajeTiempoPerdido).toBe(0.01)
  })

  it('sin plantilla los índices quedan en null en vez de dividir por cero', () => {
    const i = calcularIndicadores([fila()], { ...BASE, colaboradores: 0 })

    expect(i.indiceFrecuencia).toBeNull()
    expect(i.indiceSeveridad).toBeNull()
    expect(i.porcentajeTiempoPerdido).toBeNull()
    // Los recuentos absolutos sí se pueden dar: no dependen del denominador.
    expect(i.diasPerdidos).toBe(3)
  })

  it('separa lo que es causa médica', () => {
    // La Resolución 0312 de 2019 pide el ausentismo por causa médica aparte:
    // incapacidades y licencias sí, permisos del empleador no.
    const i = calcularIndicadores(
      [fila(), fila({ naturaleza: 'permiso', motivo: 'Diligencia personal', dias: 1, horas: 8 })],
      BASE
    )

    expect(i.diasPorCausaMedica).toBe(3)
    expect(i.porcentajeCausaMedica).toBe(75)
  })

  it('la duración media es días perdidos por evento', () => {
    const i = calcularIndicadores([fila({ dias: 4 }), fila({ dias: 2 })], BASE)
    expect(i.duracionMedia).toBe(3)
  })
})

describe('desgloses', () => {
  it('agrupa por colaborador y no lo cuenta dos veces', () => {
    const filas = [fila(), fila({ dias: 1, horas: 8 }), fila({ solicitante_id: 'u2', colaborador: 'Luis Paz' })]

    const r = porColaborador(filas)

    expect(r).toHaveLength(2)
    expect(r[0].etiqueta).toBe('Ana Gómez')
    expect(r[0].eventos).toBe(2)
    expect(r[0].dias).toBe(4)
    expect(r[0].colaboradores).toBe(1)
  })

  it('agrupa por área contando personas distintas', () => {
    const filas = [fila(), fila({ solicitante_id: 'u2', colaborador: 'Luis Paz' })]
    const r = porArea(filas)

    expect(r[0].etiqueta).toBe('Urgencias')
    expect(r[0].colaboradores).toBe(2)
  })

  it('ordena de mayor a menor por días perdidos', () => {
    const filas = [
      fila({ area_id: 1, area: 'Urgencias', dias: 1, horas: 8 }),
      fila({ area_id: 2, area: 'Hospitalización', dias: 9, horas: 72, solicitante_id: 'u3' }),
    ]

    expect(porArea(filas)[0].etiqueta).toBe('Hospitalización')
  })

  it('traduce la naturaleza a lenguaje de Talento Humano', () => {
    expect(porNaturaleza([fila()])[0].etiqueta).toBe('Incapacidad')
  })

  it('la serie mensual devuelve los doce meses aunque estén vacíos', () => {
    const serie = porMes([fila()], 2026)

    expect(serie).toHaveLength(12)
    expect(serie[2].dias).toBe(3)
    expect(serie[0].dias).toBe(0)
  })

  it('la serie ignora los años que no son el consultado', () => {
    expect(porMes([fila({ anio: 2025 })], 2026).every((p) => p.dias === 0)).toBe(true)
  })
})
