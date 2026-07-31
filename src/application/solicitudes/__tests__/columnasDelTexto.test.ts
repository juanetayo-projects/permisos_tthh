import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/supabase/client', () => ({ supabase: {}, URL_APP: 'https://ejemplo.test/' }))

const { columnasDelTexto } = await import('@/application/solicitudes/api')

describe('reparto del texto de la decisión', () => {
  it('guarda la observación de una autorización fuera del motivo de rechazo', () => {
    // El caso real que rompió PL-2026-00001: al autorizar con observación, la
    // solicitud se le mostraba al solicitante como rechazada.
    expect(columnasDelTexto('PENDIENTE_TH', 'se autoriza el permiso')).toEqual({
      motivo_rechazo: null,
      observacion_decision: 'se autoriza el permiso',
    })
  })

  it('guarda la causa de un rechazo donde el solicitante la ve', () => {
    expect(columnasDelTexto('RECHAZADA_COORDINADOR', 'no hay cubrimiento del turno')).toEqual({
      motivo_rechazo: 'no hay cubrimiento del turno',
      observacion_decision: null,
    })
  })

  it('trata la cancelación como negativa', () => {
    expect(columnasDelTexto('CANCELADA', 'ya no lo necesito').motivo_rechazo).toBe(
      'ya no lo necesito'
    )
  })

  it('limpia la columna contraria para no arrastrar el paso anterior', () => {
    expect(columnasDelTexto('PENDIENTE_TH', null)).toEqual({
      motivo_rechazo: null,
      observacion_decision: null,
    })
  })

  it('no guarda espacios en blanco como si fueran texto', () => {
    expect(columnasDelTexto('PENDIENTE_TH', '   ').observacion_decision).toBeNull()
  })
})
