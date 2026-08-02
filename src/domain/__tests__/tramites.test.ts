import { describe, expect, it } from 'vitest'
import { CODIGOS_TRAMITE, esAusencia, etiquetaTramite } from '@/domain/tramites'
import { porCategoria, tendenciaMensual, type SolicitudMetrica } from '@/domain/metricas'

function solicitud(p: Partial<SolicitudMetrica> = {}): SolicitudMetrica {
  return {
    estado: 'FINALIZADA',
    extemporanea: false,
    fecha_solicitud: '2026-03-02',
    fecha_inicio: '2026-03-02',
    fecha_fin: '2026-03-02',
    coord_fecha: null,
    th_fecha: null,
    created_at: '2026-03-01T10:00:00Z',
    area: { id: 1, nombre: 'Urgencias' },
    empresa: { id: 1, nombre: 'CAC Santa Bárbara' },
    tramite: { codigo: 'permiso' },
    detalle_permiso: {
      horas_permiso: 8,
      dias_permiso: 1,
      categoria: { id: 1, nombre: 'Salud' },
      tipo: { id: 1, nombre: 'Cita médica' },
    },
    detalle_vacaciones: null,
    ...p,
  }
}

describe('etiquetas de trámite', () => {
  it('nombra los tres trámites', () => {
    expect(etiquetaTramite('permiso')).toBe('Permiso')
    expect(etiquetaTramite('vacaciones')).toBe('Vacaciones')
    expect(etiquetaTramite('cesantias')).toBe('Cesantías')
  })

  it('un código desconocido no rompe la pantalla', () => {
    expect(etiquetaTramite(null)).toBe('Permiso')
    expect(etiquetaTramite('lo-que-sea')).toBe('Permiso')
  })

  it('las cesantías no son una ausencia', () => {
    // Es la distinción que evita que un retiro parcial aparezca en el
    // ausentismo y que se avise de que «se cruza» con unas vacaciones.
    expect(esAusencia('cesantias')).toBe(false)
    expect(esAusencia('permiso')).toBe(true)
    expect(esAusencia('vacaciones')).toBe(true)
  })

  it('los tres códigos tienen etiqueta', () => {
    for (const c of CODIGOS_TRAMITE) expect(etiquetaTramite(c)).not.toBe('')
  })
})

describe('las cesantías no se cuentan como permiso', () => {
  it('la tendencia mensual las lleva en su propia serie', () => {
    const serie = tendenciaMensual(
      [solicitud(), solicitud({ tramite: { codigo: 'cesantias' } })],
      2026
    )

    expect(serie[2].permisos).toBe(1)
    expect(serie[2].cesantias).toBe(1)
    expect(serie[2].total).toBe(2)
  })

  it('la distribución por categoría las agrupa aparte', () => {
    // Antes caían bajo la casilla «Empresarial» del TH-F-002 y engordaban una
    // categoría de permisos con algo que no lo es.
    const segmentos = porCategoria([
      solicitud(),
      solicitud({
        tramite: { codigo: 'cesantias' },
        detalle_permiso: {
          horas_permiso: 0,
          dias_permiso: 0,
          categoria: { id: 4, nombre: 'Empresarial' },
          tipo: { id: 12, nombre: 'Solicitud de cesantías' },
        },
      }),
    ])

    expect(segmentos.map((s) => s.nombre).sort()).toEqual(['Cesantías', 'Salud'])
  })
})
