import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Une clases de Tailwind resolviendo conflictos (patrón shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formatea una fecha ISO como `dd/MM/yyyy`, que es como la lee la clínica. */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const FORMATO_LARGO = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatearFechaLarga(iso: string | null | undefined): string {
  if (!iso) return '—'
  return FORMATO_LARGO.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))
}

const FORMATO_MONEDA = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/**
 * Pesos colombianos, sin decimales: `$ 3.500.000`.
 *
 * Se omiten los centavos porque ningún valor de nómina ni de cesantías los
 * usa, y arrastrar «,00» en cada cifra solo alarga la columna.
 */
export function formatearMoneda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—'
  return FORMATO_MONEDA.format(valor)
}

/**
 * Deja solo los dígitos de lo que se escribió.
 *
 * Es lo que permite guardar el número limpio mientras en pantalla se ve con
 * separadores: quien digita `3500000` no debería tener que poner los puntos, y
 * quien pega `$ 3.500.000` no debería ver rechazado su valor.
 */
export function soloDigitos(texto: string): string {
  return texto.replace(/\D+/g, '')
}
