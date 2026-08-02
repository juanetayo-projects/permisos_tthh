import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DialogoProblemas } from '@/presentation/components/DialogoProblemas'
import type { Problema } from '@/domain/validacion'

const FALTA_CARGO: Problema = {
  campo: 'Cargo',
  causa: 'No seleccionaste el cargo.',
  motivo: 'Va impreso en el formato y es uno de los cortes del informe de ausentismo.',
}

const FALTA_MOTIVO: Problema = {
  campo: 'Motivo del permiso',
  causa: 'No elegiste la categoría y el motivo.',
  motivo: 'El motivo decide qué documentos se te van a pedir.',
}

describe('modal de problemas', () => {
  it('sin problemas no se abre', () => {
    render(<DialogoProblemas problemas={[]} onCerrar={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('muestra el campo, la causa y el motivo', () => {
    // Las tres piezas son el requisito: antes solo se decía la causa, y exigir
    // el cargo sin explicar por qué parecía un capricho del sistema.
    render(<DialogoProblemas problemas={[FALTA_CARGO]} onCerrar={() => {}} />)

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Cargo')).toBeTruthy()
    expect(screen.getByText(FALTA_CARGO.causa)).toBeTruthy()
    expect(screen.getByText(FALTA_CARGO.motivo)).toBeTruthy()
  })

  it('lista todos los problemas a la vez', () => {
    render(<DialogoProblemas problemas={[FALTA_CARGO, FALTA_MOTIVO]} onCerrar={() => {}} />)

    expect(screen.getByText(FALTA_CARGO.causa)).toBeTruthy()
    expect(screen.getByText(FALTA_MOTIVO.causa)).toBeTruthy()
    expect(screen.getByText(/2 puntos por corregir/)).toBeTruthy()
  })

  it('con uno solo no habla en plural', () => {
    render(<DialogoProblemas problemas={[FALTA_CARGO]} onCerrar={() => {}} />)
    expect(screen.getByText(/Corrige este punto/)).toBeTruthy()
  })

  it('el botón cierra el modal', () => {
    const onCerrar = vi.fn()
    render(<DialogoProblemas problemas={[FALTA_CARGO]} onCerrar={onCerrar} />)

    fireEvent.click(screen.getByRole('button', { name: /lo corrijo/i }))

    expect(onCerrar).toHaveBeenCalled()
  })
})
