import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app.jsx'
import './index.css'

const PRELOAD_RELOAD_KEY = 'indpack_preload_reload_at'
const PRELOAD_RELOAD_WINDOW_MS = 60_000

// Un despliegue nuevo puede retirar chunks que una pestaña antigua todavía intenta cargar.
// Vite emite este evento antes de propagar el error del import dinámico.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()

  const now = Date.now()
  const lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY) || 0)

  if (!lastReload || now - lastReload > PRELOAD_RELOAD_WINDOW_MS) {
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(now))
    window.location.reload()
    return
  }

  // Evita un bucle si el recurso continúa inaccesible y deja que React muestre
  // una salida manual en vez de quedarse en una pantalla negra.
  window.dispatchEvent(new CustomEvent('indpack:update-load-error', {
    detail: event.payload
  }))
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
