// src/lib/escritorPendiente.js
// ─────────────────────────────────────────────────────────────
// «Quiero ser escritor» sin sesión (landing /escritores, Juan 14 nov 2026):
// se apunta aquí y se abre el registro/inicio de sesión. En cuanto hay
// usuario, App.jsx llama a hacerme_escritor() (migración 123) y lleva a
// /escritor. localStorage y no sessionStorage: si confirma el correo, el
// enlace abre otra pestaña. Caduca a los 2 días para no sorprender a nadie.
// ─────────────────────────────────────────────────────────────
const CLAVE = 'inm_escritor_pendiente'
const DURA = 2 * 24 * 60 * 60 * 1000

export function guardarEscritorPendiente() {
  try { localStorage.setItem(CLAVE, String(Date.now())) } catch { /* modo privado: tendrá que darle otra vez */ }
}

export function hayEscritorPendiente() {
  try {
    const t = Number(localStorage.getItem(CLAVE) || 0)
    return t > 0 && Date.now() - t < DURA
  } catch { return false }
}

export function borrarEscritorPendiente() {
  try { localStorage.removeItem(CLAVE) } catch { /* nada */ }
}
