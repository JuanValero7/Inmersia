// Reporte de errores en producción (Sentry), con las mismas reglas de
// privacidad que la analítica.
//
// POR QUÉ EXISTE
// Hasta ahora la gestión de errores en producción eran 28 `console.*`. La app
// está desplegada: cada pantalla en blanco que le pasa a un lector real es
// invisible desde aquí. La CSP de vercel.json ya autorizaba los dos ingest de
// Sentry desde hacía tiempo; faltaba la implementación.
//
// LÍMITES QUE NO SON NEGOCIABLES EN ESTE PROYECTO
//   - Sin grabación de sesiones. Grabaría el texto de los libros y lo que el
//     lector escribe en su cuaderno. Es el mismo motivo por el que
//     analytics.js apaga `autocapture`.
//   - `sendDefaultPii: false`. La política de privacidad declara analítica
//     agregada; mandar IP o cabeceras del usuario la contradiría.
//   - Sin `VITE_SENTRY_DSN` esto queda dormido entero, igual que la analítica:
//     el repo clonado, los tests y los despliegues de prueba no mandan nada.
//     Vite además elimina toda esta rama como código muerto en ese caso.
//
// POR QUÉ SENTRY SE CARGA AL PRIMER ERROR Y NO AL ARRANQUE
// El SDK de Sentry v10 mide ~154 kB gzip: más que el bundle entero de la app
// (~150 kB). Cargarlo en cada visita para que casi siempre no reporte nada es
// un precio que no tiene sentido pagar en una app de lectura, donde el lector
// puede estar en el metro con mala cobertura.
//
// Así que lo único que se instala al arrancar son los dos oyentes de abajo,
// que no pesan nada. Si no pasa nada malo —la inmensa mayoría de las sesiones—
// no se descarga un solo byte de Sentry. Al primer error se pide el chunk, se
// inicializa y se vacía la cola. El usuario que ve el fallo paga la descarga;
// el que no lo ve, no.
//
// Consecuencia de este diseño: los manejadores globales de Sentry NUNCA se
// instalan (`globalHandlersIntegration` queda fuera a propósito). Los oyentes
// de aquí son la única fuente de errores globales, así que no hay duplicados.
// La otra fuente es ErrorBoundary.jsx, que llama a `reportarError` a mano
// porque React relanza sus errores de forma que window.onerror no los ve.
const DSN = import.meta.env.VITE_SENTRY_DSN

let sentry    = null   // el módulo, una vez cargado
let cargando  = null   // la promesa en curso, para no pedir el chunk dos veces
let iniciada  = false

// Errores ocurridos antes de que Sentry termine de cargar. Tope bajo a
// propósito: si un bucle roto dispara miles, esto no puede crecer sin control.
const cola = []
const COLA_MAX = 10

function encolar(error, contexto) {
  if (cola.length < COLA_MAX) cola.push({ error, contexto })
  cargar()
}

function cargar() {
  if (sentry || cargando) return cargando
  cargando = import('@sentry/browser')
    .then((S) => {
      S.init({
        dsn: DSN,

        // Lista explícita en lugar de los defaults. Fuera quedan tracing,
        // perfilado, breadcrumbs de red y los manejadores globales (ver la
        // nota de arriba). Lo que queda es lo mínimo para que un error llegue
        // con una traza legible tras el minificado.
        defaultIntegrations: false,
        integrations: [
          S.dedupeIntegration(),
          S.functionToStringIntegration(),
        ],

        environment: import.meta.env.PROD ? 'produccion' : 'desarrollo',
        tracesSampleRate: 0,          // sin métricas de rendimiento por ahora
        replaysSessionSampleRate: 0,  // ver la nota de privacidad de arriba
        replaysOnErrorSampleRate: 0,
        sendDefaultPii: false,
      })
      sentry = S
      for (const { error, contexto } of cola.splice(0)) {
        S.captureException(error, { extra: contexto })
      }
      return S
    })
    .catch(() => {
      // Si el chunk no carga (red caída, bloqueador de anuncios), la app sigue
      // funcionando igual. Lo único que se pierde es la telemetría. Se permite
      // reintentar en el siguiente error.
      cargando = null
      cola.length = 0
    })
  return cargando
}

const alError = (e) =>
  encolar(e.error || new Error(e.message), { origen: 'window.error' })

const alRechazo = (e) =>
  encolar(e.reason instanceof Error ? e.reason : new Error(String(e.reason)),
          { origen: 'unhandledrejection' })

export function iniciarErrores() {
  if (!DSN || iniciada || typeof window === 'undefined') return
  iniciada = true
  window.addEventListener('error', alError)
  window.addEventListener('unhandledrejection', alRechazo)
}

/**
 * Reporta un error capturado a mano. Sin DSN no hace nada: en desarrollo lo
 * que se ve es el `console.error` de quien llama, como siempre.
 * @param {Error} error
 * @param {object} [contexto]  datos extra, nunca contenido del libro ni del cuaderno
 */
export function reportarError(error, contexto = {}) {
  if (!DSN) return
  if (sentry) sentry.captureException(error, { extra: contexto })
  else encolar(error, contexto)
}
