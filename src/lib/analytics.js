// Analítica de producto (PostHog), en modo sin cookies y fuera del arranque.
//
// Por qué cookieless y no un banner de consentimiento: sin cookies ni
// localStorage no hay "acceso al equipo del usuario", que es lo que la
// ePrivacy/RGPD obliga a consentir. La identidad la calcula PostHog en su
// servidor con un hash que cambia a diario, así que medimos desde el día uno
// sin pedirle nada a nadie y sin poner un banner delante de la biblioteca.
//
// Lo que se paga a cambio (asumido a propósito):
//   - El hash rota cada día → un mismo lector cuenta como usuario nuevo cada
//     jornada. Los "usuarios únicos" salen inflados y la retención entre días
//     no se puede medir. Los embudos dentro de una misma sesión sí funcionan.
//   - Nada de identify(): no hay perfiles de persona (`person_profiles: 'never'`),
//     así que no se puede mirar qué hizo un usuario concreto. Es deliberado —
//     un id persistente sería dato personal y anularía el motivo de ir sin
//     cookies. Si algún día hace falta, es cambiar esto por un banner.
//   - Sin grabación de sesiones ni encuestas: PostHog las apaga en este modo
//     porque necesitan almacenamiento en el navegador.
//
// IMPORTANTE: además de esto hay que activar "Cookieless server hash mode" en
// PostHog → Project Settings → Web analytics. Si no está activado, PostHog
// descarta todos los eventos en ingestión y aquí no se ve ningún error.
const KEY  = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com'

// Sin key la analítica queda dormida entera: así el repo clonado, los tests y
// cualquier despliegue de prueba funcionan sin mandar nada a ninguna parte.
let ph       = null   // la instancia, una vez cargada
let iniciada = false  // la carga ya se pidió (no necesariamente terminada)

// Eventos disparados entre `iniciarAnalitica()` y el final de la carga. Sin
// esto se perderían los primeros segundos, que es justo donde caen el alta y
// la primera apertura de un libro. Tope bajo a propósito: si la carga falla,
// esto no puede crecer sin control.
const cola = []
const COLA_MAX = 20

function arrancar() {
  // Import dinámico y variante `slim`: el paquete completo son 85 kB gzip que
  // se cargarían antes del primer pintado. Así son 44 kB y llegan después,
  // sin competir con el bundle de la biblioteca. `slim` deja fuera grabación
  // de sesiones, encuestas y autocapture — nada que usemos aquí.
  return import('posthog-js/dist/module.slim.js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        ui_host: 'https://eu.posthog.com',

        // Fija el juego de defaults por fecha. Lo que nos importa de aquí es
        // que `capture_pageview` pasa a valer 'history_change': PostHog
        // escucha el History API y cuenta cada cambio de ruta de React Router.
        // Con el default viejo, en una SPA solo se contaría la primera carga.
        defaults: '2026-08-30',

        cookieless_mode: 'always',
        person_profiles: 'never',
        disable_session_recording: true,

        // Autocapture apagado. No es por ruido: registra el texto del elemento
        // pulsado, y en el lector eso significa mandar párrafos del libro a
        // PostHog. Medimos con eventos explícitos (ver `evento()` abajo).
        autocapture: false,

        // Un evento de `npm run dev` es indistinguible de uno de producción
        // una vez en el panel. Esta propiedad viaja en todos y permite
        // filtrarlos: en PostHog, filtro `entorno = produccion`.
        loaded: (instancia) => {
          instancia.register({ entorno: import.meta.env.PROD ? 'produccion' : 'desarrollo' })
          if (import.meta.env.DEV) instancia.debug()
        },
      })

      ph = posthog
      cola.splice(0).forEach(([nombre, props]) => ph.capture(nombre, props))
    })
    .catch((e) => {
      // Un bloqueador de anuncios o una CSP mal puesta caen aquí. La app sigue
      // igual; solo dejamos rastro en consola para poder diagnosticarlo.
      console.error('[analítica] no se pudo cargar PostHog:', e)
    })
}

export function iniciarAnalitica() {
  if (iniciada || !KEY) return
  iniciada = true

  // Esperar a que el navegador esté ocioso: medir no puede robarle milisegundos
  // a abrir la biblioteca. El `timeout` evita que en una pestaña de fondo la
  // analítica no arranque nunca. Safari todavía no trae requestIdleCallback.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(arrancar, { timeout: 3000 })
  } else {
    setTimeout(arrancar, 1500)
  }
}

/**
 * Registra un evento. Silencioso si la analítica no está activa, para que
 * llamarlo nunca pueda romper una pantalla.
 *
 * No metas datos personales en `props` (ni email, ni nombre, ni el texto que
 * escribe el usuario): en este modo PostHog no guarda perfiles, y la política
 * de privacidad dice que la analítica es agregada. Ids de libro y capítulo sí.
 */
export function evento(nombre, props) {
  if (!KEY) return
  if (!ph) {
    if (cola.length < COLA_MAX) cola.push([nombre, props])
    return
  }
  try {
    ph.capture(nombre, props)
  } catch (e) {
    console.error('[analítica] no se pudo registrar', nombre, e)
  }
}
