import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Tema, antes del primer render.
 *
 * Se aplica aquí y no en `AppLayout` porque ese layout solo envuelve a la
 * aplicación ya autenticada: si el tema se decidiera allí, el login, el
 * registro y la recuperación se verían siempre en claro. Hacerlo antes de
 * montar React evita además el parpadeo de un fondo claro que se oscurece.
 *
 * Oscuro por defecto, por decisión del cliente; la preferencia guardada manda.
 */
document.documentElement.classList.toggle(
  'dark',
  (localStorage.getItem('permisos-tema') ?? 'oscuro') === 'oscuro'
)

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('No se encontró el nodo #root en index.html')

createRoot(contenedor).render(
  <StrictMode>
    <App />
  </StrictMode>
)
