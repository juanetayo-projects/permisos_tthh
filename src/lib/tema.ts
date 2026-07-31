/**
 * Tema claro u oscuro.
 *
 * Vive aparte porque lo necesitan dos sitios que no deberían depender uno del
 * otro: el arranque en `main.tsx` —que aplica la clase antes del primer render
 * para que no parpadee y para que alcance al login— y el interruptor de
 * `AppLayout`.
 *
 * La clave lleva sufijo `-2` a propósito. La versión anterior escribía `claro`
 * en cada arranque a quien tuviera el sistema en claro, así que cambiar solo
 * el valor por defecto no habría llegado a nadie que ya hubiera abierto la
 * aplicación: su `claro` guardado seguiría ganando. Estrenar clave reparte el
 * nuevo valor por defecto una vez y respeta lo que la persona elija después.
 */
export const CLAVE_TEMA = 'permisos-tema-2'

/** Oscuro por defecto, por decisión del cliente. */
export function temaOscuroGuardado(): boolean {
  return (localStorage.getItem(CLAVE_TEMA) ?? 'oscuro') === 'oscuro'
}

export function aplicarTema(oscuro: boolean): void {
  document.documentElement.classList.toggle('dark', oscuro)
}

export function guardarTema(oscuro: boolean): void {
  localStorage.setItem(CLAVE_TEMA, oscuro ? 'oscuro' : 'claro')
}
