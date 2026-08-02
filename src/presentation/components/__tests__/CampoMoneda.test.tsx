import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { CampoMoneda } from '@/presentation/components/CampoMoneda'

/** El separador de miles importa; el tipo de espacio que use ICU, no. */
function texto(valor: string): string {
  return valor.replace(/\s/g, ' ')
}

describe('campo de moneda', () => {
  it('muestra lo digitado como pesos colombianos', () => {
    render(<CampoMoneda id="monto" valor="3500000" onCambio={() => {}} />)

    const campo = document.getElementById('monto') as HTMLInputElement
    expect(texto(campo.value)).toBe('$ 3.500.000')
  })

  it('sube el valor sin separadores', () => {
    const onCambio = vi.fn()
    render(<CampoMoneda id="monto" valor="" onCambio={onCambio} />)

    fireEvent.change(document.getElementById('monto')!, { target: { value: '3500000' } })

    expect(onCambio).toHaveBeenCalledWith('3500000')
  })

  it('acepta un importe pegado ya formateado', () => {
    const onCambio = vi.fn()
    render(<CampoMoneda id="monto" valor="" onCambio={onCambio} />)

    fireEvent.change(document.getElementById('monto')!, { target: { value: '$ 3.500.000' } })

    expect(onCambio).toHaveBeenCalledWith('3500000')
  })

  it('sin valor queda vacío y no muestra un cero', () => {
    render(<CampoMoneda id="monto" valor="" onCambio={() => {}} />)
    expect((document.getElementById('monto') as HTMLInputElement).value).toBe('')
  })

  it('no usa type=number: no admitiría los separadores', () => {
    render(<CampoMoneda id="monto" valor="1200" onCambio={() => {}} />)
    const campo = document.getElementById('monto') as HTMLInputElement

    expect(campo.type).toBe('text')
    expect(campo.inputMode).toBe('numeric')
  })
})
