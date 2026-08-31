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
let anotado = null   // { libroId, caps } · caps = capítulos COMPLETADOS

// La llama el lector mientras `guestMode` está activo. Solo sube: llegar al
// final del último capítulo de muestra cuenta como terminarlo (lo marca el
// paywall con chapterIndex + 1), y volver atrás no borra ese avance.
export function anotarMuestra(libroId, caps) {
  if (!libroId || !(caps > 0)) return
  if (anotado?.libroId !== libroId) anotado = { libroId, caps }
  else anotado.caps = Math.max(anotado.caps, caps)
}

// Devuelve los capítulos leídos como invitado y los consume: el rescate corre
// una sola vez por libro.
export function tomarMuestra(libroId) {
  if (!anotado || anotado.libroId !== libroId) return 0
  const { caps } = anotado
  anotado = null
  return caps
}
