// src/lib/codigoPendiente.js
// ─────────────────────────────────────────────────────────────
// Enlace directo inmersia.io/unirse/CÓDIGO (para pasarlo por WhatsApp).
// La ruta guarda el código aquí y manda a la Biblioteca, pasando antes por
// el inicio de sesión si hace falta (con Google la página se recarga, por
// eso sessionStorage y no estado de React). El formulario «Tengo una
// invitación» lo toma al abrirse, una sola vez.
// ─────────────────────────────────────────────────────────────
const CLAVE = 'inm_codigo_pendiente'

export function guardarCodigoPendiente(codigo) {
  try { sessionStorage.setItem(CLAVE, codigo) } catch { /* modo privado: se pierde el enlace, no la app */ }
}

export function hayCodigoPendiente() {
  try { return !!sessionStorage.getItem(CLAVE) } catch { return false }
}

// Sin consumirlo: el registro de 12–13 años lo usa para rellenar el campo.
export function verCodigoPendiente() {
  try { return sessionStorage.getItem(CLAVE) || '' } catch { return '' }
}

export function tomarCodigoPendiente() {
  try {
    const c = sessionStorage.getItem(CLAVE)
    sessionStorage.removeItem(CLAVE)
    return c || ''
  } catch { return '' }
}
