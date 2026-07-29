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
