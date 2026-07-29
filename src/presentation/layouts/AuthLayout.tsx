const LOGO_BLANCO = `${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`

/** Marco institucional compartido por login, registro y recuperación. */
export function AuthLayout({
  children,
  ancho = 'md',
}: {
  children: React.ReactNode
  ancho?: 'md' | 'lg'
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="franja-institucional px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
          <img src={LOGO_BLANCO} alt="Clínica CAC Santa Bárbara" className="h-12 w-auto" />
          <div className="text-white">
            <p className="text-lg font-semibold leading-tight">Permisos y Vacaciones</p>
            <p className="text-xs text-white/80">Proceso de Talento Humano</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl items-start justify-center px-6 py-12">
        <div className={`panel-relieve w-full p-8 ${ancho === 'lg' ? 'max-w-2xl' : 'max-w-md'}`}>
          {children}
        </div>
      </main>

      <footer className="pb-10 text-center text-xs text-muted-foreground">
        Clínica de Alta Complejidad Santa Bárbara · Formatos TH-F-002 y TH-F-005
      </footer>
    </div>
  )
}
