import { describe, expect, it } from 'vitest'
import {
  problemaAlGuardar,
  validarCesantias,
  validarPermiso,
  validarVacaciones,
  type DatosPermiso,
} from '@/domain/validacion'

const PERMISO_COMPLETO: DatosPermiso = {
  documento: '16278711',
  empresaId: '1',
  areaId: '3',
  cargoId: '7',
  tipoId: '2',
  justificacion: 'Cita de control con el especialista.',
  faltaSoportePrevio: false,
  vaDirectoAGerencia: false,
  tieneCoordinador: true,
}

describe('validación del permiso', () => {
  it('una solicitud completa no tiene problemas', () => {
    expect(validarPermiso(PERMISO_COMPLETO)).toEqual([])
  })

  it('el cargo es obligatorio', () => {
    // El bug reportado: se podía enviar sin cargo, y el formato lo imprime.
    const problemas = validarPermiso({ ...PERMISO_COMPLETO, cargoId: '' })

    expect(problemas).toHaveLength(1)
    expect(problemas[0].campo).toBe('Cargo')
    expect(problemas[0].motivo).toContain('ausentismo')
  })

  it('devuelve todos los problemas de una vez', () => {
    // Antes se cortaba en el primero, así que el colaborador descubría lo que
    // faltaba de uno en uno, a un intento de envío por dato.
    const problemas = validarPermiso({
      ...PERMISO_COMPLETO,
      cargoId: '',
      areaId: '',
      tipoId: '',
      justificacion: '   ',
    })

    expect(problemas.map((p) => p.campo)).toEqual([
      'Servicio actual',
      'Cargo',
      'Motivo del permiso',
      'Justificación del permiso',
    ])
  })

  it('cada problema explica por qué se exige', () => {
    for (const p of validarPermiso({ ...PERMISO_COMPLETO, documento: '', empresaId: '' })) {
      expect(p.causa.length).toBeGreaterThan(0)
      expect(p.motivo.length).toBeGreaterThan(0)
    }
  })

  it('no pide jefe directo cuando el trámite va a Gerencia', () => {
    const problemas = validarPermiso({
      ...PERMISO_COMPLETO,
      tieneCoordinador: false,
      vaDirectoAGerencia: true,
    })

    expect(problemas).toEqual([])
  })

  it('pide el soporte previo cuando el motivo lo exige', () => {
    const problemas = validarPermiso({ ...PERMISO_COMPLETO, faltaSoportePrevio: true })
    expect(problemas.map((p) => p.campo)).toEqual(['Soporte'])
  })
})

describe('validación de vacaciones', () => {
  const base = {
    documento: '16278711',
    empresaId: '1',
    areaId: '3',
    cargoId: '7',
    diasADisfrutar: 6,
    declaracionAceptada: true,
    tieneCoordinador: true,
  }

  it('una solicitud completa no tiene problemas', () => {
    expect(validarVacaciones(base)).toEqual([])
  })

  it('exige días, declaración y cargo', () => {
    const problemas = validarVacaciones({
      ...base,
      cargoId: '',
      diasADisfrutar: null,
      declaracionAceptada: false,
    })

    expect(problemas.map((p) => p.campo)).toEqual([
      'Cargo',
      'Días a disfrutar',
      'Declaración de conformidad',
    ])
  })

  it('cero días no es un periodo válido', () => {
    expect(validarVacaciones({ ...base, diasADisfrutar: 0 })).toHaveLength(1)
  })
})

describe('validación del retiro de cesantías', () => {
  const base = {
    documento: '16278711',
    empresaId: '1',
    areaId: '3',
    cargoId: '7',
    destino: 'vivienda_compra',
    tieneSoporte: true,
  }

  it('una solicitud completa no tiene problemas', () => {
    expect(validarCesantias(base)).toEqual([])
  })

  it('exige destinación y soporte', () => {
    const problemas = validarCesantias({ ...base, destino: '', tieneSoporte: false })

    expect(problemas.map((p) => p.campo)).toEqual(['Destinación del retiro', 'Soporte'])
    expect(problemas[0].motivo).toContain('102')
  })
})

describe('fallos al guardar', () => {
  it('traduce el error de RLS a algo accionable', () => {
    const p = problemaAlGuardar({ code: '42501', message: 'new row violates row-level security policy' })

    expect(p.causa).not.toContain('row-level')
    expect(p.motivo).toContain('validación')
  })

  it('un error desconocido conserva el mensaje original', () => {
    const p = problemaAlGuardar(new Error('Failed to fetch'))
    expect(p.causa).toBe('Failed to fetch')
  })

  it('un error sin mensaje no deja la causa vacía', () => {
    expect(problemaAlGuardar(null).causa.length).toBeGreaterThan(0)
  })
})
