import { describe, expect, it } from 'vitest'
import {
  avisoDeVencimiento,
  documentosDelMomento,
  evaluarChecklist,
  type DocumentoExigido,
} from '@/domain/soportes'

/** Matriz de la cita médica, tal como queda tras la migración. */
const CITA_MEDICA: DocumentoExigido[] = [
  {
    id: 1,
    documentoId: 10,
    codigo: 'orden_cita_medica',
    nombre: 'Orden o cita médica programada',
    descripcion: null,
    norma: 'Art. 57 num. 6 CST',
    momento: 'previo',
    obligatorio: false,
    desdeDias: null,
    nota: null,
    orden: 1,
  },
  {
    id: 2,
    documentoId: 11,
    codigo: 'constancia_asistencia_medica',
    nombre: 'Constancia de asistencia a la cita',
    descripcion: null,
    norma: 'Art. 57 num. 6 CST',
    momento: 'posterior',
    obligatorio: true,
    desdeDias: 2,
    nota: null,
    orden: 2,
  },
]

/** Luto: dos documentos obligatorios al finalizar, ninguno al solicitar. */
const LUTO: DocumentoExigido[] = [
  {
    id: 3,
    documentoId: 20,
    codigo: 'registro_defuncion',
    nombre: 'Registro civil de defunción',
    descripcion: null,
    norma: 'Ley 1280 de 2009',
    momento: 'posterior',
    obligatorio: true,
    desdeDias: null,
    nota: null,
    orden: 1,
  },
  {
    id: 4,
    documentoId: 21,
    codigo: 'prueba_parentesco',
    nombre: 'Documento que acredita el parentesco',
    descripcion: null,
    norma: 'Ley 1280 de 2009',
    momento: 'posterior',
    obligatorio: true,
    desdeDias: null,
    nota: null,
    orden: 2,
  },
]

describe('documentos por momento', () => {
  it('separa lo que se pide al solicitar de lo que se pide al regresar', () => {
    const previos = documentosDelMomento({ matriz: CITA_MEDICA, momento: 'previo', diasPermiso: 1 })
    const posteriores = documentosDelMomento({
      matriz: CITA_MEDICA,
      momento: 'posterior',
      diasPermiso: 1,
    })

    expect(previos.map((d) => d.codigo)).toEqual(['orden_cita_medica'])
    expect(posteriores.map((d) => d.codigo)).toEqual(['constancia_asistencia_medica'])
  })

  it('el umbral de días decide si el documento aplica al caso concreto', () => {
    // Dos horas de cita no exigen constancia; tres días, sí. Es la regla del
    // Paso 4 del prompt inicial, ahora por documento y no por motivo entero.
    const corto = documentosDelMomento({ matriz: CITA_MEDICA, momento: 'posterior', diasPermiso: 1 })
    const largo = documentosDelMomento({ matriz: CITA_MEDICA, momento: 'posterior', diasPermiso: 3 })

    expect(corto[0].exigible).toBe(false)
    expect(largo[0].exigible).toBe(true)
  })
})

describe('lista de verificación al finalizar', () => {
  it('no da por completo el luto con un solo documento', () => {
    // El fallo que motivó la lista: subir el registro de defunción cerraba el
    // paso y Talento Humano tenía que devolverlo para pedir el parentesco.
    const conUno = evaluarChecklist({
      matriz: LUTO,
      momento: 'posterior',
      diasPermiso: 5,
      entregados: ['registro_defuncion'],
    })

    expect(conUno.completo).toBe(false)
    expect(conUno.faltantes.map((d) => d.codigo)).toEqual(['prueba_parentesco'])
    expect(conUno.mensaje).toContain('parentesco')
  })

  it('se completa cuando llegan los dos', () => {
    const completo = evaluarChecklist({
      matriz: LUTO,
      momento: 'posterior',
      diasPermiso: 5,
      entregados: ['registro_defuncion', 'prueba_parentesco'],
    })

    expect(completo.completo).toBe(true)
    expect(completo.mensaje).toBeNull()
  })

  it('un documento opcional que falta no impide cerrar', () => {
    const soloOpcional: DocumentoExigido[] = [{ ...LUTO[0], obligatorio: false }]

    const estado = evaluarChecklist({
      matriz: soloOpcional,
      momento: 'posterior',
      diasPermiso: 5,
      entregados: [],
    })

    expect(estado.completo).toBe(true)
  })

  it('un documento que no supera el umbral tampoco bloquea', () => {
    const estado = evaluarChecklist({
      matriz: CITA_MEDICA,
      momento: 'posterior',
      diasPermiso: 1,
      entregados: [],
    })

    expect(estado.completo).toBe(true)
  })
})

describe('aviso de vencimiento del plazo', () => {
  it('cuenta los días que faltan', () => {
    const aviso = avisoDeVencimiento('2026-08-10', '2026-08-01')
    expect(aviso?.vencido).toBe(false)
    expect(aviso?.diasRestantes).toBe(9)
  })

  it('avisa el mismo día del vencimiento', () => {
    expect(avisoDeVencimiento('2026-08-01', '2026-08-01')?.mensaje).toContain('Hoy vence')
  })

  it('marca vencido cuando el plazo ya pasó', () => {
    const aviso = avisoDeVencimiento('2026-07-28', '2026-08-01')
    expect(aviso?.vencido).toBe(true)
    expect(aviso?.mensaje).toContain('venció hace 4 días')
  })

  it('sin fecha límite no hay aviso', () => {
    expect(avisoDeVencimiento(null, '2026-08-01')).toBeNull()
  })
})
