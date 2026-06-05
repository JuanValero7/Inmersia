// =============================================================
// INMERSIA — Layout de la "pared" de la Biblioteca
// Formato: Plain JavaScript (.js)
//
// Distribuye categorías en cajones dentro de una grilla
// horizontal fija de 7H. El layout es:
//   - PERSISTIBLE: una vez asignada una categoría a un slot,
//     ahí se queda hasta que la borren o crezca tanto que no
//     entre y necesite otro slot adicional.
//   - INCREMENTAL: agregar una categoría nueva no rerolea
//     todo, solo busca un slot vacío donde meterla, o crea
//     una fila nueva si no hay espacio.
//
// Estructura persistible:
//   {
//     rows: [
//       { config: 'C', assignments: [{catId} | null, ...] }
//     ]
//   }
//
// Reglas:
//   - 1H = 300 páginas de capacidad
//   - A y B = 3 slots, C = 4 slots
//   - No se repite la misma config dos filas seguidas
//   - Al asignar categoría nueva → best-fit (el slot vacío
//     más chico que pueda contenerla)
//   - Si los libros de una categoría no caben en su(s) slot(s),
//     se busca un slot vacío adicional para el sobrante;
//     si no hay, se agrega una fila nueva
// =============================================================

export const PAGES_PER_H = 300

export const CONFIGS = {
  A: {
    height: 1,
    slots: [
      { x: 0,   y: 0, w: 3, h: 1 },
      { x: 3.5, y: 0, w: 2, h: 1 },
      { x: 6,   y: 0, w: 1, h: 1 },
    ],
  },
  B: {
    height: 1,
    slots: [
      { x: 0,   y: 0, w: 1, h: 1 },
      { x: 1.5, y: 0, w: 4, h: 1 },
      { x: 6,   y: 0, w: 1, h: 1 },
    ],
  },
  C: {
    height: 2 + 1 / 3,
    slots: [
      { x: 0,   y: 0,         w: 1, h: 2 + 1 / 3 },
      { x: 1.5, y: 0,         w: 3, h: 1 },
      { x: 5,   y: 0,         w: 2, h: 1 },
      { x: 1.5, y: 1 + 1 / 3, w: 5, h: 1 },
    ],
  },
}

const CONFIG_KEYS = Object.keys(CONFIGS)

// ─── Random determinista ─────────────────────────────────────
export function seededRandom(seed) {
  let s = (seed | 0) || 1
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}
export function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

// ─── Elegir config sin repetir la anterior ──────────────────
export function chooseRow(prev, random = Math.random) {
  const opts = prev ? CONFIG_KEYS.filter(k => k !== prev) : CONFIG_KEYS
  return opts[Math.floor(random() * opts.length)]
}

// ─── Helpers ─────────────────────────────────────────────────
function slotCapacity(spec, slotIdx) {
  return spec.slots[slotIdx].w * PAGES_PER_H
}

function totalPages(books) {
  return books.reduce((s, b) => s + (b.pages || 0), 0)
}

function findCatAssignedSlots(rows, catId) {
  const out = []
  rows.forEach((row, ri) => {
    const spec = CONFIGS[row.config]
    row.assignments.forEach((a, si) => {
      if (a && a.catId === catId) {
        out.push({ ri, si, capacity: slotCapacity(spec, si) })
      }
    })
  })
  return out
}

// Busca un slot vacío. Estrategia best-fit:
// el slot vacío más chico cuya capacidad >= neededCap.
// Si ninguno alcanza, devuelve el más grande disponible.
function findEmptySlot(rows, neededCap) {
  let best = null      // slot que alcanza neededCap, el más chico
  let fallback = null  // si ninguno alcanza, el más grande
  rows.forEach((row, ri) => {
    const spec = CONFIGS[row.config]
    row.assignments.forEach((a, si) => {
      if (a !== null) return
      const cap = slotCapacity(spec, si)
      if (cap >= neededCap) {
        if (!best || cap < best.capacity) best = { ri, si, capacity: cap }
      }
      if (!fallback || cap > fallback.capacity) fallback = { ri, si, capacity: cap }
    })
  })
  return best || fallback
}

function addNewRow(rows, random) {
  const prevConfig = rows.length > 0 ? rows[rows.length - 1].config : null
  const newConfig  = chooseRow(prevConfig, random)
  const spec       = CONFIGS[newConfig]
  rows.push({
    config: newConfig,
    assignments: new Array(spec.slots.length).fill(null),
  })
}

