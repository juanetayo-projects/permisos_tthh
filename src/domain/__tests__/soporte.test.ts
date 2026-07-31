import { describe, expect, it } from 'vitest'
import { estadoTrasVistoBueno, puedeEjecutar, type ContextoAccion } from '@/domain/estados'

const base: ContextoAccion = {
  estado: 'PENDIENTE_SOPORTE',
  rol: 'colaborador',
  esSolicitante: false,
  coordinaElArea: false,
}

describe('cierre del trámite con soporte posterior', () => {
  it('manda a esperar soporte solo cuando el motivo lo exige', () => {
    expect(estadoTrasVistoBueno(true)).toBe('PENDIENTE_SOPORTE')
    expect(estadoTrasVistoBueno(false)).toBe('FINALIZADA')
  })

  it('solo el solicitante entrega el archivo', () => {
    // La policy de Storage ata la ruta a `solicitante_id`: si la interfaz se lo
    // ofreciera a Talento Humano, la subida fallaría contra el servidor.
    expect(puedeEjecutar('registrar_soporte', { ...base, esSolicitante: true })).toBe(true)
    expect(puedeEjecutar('registrar_soporte', { ...base, rol: 'analista_th' })).toBe(false)
    expect(puedeEjecutar('registrar_soporte', { ...base, rol: 'administrador' })).toBe(false)
  })

  it('Talento Humano y administración validan el soporte', () => {
    expect(puedeEjecutar('validar_soporte', { ...base, rol: 'analista_th' })).toBe(true)
    expect(puedeEjecutar('validar_soporte', { ...base, rol: 'gerente_th' })).toBe(true)
    expect(puedeEjecutar('validar_soporte', { ...base, rol: 'administrador' })).toBe(true)
  })

  it('el jefe directo y el propio solicitante no cierran el trámite', () => {
    expect(puedeEjecutar('validar_soporte', { ...base, rol: 'coordinador', coordinaElArea: true })).toBe(false)
    expect(puedeEjecutar('validar_soporte', { ...base, esSolicitante: true })).toBe(false)
  })

  it('no se valida un soporte que nadie está esperando', () => {
    expect(puedeEjecutar('validar_soporte', { ...base, estado: 'PENDIENTE_TH', rol: 'analista_th' })).toBe(false)
    expect(puedeEjecutar('validar_soporte', { ...base, estado: 'FINALIZADA', rol: 'analista_th' })).toBe(false)
  })
})

describe('el administrador cubre a Talento Humano', () => {
  const enTh: ContextoAccion = { ...base, estado: 'PENDIENTE_TH', rol: 'administrador' }

  it('da el visto bueno y también rechaza', () => {
    // Sin esto una solicitud se quedaba clavada en PENDIENTE_TH cuando no
    // había ningún analista o gerente disponible.
    expect(puedeEjecutar('aprobar_th', enTh)).toBe(true)
    expect(puedeEjecutar('rechazar_th', enTh)).toBe(true)
  })

  it('no adelanta pasos que aún no tocan', () => {
    expect(puedeEjecutar('aprobar_th', { ...enTh, estado: 'PENDIENTE_COORDINADOR' })).toBe(false)
  })
})
