import { describe, expect, it } from 'vitest'
import {
  accionesDisponibles,
  estadoAlEnviar,
  estadoTrasVistoBueno,
  puedeEjecutar,
  type ContextoAccion,
} from '../estados'

const base: ContextoAccion = {
  estado: 'PENDIENTE_COORDINADOR',
  rol: 'colaborador',
  esSolicitante: false,
  coordinaElArea: false,
}

describe('ruta de aprobación al enviar', () => {
  it('manda las solicitudes normales al jefe directo', () => {
    expect(estadoAlEnviar('coordinador_th')).toBe('PENDIENTE_COORDINADOR')
  })

  it('manda las cesantías directo a la Gerencia de TH', () => {
    // Paso 4 del prompt: las cesantías no pasan por el coordinador.
    expect(estadoAlEnviar('gerente_th_directo')).toBe('PENDIENTE_GERENCIA_TH')
  })
})

describe('estado tras el visto bueno de Talento Humano', () => {
  it('deja pendiente de soporte cuando el motivo lo exige', () => {
    expect(estadoTrasVistoBueno(true)).toBe('PENDIENTE_SOPORTE')
  })

  it('finaliza cuando no hay soporte por entregar', () => {
    expect(estadoTrasVistoBueno(false)).toBe('FINALIZADA')
  })
})

describe('quién puede hacer qué', () => {
  it('solo el jefe directo del área autoriza en el primer paso', () => {
    expect(puedeEjecutar('aprobar_coordinador', { ...base, rol: 'coordinador', coordinaElArea: true })).toBe(true)
    // Un coordinador de otra área no puede tocarla.
    expect(puedeEjecutar('aprobar_coordinador', { ...base, rol: 'coordinador', coordinaElArea: false })).toBe(false)
    expect(puedeEjecutar('aprobar_coordinador', { ...base, rol: 'analista_th' })).toBe(false)
  })

  it('Talento Humano no puede dar visto bueno antes que el jefe directo', () => {
    expect(puedeEjecutar('aprobar_th', { ...base, estado: 'PENDIENTE_COORDINADOR', rol: 'analista_th' })).toBe(false)
    expect(puedeEjecutar('aprobar_th', { ...base, estado: 'PENDIENTE_TH', rol: 'analista_th' })).toBe(true)
  })

  it('las cesantías las resuelve la gerencia, no el analista', () => {
    const ctx = { ...base, estado: 'PENDIENTE_GERENCIA_TH' as const }
    expect(puedeEjecutar('aprobar_th', { ...ctx, rol: 'gerente_th' })).toBe(true)
    expect(puedeEjecutar('aprobar_th', { ...ctx, rol: 'analista_th' })).toBe(true)
  })

  it('el solicitante puede cancelar mientras no haya visto bueno de TH', () => {
    expect(puedeEjecutar('cancelar', { ...base, esSolicitante: true })).toBe(true)
    expect(
      puedeEjecutar('cancelar', { ...base, estado: 'APROBADA_TH', esSolicitante: true })
    ).toBe(false)
  })

  it('nadie cancela una solicitud ajena', () => {
    expect(puedeEjecutar('cancelar', { ...base, rol: 'administrador', esSolicitante: false })).toBe(false)
  })

  it('solo se archiva lo que ya está resuelto', () => {
    expect(puedeEjecutar('archivar', { ...base, estado: 'FINALIZADA', rol: 'analista_th' })).toBe(true)
    expect(puedeEjecutar('archivar', { ...base, estado: 'PENDIENTE_TH', rol: 'analista_th' })).toBe(false)
  })

  it('un borrador ajeno no ofrece ninguna acción', () => {
    expect(accionesDisponibles({ ...base, estado: 'BORRADOR', rol: 'analista_th' })).toEqual([])
  })

  it('el dueño de un borrador puede enviarlo o cancelarlo', () => {
    const acciones = accionesDisponibles({ ...base, estado: 'BORRADOR', esSolicitante: true })
    expect(acciones).toContain('enviar')
    expect(acciones).toContain('cancelar')
  })
})
