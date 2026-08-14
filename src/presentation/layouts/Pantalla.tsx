import { cn } from '@/lib/utils'

/**
 * Armazón de una pantalla de la aplicación.
 *
 * El encabezado y las barras de acciones se quedan fijos y **solo el cuerpo se
 * desplaza**, de modo que la ventana del navegador nunca hace scroll. Antes
 * cada pantalla apilaba bloques y confiaba en `sticky`, que necesita
 * exactamente lo contrario —que la página entera scrollee—, así que al crecer
 * la lista los filtros y los botones de decisión se iban hacia arriba.
 *
 * En móvil la restricción se levanta: en una pantalla de 400 px de alto,
 * repartir el espacio solo esconde contenido.
 */
export function Pantalla({
  titulo,
  descripcion,
  acciones,
  barra,
  children,
  ancho = 'max-w-7xl',
}: {
  titulo: string
  descripcion?: string
  /** Botones del encabezado, alineados a la derecha. */
  acciones?: React.ReactNode
  /** Pestañas o filtros, entre el encabezado y el cuerpo. También fijos. */
  barra?: React.ReactNode
  children: React.ReactNode
  ancho?: string
}) {
  return (
    <div className={cn('mx-auto flex flex-col gap-4 lg:h-full', ancho)}>
      <header className="franja-institucional flex shrink-0 flex-wrap items-start justify-between gap-3 rounded-xl px-4 py-3.5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-white">{titulo}</h1>
          {descripcion && <p className="mt-1 text-sm text-white/70">{descripcion}</p>}
        </div>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </header>

      {barra && <div className="shrink-0">{barra}</div>}

      {/* `min-h-0` es lo que permite encoger a un hijo de flex por debajo de su
          contenido; sin él, el cuerpo empuja y devuelve el scroll a la página. */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
