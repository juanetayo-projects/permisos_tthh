import { formatearMoneda, soloDigitos } from '@/lib/utils'
import { Input } from '@/presentation/components/ui/input'

/**
 * Importe en pesos colombianos, formateado mientras se escribe.
 *
 * El campo guardaba el texto crudo, así que `3500000` se quedaba en pantalla
 * como una tira de siete dígitos que nadie puede leer de un vistazo —¿son tres
 * millones y medio o treinta y cinco millones?—. Aquí se separan los miles al
 * teclear y se antepone el símbolo, que es como lo escribe Talento Humano en
 * el formato.
 *
 * El valor sube limpio: quien lo consume recibe solo dígitos, no `$ 3.500.000`.
 * Y al pegar un importe ya formateado se acepta igual, en vez de rechazarlo por
 * traer puntos.
 */
export function CampoMoneda({
  id,
  valor,
  onCambio,
  placeholder = '0',
  disabled,
}: {
  id: string
  /** Solo dígitos. Cadena vacía = sin valor. */
  valor: string
  onCambio: (digitos: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const numero = valor === '' ? null : Number(valor)

  return (
    <Input
      id={id}
      // `text` y no `number`: un `number` no admite separadores de miles y en
      // móvil abre un teclado con flechas de incremento que aquí no sirven.
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      value={numero === null ? '' : formatearMoneda(numero)}
      placeholder={placeholder}
      onChange={(e) => onCambio(soloDigitos(e.target.value))}
      className="tabular"
    />
  )
}
