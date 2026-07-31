/**
 * Medición de la fortaleza de una contraseña.
 *
 * Es lógica pura —sin React ni Supabase— para poder probarla sin credenciales,
 * igual que las reglas de `correo.ts`.
 *
 * No se usa una librería tipo zxcvbn: pesa cientos de kilobytes por su
 * diccionario y la app se sirve desde GitHub Pages, donde ese peso lo paga
 * cada colaborador que abre el registro desde el celular en la clínica. La
 * heurística de abajo cubre lo que de verdad falla en la práctica —claves
 * cortas, de una sola clase de carácter, el nombre propio o el correo— y el
 * filtro serio de contraseñas filtradas ya lo hace Supabase en el servidor
 * (protección contra contraseñas comprometidas, activada en Auth).
 */

export const LONGITUD_MINIMA_CLAVE = 8

export type NivelClave = 0 | 1 | 2 | 3 | 4

export interface FortalezaClave {
  /** 0 = muy débil … 4 = muy fuerte. */
  nivel: NivelClave
  etiqueta: string
  /** Qué le falta para subir de nivel; `null` cuando ya es muy fuerte. */
  sugerencia: string | null
  /** El registro no deja enviar si es `false`. */
  cumpleMinimo: boolean
}

const ETIQUETAS: Record<NivelClave, string> = {
  0: 'Muy débil',
  1: 'Débil',
  2: 'Aceptable',
  3: 'Fuerte',
  4: 'Muy fuerte',
}

/**
 * Claves que se repiten una y otra vez en las altas reales. La lista es corta
 * a propósito: no pretende ser un diccionario, solo atajar lo evidente antes
 * de que el servidor rechace la clave y la persona se quede sin saber por qué.
 */
const CLAVES_OBVIAS = [
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'contrasena',
  'contraseña',
  'qwertyui',
  'iloveyou',
  'santabarbara',
  'cacsantabarbara',
  'clinica',
  'colombia',
  'bogota',
  'admin123',
  'permisos',
]

const SECUENCIAS = 'abcdefghijklmnopqrstuvwxyz0123456789qwertyuiopasdfghjklñzxcvbnm'

/** Tres o más caracteres seguidos del teclado o del abecedario, en cualquier sentido. */
function tieneSecuencia(texto: string): boolean {
  for (let i = 0; i + 3 <= texto.length; i++) {
    const trozo = texto.slice(i, i + 4)
    if (trozo.length < 4) break
    const alReves = [...trozo].reverse().join('')
    if (SECUENCIAS.includes(trozo) || SECUENCIAS.includes(alReves)) return true
  }
  return false
}

/** «aaaa», «1111»: cuatro repeticiones del mismo carácter. */
function tieneRepeticion(texto: string): boolean {
  return /(.)\1{3,}/.test(texto)
}

/**
 * Trozos de al menos cuatro letras que la persona ya escribió en el formulario
 * —su nombre, su documento, la parte local de su correo—. Una clave que los
 * contiene es adivinable por cualquiera que tenga el directorio de la clínica.
 */
function contieneDatoPropio(clave: string, contexto: string[]): boolean {
  const enMinusculas = clave.toLowerCase()

  return contexto.some((dato) =>
    (dato ?? '')
      .toLowerCase()
      .split(/[^a-z0-9áéíóúñ]+/i)
      .filter((palabra) => palabra.length >= 4)
      .some((palabra) => enMinusculas.includes(palabra))
  )
}

function clasesDeCaracter(clave: string): number {
  return [/[a-záéíóúüñ]/, /[A-ZÁÉÍÓÚÜÑ]/, /[0-9]/, /[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/].filter((re) =>
    re.test(clave)
  ).length
}

function sugerenciaPara(clave: string, clases: number): string | null {
  if (clave.length < LONGITUD_MINIMA_CLAVE) {
    return `Usa al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`
  }
  if (clases < 3) return 'Combina mayúsculas, minúsculas y números.'
  if (clave.length < 12) return 'Alárgala a 12 caracteres o más.'
  if (clases < 4) return 'Agrega un símbolo, por ejemplo * o #.'
  return null
}

/**
 * Califica la contraseña de 0 a 4.
 *
 * @param contexto Datos que la persona ya escribió (nombre, correo, documento).
 *                 Una clave que los repite se degrada, por muy larga que sea.
 */
export function fortalezaClave(clave: string, contexto: string[] = []): FortalezaClave {
  const cumpleMinimo = clave.length >= LONGITUD_MINIMA_CLAVE

  if (clave.length === 0) {
    return { nivel: 0, etiqueta: ETIQUETAS[0], sugerencia: null, cumpleMinimo: false }
  }

  const clases = clasesDeCaracter(clave)
  const sugerencia = sugerenciaPara(clave, clases)

  const enMinusculas = clave.toLowerCase()
  const esObvia =
    CLAVES_OBVIAS.some((c) => enMinusculas.includes(c)) ||
    tieneRepeticion(enMinusculas) ||
    tieneSecuencia(enMinusculas) ||
    contieneDatoPropio(clave, contexto)

  // Una clave adivinable no sube de «Débil» por mucho que la alarguen: es
  // justo el caso que el medidor tiene que señalar.
  if (esObvia) {
    const nivel: NivelClave = cumpleMinimo && clases >= 3 ? 1 : 0
    return {
      nivel,
      etiqueta: ETIQUETAS[nivel],
      sugerencia: 'Evita datos tuyos, palabras comunes y secuencias como «abcd» o «1234».',
      cumpleMinimo,
    }
  }

  let puntos = 0
  if (clave.length >= LONGITUD_MINIMA_CLAVE) puntos++
  if (clave.length >= 12) puntos++
  if (clave.length >= 16) puntos++
  if (clases >= 2) puntos++
  if (clases >= 3) puntos++
  if (clases >= 4) puntos++

  // 0-6 puntos → 0-4 niveles. Sin los ocho caracteres nunca pasa de «Débil».
  const escala: NivelClave[] = [0, 0, 1, 2, 2, 3, 4]
  const nivel = cumpleMinimo ? escala[puntos] : (Math.min(escala[puntos], 1) as NivelClave)

  return { nivel, etiqueta: ETIQUETAS[nivel], sugerencia, cumpleMinimo }
}
