import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CampoArchivo } from '@/presentation/components/CampoArchivo'

function pdf(nombre: string, mb = 1): File {
  const f = new File(['x'], nombre, { type: 'application/pdf' })
  Object.defineProperty(f, 'size', { value: mb * 1024 * 1024 })
  return f
}

function elegir(archivos: File[]) {
  fireEvent.change(document.getElementById('soporte')!, { target: { files: archivos } })
}

describe('campo de soportes', () => {
  it('acepta varios archivos de una vez', () => {
    // El caso real: el luto pide registro de defunción y prueba de parentesco.
    const onCambio = vi.fn()
    render(<CampoArchivo id="soporte" archivos={[]} onCambio={onCambio} />)

    elegir([pdf('defuncion.pdf'), pdf('parentesco.pdf')])

    expect(onCambio).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'defuncion.pdf' }),
      expect.objectContaining({ name: 'parentesco.pdf' }),
    ])
  })

  it('acumula en vez de reemplazar', () => {
    // Adjuntar de dos en dos desde el celular no debe perder lo anterior.
    const onCambio = vi.fn()
    render(<CampoArchivo id="soporte" archivos={[pdf('uno.pdf')]} onCambio={onCambio} />)

    elegir([pdf('dos.pdf')])

    expect(onCambio.mock.calls[0][0].map((f: File) => f.name)).toEqual(['uno.pdf', 'dos.pdf'])
  })

  it('no duplica el mismo archivo', () => {
    const onCambio = vi.fn()
    render(<CampoArchivo id="soporte" archivos={[pdf('uno.pdf')]} onCambio={onCambio} />)

    elegir([pdf('uno.pdf')])

    expect(onCambio.mock.calls[0][0]).toHaveLength(1)
  })

  it('rechaza el que se pasa de tamaño y deja pasar el resto', () => {
    const onCambio = vi.fn()
    render(<CampoArchivo id="soporte" archivos={[]} onCambio={onCambio} maxMB={10} />)

    elegir([pdf('grande.pdf', 12), pdf('bueno.pdf', 2)])

    expect(onCambio.mock.calls[0][0].map((f: File) => f.name)).toEqual(['bueno.pdf'])
    expect(screen.getByText(/grande\.pdf pesa 12\.0 MB/)).toBeTruthy()
  })

  it('rechaza un tipo no admitido', () => {
    const onCambio = vi.fn()
    render(<CampoArchivo id="soporte" archivos={[]} onCambio={onCambio} />)

    elegir([new File(['x'], 'hoja.xlsx', { type: 'application/vnd.ms-excel' })])

    expect(onCambio.mock.calls[0][0]).toEqual([])
    expect(screen.getByText(/no es PDF, JPG, PNG ni WEBP/)).toBeTruthy()
  })

  it('respeta el tope de archivos por entrega', () => {
    const onCambio = vi.fn()
    render(<CampoArchivo id="soporte" archivos={[]} onCambio={onCambio} max={2} />)

    elegir([pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')])

    expect(onCambio.mock.calls[0][0]).toHaveLength(2)
    expect(screen.getByText(/solo caben 2 archivos/)).toBeTruthy()
  })

  it('lista lo adjuntado y permite quitarlo', () => {
    const onCambio = vi.fn()
    render(<CampoArchivo id="soporte" archivos={[pdf('uno.pdf'), pdf('dos.pdf')]} onCambio={onCambio} />)

    expect(screen.getByText('uno.pdf')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Quitar uno.pdf' }))

    expect(onCambio).toHaveBeenCalledWith([expect.objectContaining({ name: 'dos.pdf' })])
  })
})