// ─── Merge incremental ──────────────────────────────────────
// Recibe el layout previo (puede ser {rows:[]}) y la lista
// actual de categorías. Devuelve el nuevo layout persistible.
//
// Garantías:
//   - Toda categoría que ya tenía slot, lo mantiene.
//   - Categorías borradas → sus slots quedan null.
//   - Categorías nuevas → entran al mejor slot vacío,
//     o nueva fila si no hay.
//   - Si una categoría creció y su capacidad asignada no
//     alcanza, se le agrega(n) slot(s) adicional(es).
export function mergeIntoLayout(prevLayout, categorias, options = {}) {
  const { random = Math.random } = options
  const catById = new Map(categorias.map(c => [c.id, c]))

  // 1. Copia defensiva, limpiando configs desconocidas y
  //    referencias a categorías que ya no existen.
  const rows = (prevLayout?.rows || []).map(prevRow => {
    const spec = CONFIGS[prevRow.config]
    if (!spec) return null
    const assignments = []
    for (let i = 0; i < spec.slots.length; i++) {
      const a = (prevRow.assignments || [])[i]
      if (a && a.catId && catById.has(a.catId)) {
        assignments.push({ catId: a.catId })
      } else {
        assignments.push(null)
      }
    }
    return { config: prevRow.config, assignments }
  }).filter(Boolean)

  // 2. Procesar cada categoría: primero las que ya estaban
  //    (preserva orden visual previo), después las nuevas.
  const alreadyPlaced = []
  const newCats = []
  for (const cat of categorias) {
    if (cat.books.length === 0) continue
    const slots = findCatAssignedSlots(rows, cat.id)
    if (slots.length > 0) alreadyPlaced.push(cat)
    else newCats.push(cat)
  }

  const ordered = [...alreadyPlaced, ...newCats]

  for (const cat of ordered) {
    const needed = totalPages(cat.books)
    let assignedCap = findCatAssignedSlots(rows, cat.id)
      .reduce((s, x) => s + x.capacity, 0)

    // Bucle: agregar slots hasta cubrir la demanda
    let safety = 50
    while (assignedCap < needed && safety-- > 0) {
      const deficit = needed - assignedCap
      let slot = findEmptySlot(rows, deficit)
      if (!slot) {
        addNewRow(rows, random)
        slot = findEmptySlot(rows, deficit)
        if (!slot) break
      }
      rows[slot.ri].assignments[slot.si] = { catId: cat.id }
      assignedCap += slot.capacity
    }
  }

  return { rows }
}

// ─── Expand para render ─────────────────────────────────────
// Toma el layout persistible + categorías y devuelve la
// estructura que usa el componente:
//   [{ config, assignments: [{ categoria, books, usedPages, capacityPages } | null, ...] }]
export function expandLayout(layout, categorias) {
  const catById = new Map(categorias.map(c => [c.id, c]))

  // Recolectar slots por categoría, en orden de aparición.
  const slotsByCat = new Map()
  ;(layout?.rows || []).forEach((row, ri) => {
    const spec = CONFIGS[row.config]
    if (!spec) return
    row.assignments.forEach((a, si) => {
      if (!a) return
      const key = a.catId
      if (!slotsByCat.has(key)) slotsByCat.set(key, [])
      slotsByCat.get(key).push({ ri, si, capacity: slotCapacity(spec, si) })
    })
  })

  // Distribuir libros de cada categoría en sus slots.
  const slotData = new Map() // 'ri-si' -> { books, usedPages }
  slotsByCat.forEach((slots, catId) => {
    const cat = catById.get(catId)
    if (!cat) return
    const remaining = [...cat.books]
    for (const slot of slots) {
      const taken = []
      let used = 0
      while (
        remaining.length > 0 &&
        used + remaining[0].pages <= slot.capacity
      ) {
        const b = remaining.shift()
        taken.push(b)
        used += b.pages
      }
      // Fuerza el primer libro aunque exceda (overflow visual)
      if (taken.length === 0 && remaining.length > 0) {
        const b = remaining.shift()
        taken.push(b)
        used += b.pages
      }
      slotData.set(`${slot.ri}-${slot.si}`, { books: taken, usedPages: used })
    }
  })

  // Build render structure
  return (layout?.rows || []).map((row, ri) => {
    const spec = CONFIGS[row.config]
    if (!spec) return { config: row.config, assignments: [] }
    const assignments = row.assignments.map((a, si) => {
      if (!a) return null
      const cat = catById.get(a.catId)
      if (!cat) return null
      const data = slotData.get(`${ri}-${si}`) || { books: [], usedPages: 0 }
      return {
        categoria: { id: cat.id, nombre: cat.nombre, color: cat.color },
        books: data.books,
        usedPages: data.usedPages,
        capacityPages: slotCapacity(spec, si),
      }
    })
    return { config: row.config, assignments }
  })
}
