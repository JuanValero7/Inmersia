// src/lib/rescatarMuestra.js
// ─────────────────────────────────────────────────────────────
// Rescata la lectura de muestra de un invitado que acaba de entrar: ancla el
// progreso donde iba, para que el lector lo devuelva ahí (useLectorData
// restaura por `ultimo_parrafo_id`), con los capítulos completados y el
// porcentaje en palabras, como el "% del libro" del lector.
//
// Dónde va el ancla:
//   · Terminó la muestra (llegó al aviso) → el primer párrafo que NO es de
//     muestra, justo donde cortó. Desde la 071 la muestra suele acabar a mitad
//     de un capítulo: saltar al capítulo siguiente se comía el resto del actual.
//   · No la terminó → el párrafo exacto que tenía en pantalla (anotarPosicion),
//     así sigue en la misma página. Sin él, el inicio del capítulo en que iba.
// Los capítulos completados importan: la Cartelera desbloquea fichas según
// ellos, así que contar como leído un capítulo a medias destapa spoilers.
//
// Se llama justo después de adquirir el libro: la RLS ya deja leerlo entero, y
// la fila de progreso puede no existir todavía (por eso upsert).
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabase.js'
import { tomarMuestra } from './progresoInvitado.js'
import { contarPalabras } from '../utils/readerHelpers.js'
import { guardar, AVISOS } from './guardar.js'

const palabrasDe = (parrafos) =>
  parrafos.reduce((s, p) => s + (p.tipo === 'separador' ? 0 : contarPalabras(p.contenido)), 0)

export async function rescatarMuestra(userId, libroId) {
  const muestra = tomarMuestra(libroId)
  if (!muestra || (!muestra.caps && !muestra.ancla)) return
  const { caps, ancla } = muestra

  const { data: capitulos } = await supabase.from('capitulos')
    .select('id, palabras, en_muestra').eq('libro_id', libroId).order('numero')
  if (!capitulos?.length) return
  const termino = caps >= capitulos.filter(c => c.en_muestra).length

  // Capítulo donde queda el ancla: los anteriores están completos.
  let iCap = termino ? caps - 1 : caps
  let leidasEnCap = 0
  let parrafoId = null, offset = 0

  if (termino) {
    const { data: parrafos } = await supabase.from('parrafos')
      .select('id, contenido, tipo, en_muestra').eq('capitulo_id', capitulos[iCap].id).order('numero')
    const corte = (parrafos || []).findIndex(p => !p.en_muestra)
    if (corte >= 0) { parrafoId = parrafos[corte].id; leidasEnCap = palabrasDe(parrafos.slice(0, corte)) }
    else iCap += 1   // la muestra acabó justo al final del capítulo
  } else if (ancla) {
    const { data: suyo } = await supabase.from('parrafos')
      .select('capitulo_id').eq('id', ancla.parrafoId).maybeSingle()
    const i = capitulos.findIndex(c => c.id === suyo?.capitulo_id)
    if (i >= 0) {
      const { data: parrafos } = await supabase.from('parrafos')
        .select('id, contenido, tipo').eq('capitulo_id', capitulos[i].id).order('numero')
      const hasta = (parrafos || []).findIndex(p => p.id === ancla.parrafoId)
      iCap = i
      parrafoId = ancla.parrafoId
      offset = ancla.offset || 0
      leidasEnCap = hasta > 0 ? palabrasDe(parrafos.slice(0, hasta)) : 0
    }
  }
  if (!parrafoId && iCap < capitulos.length) {
    const { data: primero } = await supabase.from('parrafos')
      .select('id').eq('capitulo_id', capitulos[iCap].id).order('numero').limit(1).maybeSingle()
    parrafoId = primero?.id ?? null
  }

  const total = capitulos.reduce((s, c) => s + (c.palabras || 0), 0)
  const leidas = capitulos.slice(0, iCap).reduce((s, c) => s + (c.palabras || 0), 0) + leidasEnCap
  await guardar(supabase.from('progreso_lectura').upsert({
    user_id: userId, libro_id: libroId,
    porcentaje: total ? Math.min(100, Math.round((leidas / total) * 100)) : 0,
    capitulos_completados: Math.min(iCap, capitulos.length),
    ultimo_parrafo_id: parrafoId,
    ultimo_parrafo_offset: offset,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,libro_id' }), { que: 'rescatar muestra', aviso: AVISOS.progreso })
}
