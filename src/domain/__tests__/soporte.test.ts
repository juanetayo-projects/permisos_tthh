import { describe, expect, it } from 'vitest'
import {
  ESTADOS_BANDEJA,
  esSoporteDevuelto,
  TRANSICIONES,
  estadoTrasVistoBueno,
  puedeEjecutar,
  type ContextoAccion,
} from '@/domain/estados'

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

  it('entregar el soporte cambia de responsable', () => {
    // El paso clave del flujo: sale de la bandeja del colaborador y entra en
    // la de Talento Humano, en vez de quedarse en el mismo estado.
    expect(TRANSICIONES.registrar_soporte.hacia).toBe('SOPORTE_EN_VALIDACION')
    expect(ESTADOS_BANDEJA.th).toContain('SOPORTE_EN_VALIDACION')
    // Y lo que espera al colaborador no ensucia la bandeja de TH.
    expect(ESTADOS_BANDEJA.th).not.toContain('PENDIENTE_SOPORTE')
  })

  it('Talento Humano y administración validan el soporte entregado', () => {
    const enRevision: ContextoAccion = { ...base, estado: 'SOPORTE_EN_VALIDACION' }

    expect(puedeEjecutar('validar_soporte', { ...enRevision, rol: 'analista_th' })).toBe(true)
    expect(puedeEjecutar('validar_soporte', { ...enRevision, rol: 'gerente_th' })).toBe(true)
    expect(puedeEjecutar('validar_soporte', { ...enRevision, rol: 'administrador' })).toBe(true)
  })

  it('devolver el soporte lo regresa al colaborador y exige motivo', () => {
    const enRevision: ContextoAccion = { ...base, estado: 'SOPORTE_EN_VALIDACION', rol: 'analista_th' }

    expect(puedeEjecutar('devolver_soporte', enRevision)).toBe(true)
    expect(TRANSICIONES.devolver_soporte.hacia).toBe('PENDIENTE_SOPORTE')
    expect(TRANSICIONES.devolver_soporte.exigeMotivo).toBe(true)
  })

  it('el jefe directo y el propio solicitante no cierran el trámite', () => {
    const enRevision: ContextoAccion = { ...base, estado: 'SOPORTE_EN_VALIDACION' }

    expect(puedeEjecutar('validar_soporte', { ...enRevision, rol: 'coordinador', coordinaElArea: true })).toBe(false)
    expect(puedeEjecutar('validar_soporte', { ...enRevision, esSolicitante: true })).toBe(false)
    expect(puedeEjecutar('devolver_soporte', { ...enRevision, esSolicitante: true })).toBe(false)
  })

  it('no se valida un soporte que todavía no ha llegado', () => {
    // Justo el caso que rompía antes: con el soporte aún sin entregar, TH no
    // tiene nada que revisar.
    expect(puedeEjecutar('validar_soporte', { ...base, rol: 'analista_th' })).toBe(false)
    expect(puedeEjecutar('validar_soporte', { ...base, estado: 'PENDIENTE_TH', rol: 'analista_th' })).toBe(false)
    expect(puedeEjecutar('validar_soporte', { ...base, estado: 'FINALIZADA', rol: 'analista_th' })).toBe(false)
  })
})

describe('devolución frente a nota del visto bueno', () => {
  it('reconoce la devolución por el estado del que viene', () => {
    expect(
      esSoporteDevuelto({ estado_anterior: 'SOPORTE_EN_VALIDACION', estado_nuevo: 'PENDIENTE_SOPORTE' })
    ).toBe(true)
  })

  it('no llama devolución al visto bueno con observación', () => {
    // El caso real que se vio en PL-2026-00001: Talento Humano autorizó con una
    // nota y la pantalla decía «Talento Humano devolvió el soporte».
    expect(
      esSoporteDevuelto({ estado_anterior: 'PENDIENTE_TH', estado_nuevo: 'PENDIENTE_SOPORTE' })
    ).toBe(false)
  })

  it('tampoco lo hace en la creación ni sin historial', () => {
    expect(esSoporteDevuelto({ estado_anterior: null, estado_nuevo: 'PENDIENTE_SOPORTE' })).toBe(false)
    expect(esSoporteDevuelto(undefined)).toBe(false)
  })

  it('deja de señalarla en cuanto el soporte vuelve a entregarse', () => {
    expect(
      esSoporteDevuelto({ estado_anterior: 'PENDIENTE_SOPORTE', estado_nuevo: 'SOPORTE_EN_VALIDACION' })
    ).toBe(false)
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
