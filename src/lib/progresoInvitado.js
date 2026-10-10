// src/lib/progresoInvitado.js
// ─────────────────────────────────────────────────────────────
// Puente entre el lector en modo muestra y la adquisición del libro.
//
// Lo que un invitado lee no vive en ninguna tabla: sin sesión no hay user_id,
// así que ni progreso_lectura ni sesiones_lectura se escriben. Queda solo en el
// estado del lector. Si al registrarse no se rescata, el libro entra a su
// biblioteca con 0 % y al reabrirlo empieza del capítulo 1, como si no hubiera
// leído nada.
//
// Por qué un módulo y no un estado de React: quien adquiere el libro es
// App.acquireBookAfterAuth, y en una CUENTA NUEVA el tutorial navega a la
// Biblioteca en cuanto detecta el flag — el lector se desmonta en esa misma
// ronda y cualquier efecto suyo se pierde en la carrera. Esto sobrevive al
// desmontaje sin tocar storage: es la misma carga de página.
// { libroId, caps, ancla } · caps = capítulos COMPLETADOS; ancla = { parrafoId,
// offset } del primer párrafo que el invitado tiene en pantalla, para que al
// entrar siga en la misma página y no al principio del capítulo.
let anotado = null

// La llama el lector mientras `guestMode` está activo. Solo sube: llegar al
// final del último capítulo de muestra cuenta como terminarlo (lo marca el
// paywall con chapterIndex + 1), y volver atrás no borra ese avance.
export function anotarMuestra(libroId, caps) {
  if (!libroId || !(caps > 0)) return
  if (anotado?.libroId !== libroId) anotado = { libroId, caps, ancla: null }
  else anotado.caps = Math.max(anotado.caps, caps)
}

// La llama el lector en modo muestra cada vez que se asienta en una página,
// igual que guarda el progreso con sesión. Esta sí puede bajar: es dónde está.
export function anotarPosicion(libroId, parrafoId, offset = 0) {
  if (!libroId || !parrafoId) return
  if (anotado?.libroId !== libroId) anotado = { libroId, caps: 0, ancla: null }
  anotado.ancla = { parrafoId, offset }
}

// Devuelve lo leído como invitado ({ caps, ancla }, o null si nada) y lo
// consume: el rescate corre una sola vez por libro.
export function tomarMuestra(libroId) {
  if (!anotado || anotado.libroId !== libroId) return null
  const { caps, ancla = null } = anotado
  anotado = null
  return { caps, ancla }
}

// ── "Continuar con Google" ──
// Ese inicio de sesión sale a Google y vuelve, así que la página se recarga:
// la memoria de este módulo se pierde y el onAuthSuccess del pop-up no llega a
// correr. Justo antes de salir se deja en la sessionStorage de la pestaña lo
// leído y en qué libro estaba; al volver se recupera UNA vez y se borra.
const CLAVE_MUESTRA = 'inm-muestra-pendiente'
const CLAVE_LIBRO = 'inm-adquirir-tras-google'

try {
  const guardada = sessionStorage.getItem(CLAVE_MUESTRA)
  if (guardada) { anotado = JSON.parse(guardada); sessionStorage.removeItem(CLAVE_MUESTRA) }
} catch { /* sin almacenamiento: se pierde el avance, el libro se adquiere igual */ }

// La llama Auth.jsx antes de redirigir a Google.
export function antesDeIrAGoogle() {
  try {
    if (anotado) sessionStorage.setItem(CLAVE_MUESTRA, JSON.stringify(anotado))
    if (window.location.pathname.startsWith('/libro/')) sessionStorage.setItem(CLAVE_LIBRO, window.location.pathname)
  } catch { /* nada que guardar */ }
}

// ¿Acaba de volver de Google en el mismo libro que estaba leyendo? Se consume.
export function volvioDeGoogleEnLibro() {
  try {
    const ruta = sessionStorage.getItem(CLAVE_LIBRO)
    sessionStorage.removeItem(CLAVE_LIBRO)
    return !!ruta && ruta === window.location.pathname
  } catch { return false }
}
