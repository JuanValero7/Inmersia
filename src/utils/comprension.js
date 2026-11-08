// @ts-check
// Pestaña «Comprensión» del Salón: las cuentas sobre lo que devuelve
// comprension_aula (migración 094). La base trae los hechos alumno por
// alumno; aquí se suman, se filtran por capítulo y se decide quién necesita
// apoyo. Decisiones de Juan (8 nov 2026):
//   · Mesa: lo que cuenta es dar con el trío (intentos), no elegir la conclusión.
//   · Sin semáforos: cada habilidad en llano, con la evidencia del juego.
//   · Un alumno sale en «necesita apoyo» solo si tiene datos suficientes y
//     queda claramente por debajo de la clase. Quien casi no jugó va aparte.
//   · «Opinar con argumentos» = las notas que puso el profe en el desafío.

/**
 * @typedef {{ user_id: string, nombre: string, capitulos: number }} Alumno
 * @typedef {{ texto: string, cap?: number, deduccion?: string }} PiezaMesa
 * @typedef {{ id: string, pj: string, texto: string, pistas: PiezaMesa[] }} Deduccion
 * @typedef {{ personajes: { id: string, nombre: string, aparece: number }[], deducciones: Deduccion[],
 *   jugadas: Record<string, Record<string, { intentos: number, armada: boolean }>> }} Mesa
 * @typedef {{ id: string, cap: number, rev: number, sorpresa: boolean, pregunta: string, opciones: string[], correcta: number }} Corazonada
 * @typedef {{ preguntas: Corazonada[], jugadas: Record<string, Record<string, { estado: string, opcion: number|null, ovillos: number|null, acierto: boolean|null }>> }} Corazonadas
 * @typedef {{ id: string, cap: number, tipo: string, cita: string }} Frase
 * @typedef {{ frases: Frase[], asignadas: Record<string, string[]>,
 *   jugadas: Record<string, Record<string, { veredicto: 'correcto'|'casi'|'no'|null, contexto: boolean, cincuenta: boolean }>> }} Concurso
 * @typedef {{ id: string, cap: number, tipo: 'vista'|'escondido', pregunta: string }} Tesoro
 * @typedef {{ tesoros: Tesoro[], jugadas: Record<string, { encontrados: string[], fallos: Record<string, number>, fallos_cap: Record<string, number> }> }} Mapa
 * @typedef {{ pregunta: string, estado: string, resumen: any, nota: number|null, comentario: string|null }} Charla
 * @typedef {{ momentos: { momento: 'mitad'|'final', tras_capitulo: number, preguntas: { id: string, tipo: string, consigna: string }[] }[],
 *   charlas: Record<string, Record<string, Charla>> }} Desafio
 * @typedef {{ libro_id: string|null, total_capitulos: number, meta_capitulo: number|null,
 *   juegos: Record<string, boolean>, alumnos: Alumno[],
 *   mesa: Mesa|null, corazonadas: Corazonadas|null, concurso: Concurso|null, mapa: Mapa|null, desafio: Desafio|null }} Comprension
 */

/** Nota mínima para aprobar (escala de 0 a 20, Perú). Por debajo, «necesita apoyo». */
export const NOTA_APROBADO = 11
// Para entrar en «necesita apoyo»: menos de la mitad y 20 puntos por debajo de la clase.
const UMBRAL = 0.5
const MARGEN = 0.2

/** @param {number} a @param {number} b */
const ratio = (a, b) => (b > 0 ? a / b : null)
/** @param {(number|null)[]} xs */
const media = (xs) => {
  const v = /** @type {number[]} */ (xs.filter(x => x != null))
  return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null
}

/**
 * El capítulo que se abre por defecto: el último que ya terminó al menos la
 * mitad de la clase (si no, el 1).
 * @param {Alumno[]} alumnos @param {number} total
 */
export function capituloPorDefecto(alumnos, total) {
  if (!alumnos.length) return 1
  for (let c = Math.max(total, 1); c > 1; c--) {
    if (alumnos.filter(a => a.capitulos >= c).length * 2 >= alumnos.length) return c
  }
  return 1
}

// ── Mesa ─────────────────────────────────────────────────────

/**
 * Desde qué capítulo se puede armar cada deducción: el de su 3.ª pieza más
 * temprana. Una deducción dentro del grupo (2.º nivel) cuenta desde que se
 * puede armar ella.
 * @param {Deduccion[]} deducciones @returns {Record<string, number>}
 */
