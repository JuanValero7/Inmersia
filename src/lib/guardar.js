// src/lib/guardar.js
// ─────────────────────────────────────────────────────────────
// Escrituras importantes en Supabase: que un fallo no pase en silencio.
//
// POR QUÉ EXISTE
// Sentry solo recibe los errores que rompen la app. Una escritura que falla
// (guardar el progreso, un subrayado, el cuaderno) no rompe nada: supabase-js
// devuelve `{ error }` y el código hacía console.error y seguía. El lector
// perdía dónde iba sin saberlo, y nadie se enteraba. Ver la revisión de
// arquitectura (Documentation/arquitectura/), punto M4.
//
// QUÉ HACE
//   const { ok, data } = await guardar(
//     supabase.from('progreso_lectura').upsert(…),
//     { que: 'progreso', aviso: AVISOS.progreso })
//
//   · Fallo de código o de permisos (RLS, restricción, columna) → a Sentry.
//   · Fallo de red (sin conexión, petición cortada) → NO va a Sentry: no es
//     un fallo nuestro y llenaría el panel de ruido cada vez que alguien
//     lee en el metro.
//   · En los dos casos, si se pasa `aviso`, <AvisoGuardado> lo enseña.
//
// PRIVACIDAD: a Sentry van `que`, el código y el mensaje de Postgres. Nunca
// el contenido escrito ni `details`, que puede llevar valores de la fila.
// ─────────────────────────────────────────────────────────────
import { reportarError } from './errores.js'

// Textos para el lector. Uno por tipo de dato: <AvisoGuardado> no repite el
// mismo en 30 s, así que un progreso que falla en cada página avisa una vez.
export const AVISOS = {
  progreso:  'No pudimos guardar dónde vas. Lo intentaremos otra vez al pasar de página.',
  terminado: 'No pudimos marcar el libro como terminado. Revisa tu conexión.',
  subrayado: 'No pudimos guardar el subrayado. Inténtalo otra vez.',
  borrarSubrayado: 'No pudimos borrar el subrayado. Inténtalo otra vez.',
  cuaderno:  'No pudimos guardar tu cuaderno. Lo intentaremos otra vez al cerrarlo.',
  resena:    'No pudimos guardar tu reseña. Inténtalo otra vez.',
  libro:     'No pudimos añadir el libro a tu biblioteca. Inténtalo otra vez.',
}

const oyentes = new Set()

/** Suscribe a los avisos de guardado. Devuelve la función para darse de baja. */
export function escucharAvisos(fn) {
  oyentes.add(fn)
  return () => { oyentes.delete(fn) }
}

/** Enseña un aviso sin pasar por guardar(), para quien agrupa varias escrituras. */
export function avisar(texto) {
  for (const fn of oyentes) fn(texto)
}

// supabase-js no lanza cuando no hay red: devuelve un error con el mensaje del
// fetch, que cambia según el navegador.
const RED = /failed to fetch|networkerror|load failed|network request failed|fetch failed/i

function esDeRed(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return RED.test(error?.message || String(error))
}

/**
 * Espera una escritura de Supabase y gestiona su fallo.
 *
 * @param {PromiseLike<{ data?: any, error: any }>} peticion   la consulta, sin await
 * @param {{ que: string, aviso?: string }} opciones
 *   que    nombre corto para Sentry y la consola ('progreso', 'subrayado'…)
 *   aviso  texto para el lector; sin él, el fallo solo se registra
 * @returns {Promise<{ ok: boolean, data?: any, error?: any }>}
 */
export async function guardar(peticion, { que, aviso } = { que: 'desconocido' }) {
  let res
  try { res = await peticion } catch (err) { res = { error: err } }
  if (!res?.error) return { ok: true, data: res?.data }

  const { error } = res
  console.error(`No se pudo guardar (${que}):`, error?.message || error)
  if (!esDeRed(error)) {
    reportarError(new Error(`Guardar ${que}: ${error?.message || error}`), {
      que, codigo: error?.code ?? null, hint: error?.hint ?? null,
    })
  }
  if (aviso) avisar(aviso)
  return { ok: false, error }
}

/**
 * Varias escrituras que van juntas (p. ej. progreso al 100 % + libro leído).
 * Las lanza en paralelo como Promise.all, pero mira el resultado de cada una:
 * Promise.all solo se entera de las que lanzan, y supabase-js no lanza.
 * Si fallan varias, el lector ve el aviso una sola vez.
 *
 * @param {PromiseLike<{ error: any }>[]} peticiones
 * @param {{ que: string, aviso?: string }} opciones
 * @returns {Promise<{ ok: boolean }>}
 */
export async function guardarTodo(peticiones, { que, aviso } = { que: 'desconocido' }) {
  const resultados = await Promise.all(peticiones.map(p => guardar(p, { que })))
  const ok = resultados.every(r => r.ok)
  if (!ok && aviso) avisar(aviso)
  return { ok }
}
