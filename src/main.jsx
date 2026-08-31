import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// retry 2 (el default de React Query es 3): con backoff exponencial,
// tres reintentos dejan al usuario ~7 s frente a una pantalla muda antes
// de que <AvisoRed> pueda decir nada. Con dos son ~3 s, que sigue siendo
// suficiente para absorber un hipo de red sin avisar en falso.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2 } },
})

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
)