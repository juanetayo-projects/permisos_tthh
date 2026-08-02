/**
 * Marca de campo obligatorio.
 *
 * Existe porque el asterisco estaba escrito a mano en cada formulario con su
 * propio color, y en los formatos que sí lo exigen —empresa, servicio, cargo—
 * directamente no estaba: el colaborador solo se enteraba al intentar enviar.
 */
export function Obligatorio() {
  return (
    <span className="text-[var(--error)]" title="Campo obligatorio" aria-hidden>
      {' '}
      *
    </span>
  )
}
