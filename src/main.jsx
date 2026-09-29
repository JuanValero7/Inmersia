import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { iniciarAnalitica } from './lib/analytics.js'
import { iniciarErrores } from './lib/errores.js'

// retry 2 (el default de React Query es 3): con backoff exponencial,
// tres reintentos dejan al usuario ~7 s frente a una pantalla muda antes
// de que <AvisoRed> pueda decir nada. Con dos son ~3 s, que sigue siendo
// suficiente para absorber un hipo de red sin avisar en falso.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2 } },
})

// Lo primero de todo: cuanto antes se instalen los oyentes, menos ventana
// ciega queda. Sin VITE_SENTRY_DSN no hace nada (ver src/lib/errores.js).
iniciarErrores()

// Antes del render: así el $pageview de la primera pantalla no se pierde.
// Sin VITE_POSTHOG_KEY no hace nada (ver src/lib/analytics.js).
iniciarAnalitica()

// El bloque estático de index.html ya cumplió su función: el rastreador que no
// ejecuta JavaScript se llevó el contenido del HTML crudo. Aquí ya hay JS, así
// que sobra — si se quedara, duplicaría el título del libro sobre la app.
// Se retira antes de montar para que el usuario no vea dos pantallas seguidas.
document.getElementById('seo-estatico')?.remove()

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
)