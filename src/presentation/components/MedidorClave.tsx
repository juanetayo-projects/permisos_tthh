import { fortalezaClave, type NivelClave } from '@/domain/clave'
import { cn } from '@/lib/utils'

/**
 * Un color por nivel: rojo, rojo, ámbar, azul institucional, verde.
 *
 * Son clases de Tailwind y no `style={{ backgroundColor }}` porque el segmento
 * apagado lleva `bg-muted`, y esa utilidad gana al estilo en línea: la barra se
 * quedaba gris por muy fuerte que fuera la clave. Con clases se aplica una sola
 * regla de fondo por segmento y desaparece el conflicto. Van escritas enteras
 * —nunca interpoladas— porque Tailwind las descubre leyendo el código fuente.
 */
const COLORES: Record<NivelClave, { fondo: string; texto: string }> = {
  0: { fondo: 'bg-[var(--error)]', texto: 'text-[var(--error)]' },
  1: { fondo: 'bg-[var(--error)]', texto: 'text-[var(--error)]' },
  2: { fondo: 'bg-[var(--acento-ambar)]', texto: 'text-[var(--acento-ambar)]' },
  3: { fondo: 'bg-[var(--cac-azul-500)]', texto: 'text-[var(--cac-azul-500)] dark:text-[var(--cac-azul-300)]' },
  4: { fondo: 'bg-[var(--exito)]', texto: 'text-[var(--exito)]' },
}

/**
 * Barra de fortaleza de la contraseña.
 *
 * Se pinta con cuatro segmentos y no con una barra continua porque el objetivo
 * es que se lea de un vistazo cuánto falta, no un porcentaje exacto. El texto
 * va en `aria-live` para que un lector de pantalla también reciba el cambio:
 * el color por sí solo no es información accesible.
 */
export function MedidorClave({
  clave,
  contexto = [],
  className,
}: {
  clave: string
  /** Nombre, correo y documento ya escritos: una clave que los repita se degrada. */
  contexto?: string[]
  className?: string
}) {
  const { nivel, etiqueta, sugerencia } = fortalezaClave(clave, contexto)
  const vacia = clave.length === 0
  const color = COLORES[nivel]
  // El nivel 0 pinta igual un segmento: si no, quien escribe una clave muy
  // débil ve la barra apagada y parece que el medidor no funciona.
  const llenos = vacia ? 0 : Math.max(nivel, 1)

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((segmento) => (
          <span
            key={segmento}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              segmento < llenos ? color.fondo : 'bg-muted'
            )}
          />
        ))}
      </div>

      <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs" aria-live="polite">
        {vacia ? (
          <span className="text-muted-foreground">Mínimo 8 caracteres.</span>
        ) : (
          <>
            <span className={cn('font-medium', color.texto)}>{etiqueta}</span>
            {sugerencia && <span className="text-muted-foreground">{sugerencia}</span>}
          </>
        )}
      </p>
    </div>
  )
}
