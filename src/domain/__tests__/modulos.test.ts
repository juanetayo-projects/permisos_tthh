import { describe, expect, it } from 'vitest'
import { ROLES } from '../estados'
import {
  ACCESOS_POR_DEFECTO,
  DEFINICION_MODULOS,
  MODULOS,
  esAccesoFijo,
  filasPorDefecto,
} from '../modulos'

describe('catálogo de módulos', () => {
  it('define exactamente un módulo por código', () => {
    expect(DEFINICION_MODULOS.map((m) => m.codigo).sort()).toEqual([...MODULOS].sort())
  })

  it('no repite rutas entre módulos', () => {
    const rutas = DEFINICION_MODULOS.map((m) => m.ruta)
    expect(new Set(rutas).size).toBe(rutas.length)
  })
})

describe('reparto por defecto', () => {
  it('cubre todos los roles', () => {
    expect(Object.keys(ACCESOS_POR_DEFECTO).sort()).toEqual([...ROLES].sort())
  })

  it('no menciona ningún módulo inexistente', () => {
    for (const rol of ROLES) {
      for (const modulo of ACCESOS_POR_DEFECTO[rol]) {
        expect(MODULOS).toContain(modulo)
      }
    }
  })

  it('no repite un módulo dentro del mismo rol', () => {
    for (const rol of ROLES) {
      const modulos = ACCESOS_POR_DEFECTO[rol]
      expect(new Set(modulos).size).toBe(modulos.length)
    }
  })

  it('deja a todo el mundo con al menos una pantalla', () => {
    // Un rol sin módulos es una cuenta que entra y no puede ir a ningún sitio.
    for (const rol of ROLES) {
      expect(ACCESOS_POR_DEFECTO[rol].length).toBeGreaterThan(0)
    }
  })

  it('todos pueden pedir permisos y consultar lo suyo', () => {
    for (const rol of ROLES) {
      expect(ACCESOS_POR_DEFECTO[rol]).toContain('solicitar_permiso')
      expect(ACCESOS_POR_DEFECTO[rol]).toContain('mis_solicitudes')
    }
  })

  it('reserva las decisiones de Talento Humano a quien las toma', () => {
    expect(ACCESOS_POR_DEFECTO.colaborador).not.toContain('bandeja_th')
    expect(ACCESOS_POR_DEFECTO.coordinador).not.toContain('bandeja_th')
    // SST vigila el ausentismo; no autoriza ni valida.
    expect(ACCESOS_POR_DEFECTO.coordinador_sst).not.toContain('bandeja_th')
    expect(ACCESOS_POR_DEFECTO.coordinador_sst).not.toContain('validaciones')
    expect(ACCESOS_POR_DEFECTO.coordinador_sst).toContain('ausentismo')
    // La Gerencia entra al flujo solo por las cesantías.
    expect(ACCESOS_POR_DEFECTO.gerente_th).toContain('bandeja_cesantias')
    expect(ACCESOS_POR_DEFECTO.gerente_th).not.toContain('bandeja_th')
  })

  it('se aplana sin perder ninguna pareja', () => {
    const total = ROLES.reduce((n, rol) => n + ACCESOS_POR_DEFECTO[rol].length, 0)
    expect(filasPorDefecto()).toHaveLength(total)
  })
})

describe('accesos que no se pueden quitar', () => {
  it('protege la única puerta desde la que se reparten los accesos', () => {
    expect(esAccesoFijo('administrador', 'administracion')).toBe(true)
    expect(ACCESOS_POR_DEFECTO.administrador).toContain('administracion')
  })

  it('no ata ningún otro módulo ni ningún otro rol', () => {
    expect(esAccesoFijo('administrador', 'dashboard')).toBe(false)
    expect(esAccesoFijo('analista_th', 'administracion')).toBe(false)
  })
})