export function capitulosArmables(deducciones) {
  const porId = Object.fromEntries(deducciones.map(d => [d.id, d]))
  /** @type {Record<string, number>} */
  const memo = {}
  /** @param {string} id @param {Set<string>} visto @returns {number} */
  const cap = (id, visto) => {
    if (memo[id] != null) return memo[id]
    if (visto.has(id) || !porId[id]) return Infinity
    visto.add(id)
    const caps = porId[id].pistas
      .map(p => (p.deduccion ? cap(p.deduccion, visto) : p.cap ?? Infinity))
      .sort((x, y) => x - y)
    memo[id] = caps[2] ?? Infinity
    return memo[id]
  }
  for (const d of deducciones) cap(d.id, new Set())
  return memo
}

/**
 * @param {Mesa} mesa @param {Alumno[]} alumnos
 */
export function resumenMesa(mesa, alumnos) {
  const total = mesa.deducciones.length
  const desde = capitulosArmables(mesa.deducciones)
  const armadas = (/** @type {Alumno} */ a) => Object.values(mesa.jugadas[a.user_id] || {}).filter(j => j.armada).length
  const intentos = alumnos.flatMap(a => Object.values(mesa.jugadas[a.user_id] || {}).map(j => j.intentos))
  /** @type {Record<string, { encontraron: number, pueden: number, intentos: number|null, desde: number }>} */
  const porDeduccion = {}
  for (const d of mesa.deducciones) {
    const pueden = alumnos.filter(a => a.capitulos >= desde[d.id])
    const js = alumnos.map(a => mesa.jugadas[a.user_id]?.[d.id]).filter(Boolean)
    porDeduccion[d.id] = {
      encontraron: js.filter(j => j?.armada).length,
      pueden: pueden.length,
      intentos: media(js.map(j => j?.intentos ?? null)),
      desde: desde[d.id],
    }
  }
  return {
    total,
    porAlumno: alumnos.length ? alumnos.reduce((t, a) => t + armadas(a), 0) / alumnos.length : 0,
    intentos: media(intentos),
    completos: total ? alumnos.filter(a => armadas(a) === total).length : 0,
    porDeduccion,
    armadas,
    /** Deducciones que ese alumno ya podía armar con lo que leyó. */
    armables: (/** @type {Alumno} */ a) => mesa.deducciones.filter(d => a.capitulos >= desde[d.id]).length,
  }
}

// ── Frases difíciles ────────────────────────────────────────

/**
 * Cómo le fue a un alumno con una frase. null = no le tocó o todavía no
 * llegó a ese capítulo.
 * @param {Concurso} cc @param {Alumno} a @param {Frase} f
 * @returns {'correcto'|'casi'|'no'|'omitida'|null}
 */
export function estadoFrase(cc, a, f) {
  const j = cc.jugadas[a.user_id]?.[f.id]
  if (j?.veredicto) return j.veredicto
  if (!(cc.asignadas[a.user_id] || []).includes(f.id) || a.capitulos < f.cap) return null
  return 'omitida'
}

/** @param {Concurso} cc @param {Alumno[]} alumnos @param {number} cap */
export function resumenFrases(cc, alumnos, cap) {
  return cc.frases.filter(f => f.cap === cap).map(f => {
    const cuenta = { correcto: 0, casi: 0, no: 0, omitida: 0, ayudas: 0 }
    for (const a of alumnos) {
      const e = estadoFrase(cc, a, f)
      if (!e) continue
      cuenta[e]++
      const j = cc.jugadas[a.user_id]?.[f.id]
      if (j?.contexto || j?.cincuenta) cuenta.ayudas++
    }
    return { ...f, ...cuenta, total: cuenta.correcto + cuenta.casi + cuenta.no + cuenta.omitida }
  })
}

/**
 * Comprensión por tipo de frase en todo lo leído (comprendida = 1, parcial = ½).
 * @param {Concurso} cc @param {Alumno[]} alumnos
 * @returns {{ tipo: string, pct: number, n: number }[]}
 */
export function frasesPorTipo(cc, alumnos) {
  /** @type {Record<string, { suma: number, n: number }>} */
  const t = {}
  for (const f of cc.frases) for (const a of alumnos) {
    const v = cc.jugadas[a.user_id]?.[f.id]?.veredicto
    if (!v) continue
    t[f.tipo] ??= { suma: 0, n: 0 }
    t[f.tipo].suma += v === 'correcto' ? 1 : v === 'casi' ? 0.5 : 0
    t[f.tipo].n++
  }
  return Object.entries(t).map(([tipo, x]) => ({ tipo, pct: x.suma / x.n, n: x.n })).sort((x, y) => x.pct - y.pct)
}

