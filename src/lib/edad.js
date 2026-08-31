// Edad del usuario: reglas compartidas entre el registro y el chat del Foro.
//
// Los dos límites vienen de los Términos y Condiciones (sección 3.1) y de la
// Política de Privacidad (sección 8), y viven acá para que documento y código
// no puedan separarse sin que se note:
//
//   · EDAD_MINIMA        14 — crear una cuenta.
//   · EDAD_MINIMA_CHAT   16 — abrir el chat privado uno a uno. El foro público
//     está moderado; el chat es una conversación entre dos personas que nadie
//     supervisa, así que pide dos años más.
//
// La edad es DECLARADA: sale de la fecha de nacimiento que el propio usuario
// escribe en el registro. No la verificamos contra ningún documento, y así se
// dice en los Términos. Esto es un límite de acceso, no un control de identidad.

export const EDAD_MINIMA = 14
export const EDAD_MINIMA_CHAT = 16

// Devuelve la edad en años cumplidos, o null si la fecha no sirve
// (vacía, ilegible o en el futuro).
export function edadEnAnios(fechaNacimiento) {
  if (!fechaNacimiento) return null
  const nacimiento = new Date(fechaNacimiento)
  if (Number.isNaN(nacimiento.getTime())) return null

  const hoy = new Date()
  if (nacimiento > hoy) return null

  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  // Resta un año si todavía no llegó el cumpleaños de este año.
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return edad
}

// ¿Puede este usuario abrir el chat privado? `fechaNacimiento` puede venir del
// perfil o del metadata de Auth. Sin fecha (cuentas anteriores a que el campo
// fuese obligatorio) se deja pasar: no hay motivo para bloquear a alguien de
// quien no sabemos nada, y esas cuentas son de adultos conocidos.
export function puedeUsarChat(fechaNacimiento) {
  const edad = edadEnAnios(fechaNacimiento)
  if (edad === null) return true
  return edad >= EDAD_MINIMA_CHAT
}
