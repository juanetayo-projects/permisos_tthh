/**
 * Los trámites que gestiona la aplicación.
 *
 * Existe este módulo porque el código estaba lleno de `codigo === 'vacaciones'
 * ? 'Vacaciones' : 'Permiso'`, y al aparecer un tercer trámite —el retiro
 * parcial de cesantías— todos esos ternarios lo habrían etiquetado como
 * «Permiso», que es exactamente lo que se está separando.
 */

export const CODIGOS_TRAMITE = ['permiso', 'vacaciones', 'cesantias', 'incapacidad'] as const

export type CodigoTramite = (typeof CODIGOS_TRAMITE)[number]

export const ETIQUETA_TRAMITE: Record<CodigoTramite, string> = {
  permiso: 'Permiso',
  vacaciones: 'Vacaciones',
  cesantias: 'Cesantías',
  incapacidad: 'Incapacidad',
}

export function etiquetaTramite(codigo: string | null | undefined): string {
  return ETIQUETA_TRAMITE[codigo as CodigoTramite] ?? 'Permiso'
}

/**
 * ¿Este trámite ocupa días del calendario del colaborador?
 *
 * El retiro parcial de cesantías se firma en el mismo formato pero no es una
 * ausencia: no tiene periodo, no cruza con otros permisos y no cuenta como
 * ausentismo. Las fechas que guarda son el día en que se radicó.
 */
export function esAusencia(codigo: string | null | undefined): boolean {
  return codigo !== 'cesantias'
}
