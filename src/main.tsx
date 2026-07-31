import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { aplicarTema, temaOscuroGuardado } from '@/lib/tema'

// El tema se aplica antes de montar React: así no parpadea un fondo claro que
// se oscurece, y alcanza también al login, que queda fuera de `AppLayout`.
aplicarTema(temaOscuroGuardado())

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('No se encontró el nodo #root en index.html')

createRoot(contenedor).render(
  <StrictMode>
    <App />
  </StrictMode>
)
