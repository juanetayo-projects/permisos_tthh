const LOGO_BLANCO = `${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`

/**
 * Marco institucional de login, registro y recuperación.
 *
 * Sigue el patrón ya asentado en SIAU: fondo azul a pantalla completa y una
 * sola tarjeta centrada con la banda de cabecera dentro. Antes la franja iba
 * pegada al borde superior y el resto quedaba sobre fondo claro, así que la
 * pantalla no se parecía a las demás aplicaciones de la clínica.
 *
 * `min-h-dvh` con centrado vertical: en un formulario largo —el registro— la
 * tarjeta crece y la página se desplaza; en el login queda centrada.
 */
export function AuthLayout({
  children,
  ancho = 'md',
}: {
  children: React.ReactNode
  ancho?: 'md' | 'lg'
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gradient-to-br from-[var(--cac-azul)] to-[var(--cac-azul-contraste)] p-4 py-8">
      <div
        className={`w-full overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl ${
          ancho === 'lg' ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <header className="franja-institucional flex flex-col items-center gap-2 px-8 py-6 text-center">
          <img src={LOGO_BLANCO} alt="Clínica CAC Santa Bárbara" className="h-12 w-auto" />
          <div className="text-white">
            <p className="text-lg font-bold leading-tight">Permisos y Vacaciones</p>
            <p className="text-xs text-white/80">Proceso de Talento Humano</p>
          </div>
        </header>

        <div className="px-8 py-7">{children}</div>
      </div>

      <p className="text-center text-xs text-white/70">
        Clínica de Alta Complejidad Santa Bárbara · Formatos TH-F-002 y TH-F-005
      </p>
    </div>
  )
}