// ── Tesoros ─────────────────────────────────────────────────

/** @param {Mapa} mapa @param {Alumno[]} alumnos @param {number} cap */
export function resumenTesoros(mapa, alumnos, cap) {
  return mapa.tesoros.filter(t => t.cap === cap).map(t => {
    const pueden = alumnos.filter(a => a.capitulos >= t.cap)
    const enc = pueden.filter(a => mapa.jugadas[a.user_id]?.encontrados.includes(t.id))
    const fallos = enc.map(a => mapa.jugadas[a.user_id]?.fallos[t.id] || 0)
    return { ...t, encontraron: enc.length, pueden: pueden.length, fallos: media(fallos) }
  })
}

// ── Corazonadas ─────────────────────────────────────────────

/** @param {Corazonadas} cz @param {Alumno[]} alumnos @param {number} cap */
export function resumenCorazonadas(cz, alumnos, cap) {
  return cz.preguntas.filter(p => p.cap === cap).map(p => {
    const votos = p.opciones.map(() => 0)
    let perdidas = 0
    const pueden = alumnos.filter(a => a.capitulos >= p.cap)
    for (const a of pueden) {
      const j = cz.jugadas[a.user_id]?.[p.id]
      if (j?.opcion != null) votos[j.opcion]++
      else if (j?.estado === 'perdida' || a.capitulos >= p.rev) perdidas++
    }
    return { ...p, votos, jugaron: votos.reduce((t, x) => t + x, 0), perdidas, pueden: pueden.length }
  })
}

/**
 * Aciertos del alumno en las corazonadas resueltas que se podían deducir
 * (las sorpresas no cuentan) y cuántos ovillos jugó de media.
 * @param {Corazonadas} cz @param {Alumno} a
 */
export function corazonadasAlumno(cz, a) {
  const js = cz.preguntas.map(p => ({ p, j: cz.jugadas[a.user_id]?.[p.id] })).filter(x => x.j?.opcion != null)
  const resueltas = js.filter(x => !x.p.sorpresa && x.j?.acierto != null)
  return {
    jugadas: js.length,
    aciertos: resueltas.filter(x => x.j?.acierto).length,
    resueltas: resueltas.length,
    confianza: media(js.map(x => x.j?.ovillos ?? null)),
  }
}

// ── Las tres habilidades ────────────────────────────────────

/**
 * Lo de cada alumno que alimenta las tres tarjetas.
 * @param {Comprension} c @param {Alumno} a
 */
export function evidenciaAlumno(c, a) {
  const mapa = c.mapa, cc = c.concurso, mesa = c.mesa
  const leidos = (/** @type {'vista'|'escondido'} */ tipo) => (mapa?.tesoros || []).filter(t => t.tipo === tipo && t.cap <= a.capitulos)
  const enc = new Set(mapa?.jugadas[a.user_id]?.encontrados || [])
  const vista = leidos('vista'), esc = leidos('escondido')
  const frases = cc ? cc.frases.map(f => cc.jugadas[a.user_id]?.[f.id]?.veredicto).filter(Boolean) : []
  const rm = mesa ? resumenMesa(mesa, [a]) : null
  const notas = c.desafio ? Object.values(c.desafio.charlas[a.user_id] || {}).map(x => x.nota).filter(n => n != null) : []
  return {
    vista: { si: vista.filter(t => enc.has(t.id)).length, de: vista.length },
    escondidos: { si: esc.filter(t => enc.has(t.id)).length, de: esc.length },
    frases: { si: frases.filter(v => v === 'correcto').length + frases.filter(v => v === 'casi').length * 0.5, de: frases.length,
      comprendidas: frases.filter(v => v === 'correcto').length },
    mesa: rm ? { si: rm.armadas(a), de: rm.armables(a) } : { si: 0, de: 0 },
    notas: /** @type {number[]} */ (notas),
    // Jugó algo en algún juego (las oportunidades sin jugar no son datos).
    jugo: enc.size > 0 || frases.length > 0 || (rm ? Object.keys(mesa?.jugadas[a.user_id] || {}).length > 0 : false)
      || Object.keys(c.corazonadas?.jugadas[a.user_id] || {}).length > 0 || notas.length > 0
      || (mapa?.jugadas[a.user_id] != null),
  }
}

