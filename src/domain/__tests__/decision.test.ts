import { describe, expect, it } from 'vitest'
import { ESTADOS, esDecisionNegativa, type Estado } from '@/domain/estados'

describe('texto que acompaña a una decisión', () => {
  it('trata como negativas solo las que lo son', () => {
    const negativas = ESTADOS.filter(esDecisionNegativa)

    expect(negativas).toEqual(['RECHAZADA_COORDINADOR', 'RECHAZADA_TH', 'CANCELADA'])
  })

  it('no marca como negativo ningún estado de avance', () => {
    // Es el error que hacía aparecer «Causa del rechazo» en una solicitud
    // autorizada: el destino de una autorización nunca es negativo.
    const avances: Estado[] = [
      'PENDIENTE_TH',
      'APROBADA_COORDINADOR',
      'APROBADA_TH',
      'PENDIENTE_SOPORTE',
      'FINALIZADA',
    ]

    for (const estado of avances) expect(esDecisionNegativa(estado)).toBe(false)
  })
})
