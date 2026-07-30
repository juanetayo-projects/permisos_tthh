import { useEffect, useState } from 'react'

/**
 * Indica si el tema oscuro está activo, reaccionando al cambio.
 *
 * ECharts pinta sobre canvas y no hereda las variables CSS, así que necesita
 * saber el tema para elegir sus colores. Se observa la clase del elemento raíz
 * porque es donde la aplica el conmutador del layout.
 */
export function useEsOscuro(): boolean {
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const observador = new MutationObserver(() => {
      setOscuro(document.documentElement.classList.contains('dark'))
    })

    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observador.disconnect()
  }, [])

  return oscuro
}