/**
 * Las tres tarjetas: la clase en conjunto y quién necesita apoyo, con el
 * motivo en cifras.
 * @param {Comprension} c
 */
export function habilidades(c) {
  const ev = c.alumnos.map(a => ({ a, e: evidenciaAlumno(c, a) }))
  const suma = (/** @type {'vista'|'escondidos'|'frases'|'mesa'} */ k) => {
    const si = ev.reduce((t, x) => t + x.e[k].si, 0), de = ev.reduce((t, x) => t + x.e[k].de, 0)
    return { si, de, pct: ratio(si, de) }
  }
  const pide = (/** @type {number|null} */ r, /** @type {number|null} */ clase) =>
    r != null && r < UMBRAL && (clase == null || r <= clase - MARGEN)

  // Localizar: tesoros a la vista entre los capítulos que leyó (mín. 3).
  // Solo cuenta quien buscó tesoros: si no jugó al mapa, no hay dato.
  const vista = suma('vista')
  const conMapa = ev.filter(x => c.mapa?.jugadas[x.a.user_id])
  const vistaClase = ratio(conMapa.reduce((t, x) => t + x.e.vista.si, 0), conMapa.reduce((t, x) => t + x.e.vista.de, 0))
  const localizar = {
    clase: { vista: { ...vista, pct: vistaClase } },
    apoyo: conMapa.filter(x => x.e.vista.de >= 3 && pide(ratio(x.e.vista.si, x.e.vista.de), vistaClase))
      .map(x => ({ a: x.a, motivo: `${x.e.vista.si} de ${x.e.vista.de} tesoros a la vista` })),
  }

  // Comprender: media de frases (mín. 2 contestadas), escondidos (mín. 3, si jugó al mapa) y mesa (mín. 3 armables, si jugó).
  const comp = ev.map(x => {
    const partes = []
    if (x.e.frases.de >= 2) partes.push({ r: ratio(x.e.frases.si, x.e.frases.de), t: `${x.e.frases.comprendidas} de ${x.e.frases.de} frases comprendidas` })
    if (c.mapa?.jugadas[x.a.user_id] && x.e.escondidos.de >= 3) partes.push({ r: ratio(x.e.escondidos.si, x.e.escondidos.de), t: `${x.e.escondidos.si} de ${x.e.escondidos.de} tesoros escondidos` })
    if (c.mesa?.jugadas[x.a.user_id] && x.e.mesa.de >= 3) partes.push({ r: ratio(x.e.mesa.si, x.e.mesa.de), t: `${x.e.mesa.si} de ${x.e.mesa.de} deducciones` })
    return { a: x.a, r: media(partes.map(p => p.r)), motivo: partes.map(p => p.t).join(' · ') }
  })
  const compClase = media(comp.map(x => x.r))
  const comprender = {
    clase: { frases: suma('frases'), escondidos: suma('escondidos'), mesa: c.mesa ? resumenMesa(c.mesa, c.alumnos) : null },
    apoyo: comp.filter(x => pide(x.r, compClase)).map(x => ({ a: x.a, motivo: x.motivo })),
  }

  // Evaluar y reflexionar: lo que corrigió el profe.
  const charlas = ev.flatMap(x => Object.values(c.desafio?.charlas[x.a.user_id] || {}).filter(ch => ch.estado === 'terminada'))
  const corregidas = charlas.filter(ch => ch.nota != null)
  const evaluar = {
    clase: {
      terminadas: charlas.length,
      corregidas: corregidas.length,
      media: media(corregidas.map(ch => ch.nota)),
    },
    apoyo: ev.filter(x => x.e.notas.length && (media(x.e.notas) ?? 20) < NOTA_APROBADO)
      .map(x => ({ a: x.a, motivo: `Nota ${x.e.notas.join(' y ')} en el desafío` })),
  }

  return {
    localizar, comprender, evaluar,
    // Empezaron el libro y todavía no jugaron a nada: van aparte, no como «le cuesta».
    sinDatos: ev.filter(x => !x.e.jugo).map(x => x.a),
  }
}

/** Formato de porcentaje sin decimales. @param {number|null} r */
export const pct = (r) => (r == null ? '—' : `${Math.round(r * 100)}\u00a0%`)
/** Número con coma decimal. @param {number|null} n @param {number} [dec] */
export const num = (n, dec = 1) => (n == null ? '—' : n.toFixed(dec).replace('.', ',').replace(/,0$/, ''))
