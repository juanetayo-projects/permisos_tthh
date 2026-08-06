import { describe, expect, it } from 'vitest'
import {
  accionesDisponibles,
  estadoAlEnviar,
  estadoTrasVistoBueno,
  puedeEjecutar,
  ESTADOS,
  ESTADOS_APROBADOS,
  ESTADOS_BANDEJA,
  ESTADOS_EN_TRAMITE,
  ESTADOS_NEGADOS,
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

  it('manda las cesantías directo a la Dirección de TTHH', () => {
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

describe('coordinador de SST', () => {
  it('no autoriza permisos por el hecho de ser SST', () => {
    const sst: ContextoAccion = { ...base, rol: 'coordinador_sst' }
    expect(puedeEjecutar('aprobar_coordinador', sst)).toBe(false)
    expect(puedeEjecutar('rechazar_coordinador', sst)).toBe(false)
    expect(puedeEjecutar('aprobar_th', { ...sst, estado: 'PENDIENTE_TH' })).toBe(false)
    expect(puedeEjecutar('archivar', { ...sst, estado: 'FINALIZADA' })).toBe(false)
  })

  it('sí autoriza cuando además es el jefe directo del servicio', () => {
    const jefe: ContextoAccion = { ...base, rol: 'coordinador_sst', coordinaElArea: true }
    expect(puedeEjecutar('aprobar_coordinador', jefe)).toBe(true)
    // Y sigue sin poder dar el visto bueno de Talento Humano: ser jefe de un
    // servicio no lo mete en el segundo paso del flujo.
    expect(puedeEjecutar('aprobar_th', { ...jefe, estado: 'PENDIENTE_TH' })).toBe(false)
  })

  it('puede pedir sus propios permisos', () => {
    const suyo: ContextoAccion = {
      ...base,
      estado: 'BORRADOR',
      rol: 'coordinador_sst',
      esSolicitante: true,
    }
    expect(puedeEjecutar('enviar', suyo)).toBe(true)
    expect(puedeEjecutar('cancelar', { ...suyo, estado: 'PENDIENTE_COORDINADOR' })).toBe(true)
  })
})

describe('montones de estados de las pestañas', () => {
  it('reparten todos los estados sin dejarse ninguno', () => {
    const repartidos = [...ESTADOS_EN_TRAMITE, ...ESTADOS_APROBADOS, ...ESTADOS_NEGADOS]
    expect([...repartidos].sort()).toEqual([...ESTADOS].sort())
  })

  it('no ponen el mismo estado en dos montones', () => {
    const repartidos = [...ESTADOS_EN_TRAMITE, ...ESTADOS_APROBADOS, ...ESTADOS_NEGADOS]
    expect(new Set(repartidos).size).toBe(repartidos.length)
  })

  it('lo que la bandeja del área deja decidir sigue esperando decisión', () => {
    for (const estado of ESTADOS_BANDEJA.coordinador) {
      expect(ESTADOS_EN_TRAMITE).toContain(estado)
    }
  })
})
